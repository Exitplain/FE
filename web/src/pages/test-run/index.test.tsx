import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { confirmPersonaRun, discoverPersonaPlan, getPersonaRun } from "@/apis/persona.api";
import { ROUTES } from "@/constants/routes";
import { server } from "@/mocks/node";
import { renderWithProviders } from "@/test/renderWithProviders";
import type { PersonaRun } from "@/types/persona.type";

import TestRunPage from "./index";

async function startRun(taskIds = ["order", "coupon"]) {
  const plan = await discoverPersonaPlan({ variant: "problem" });
  return confirmPersonaRun({
    plan_id: plan.plan_id,
    feature_ids: [...new Set(taskIds.map((id) => (id === "coupon" ? "coupon" : "shopping")))],
    task_ids: taskIds,
    ages: ["30s"],
    context: "첫 방문자",
    additional_request: "",
  });
}

async function advance(times: number) {
  for (let i = 0; i < times; i += 1) await getPersonaRun();
}

function renderRun(runId: string, query = "") {
  return renderWithProviders(<TestRunPage />, {
    route: `/projects/banchan/runs/${runId}${query}`,
    path: ROUTES.testRun.path,
  });
}

/* 화면이 받을 GET /api/personas 응답을 고정합니다 */
function serveRun(run: Partial<PersonaRun> & Pick<PersonaRun, "status" | "sessions">) {
  server.use(
    http.get("*/api/personas", () =>
      HttpResponse.json({
        id: "fixed-run",
        policy: "",
        model_calls: 0,
        target: "",
        profiles: [],
        tasks: [],
        created_at: new Date().toISOString(),
        ...run,
      }),
    ),
  );
}

const baseSession = {
  profile_id: "quick",
  name: "빠른 구매",
  context: "",
  max_required_fields: 2,
  width: 390,
  search_sensitivity: 1,
  cost_sensitivity: 1,
  task_id: "order",
  task_name: "첫 주문",
  goal: "",
  reason: "",
  steps: 0,
  events: [],
  trace: [],
  terminal_stage: null,
  issue: null,
  artifact_id: null,
  viewer_url: null,
};

describe("P08~P11 실행 화면", () => {
  it("P08 — 아직 행동한 세션이 없으면 준비 단계를 보여준다", async () => {
    const run = await startRun();
    renderRun(run.id!);

    expect(await screen.findByText("브라우저 준비")).toBeInTheDocument();
    expect(screen.getByText("준비 중")).toBeInTheDocument();
  });

  it("P09 — 과업별 진행과 세션 타일을 보여주고, 상태로 거른다", async () => {
    const user = userEvent.setup();
    const run = await startRun();
    await advance(3);
    renderRun(run.id!);

    const tabs = await screen.findByRole("radiogroup", { name: "과업" });
    expect(within(tabs).getByRole("radio", { name: "첫 주문" })).toBeChecked();

    const tiles = await screen.findByRole("list", { name: "세션" });
    expect(within(tiles).getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByRole("progressbar", { name: "진행률" })).toBeInTheDocument();

    await user.click(within(tabs).getByRole("radio", { name: "쿠폰으로 주문" }));
    expect(
      within(screen.getByRole("list", { name: "세션" })).getByText(/쿠폰으로 주문/),
    ).toBeTruthy();

    await user.click(screen.getByRole("radio", { name: /^대기/ }));
    expect(screen.getByRole("radio", { name: /^대기/ })).toBeChecked();
  });

  it("P11 — 세션 타일을 누르면 그 세션의 상태와 행동 로그를 보고, 실행 화면으로 돌아온다", async () => {
    const user = userEvent.setup();
    const run = await startRun(["order"]);
    await advance(3);
    renderRun(run.id!);

    await user.click(await screen.findByRole("link", { name: /빠른 구매/ }));

    expect(
      await screen.findByRole("heading", { level: 1, name: /빠른 구매 · 라이브/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "행동 로그" })).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "실행 화면으로" }));
    expect(await screen.findByRole("list", { name: "세션" })).toBeInTheDocument();
  });

  it("끝나면 결과를 요약하고 리포트로 연결한다", async () => {
    const run = await startRun(["order"]);
    await advance(20);
    renderRun(run.id!);

    expect(await screen.findByText("실행이 끝났어요")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "리포트 보기" })).toHaveAttribute(
      "href",
      `/projects/banchan/runs/${run.id}/report`,
    );
  });

  it("E05 — 모든 세션이 기술 실패로 끝나면 실행을 끝내지 못했다고 알린다", async () => {
    serveRun({
      status: "completed",
      sessions: [
        {
          ...baseSession,
          id: "quick_order",
          status: "agent_failure",
          reason: "브라우저 실행 오류",
        },
      ],
    });
    renderRun("fixed-run");

    expect(
      await screen.findByRole("heading", { name: "실행을 끝내지 못했어요" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "다시 시도" })).toHaveAttribute(
      "href",
      "/projects/banchan/tests/new",
    );
  });

  it("E12 — 행동·시간 한도에 닿은 세션은 한도 도달로 표시하고 오류로 센다", async () => {
    serveRun({
      status: "running",
      sessions: [
        { ...baseSession, id: "quick_order", status: "budget_exceeded", steps: 35 },
        {
          ...baseSession,
          id: "careful_order",
          status: "running",
          steps: 4,
          name: "꼼꼼한 첫 방문",
        },
      ],
    });
    renderRun("fixed-run");

    expect(await screen.findByText("한도 도달")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "오류 1" })).toBeInTheDocument();
  });

  it("현재 실행이 아닌 주소면 찾을 수 없다고 알리고 목록으로 안내한다", async () => {
    await startRun(["order"]);
    renderRun("other-run");

    expect(await screen.findByText("이 실행을 찾을 수 없어요")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "사전 테스트 목록" })).toHaveAttribute(
      "href",
      "/projects/banchan/tests",
    );
  });
});
