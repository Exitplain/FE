import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { Route, Routes, useParams } from "react-router-dom";
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

function ReportProbe() {
  const { runId } = useParams();
  return <p>리포트 {runId}</p>;
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
  it("P08 — 준비 중에는 체크리스트·대기 타일·발화 대기를 보여준다", async () => {
    const run = await startRun();
    renderRun(run.id!);

    expect(
      await screen.findByRole("heading", { level: 1, name: /1차 · 첫 주문 외 1개/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("과업 2개 · 모바일 390 · 20명 × 시드 3회 (1/3)")).toBeInTheDocument();
    const checklist = screen.getByRole("list", { name: "실행 준비" });
    expect(checklist).toHaveTextContent("페르소나 20명 · 시드 3개 불러오기완료");
    expect(checklist).toHaveTextContent("브라우저 20개 준비");
    expect(screen.getByText("다음: 세션 20개와 Think-aloud (자동 전환)")).toBeInTheDocument();
    const tiles = within(screen.getByRole("list", { name: "세션" })).getAllByRole("link");
    expect(tiles).toHaveLength(20);
    expect(tiles[0]).toHaveAccessibleName("P-001 · 빠른 구매형 · 대기 — 세션 라이브 보기");
    /* 준비 중에는 상태 필터가 없습니다 */
    expect(screen.queryByRole("radiogroup", { name: "세션 상태" })).not.toBeInTheDocument();
    expect(
      screen.getByText("세션이 시작되면 페르소나의 발화가 여기에 나타나요"),
    ).toBeInTheDocument();
  });

  it("P09 — 과업별 진행·필터·타일과 Think-aloud 발화를 보여준다", async () => {
    const user = userEvent.setup();
    const run = await startRun();
    await advance(4);
    renderRun(run.id!);

    const tabs = await screen.findByRole("radiogroup", { name: "과업" });
    expect(within(tabs).getByRole("radio", { name: "첫 주문" })).toBeChecked();
    expect(screen.getByText("실행 중")).toBeInTheDocument();

    const tiles = await screen.findByRole("list", { name: "세션" });
    /* 에이전트 20명이 과업마다 한 세션씩 */
    expect(within(tiles).getAllByRole("listitem")).toHaveLength(20);
    expect(screen.getByRole("progressbar", { name: "진행률" })).toBeInTheDocument();
    expect(
      within(screen.getByRole("list", { name: "발화" })).getAllByRole("listitem").length,
    ).toBeGreaterThan(0);

    await user.click(within(tabs).getByRole("radio", { name: "쿠폰으로 주문" }));
    // 과업을 바꾸면 타일이 모두 그 과업 세션으로 바뀝니다
    const couponTiles = within(screen.getByRole("list", { name: "세션" })).getAllByRole("listitem");
    expect(couponTiles).toHaveLength(20);

    await user.click(screen.getByRole("radio", { name: /^대기/ }));
    expect(screen.getByRole("radio", { name: /^대기/ })).toBeChecked();
  });

  it("P11 — 세션 타일을 누르면 P 코드 라이브 화면에서 상태·행동 로그·발화를 보고 돌아온다", async () => {
    const user = userEvent.setup();
    const run = await startRun(["order"]);
    await advance(4);
    renderRun(run.id!);

    /* 빠른 구매형 세그먼트는 P-001~P-005 — 첫 타일로 들어갑니다 */
    await user.click((await screen.findAllByRole("link", { name: /빠른 구매형/ }))[0]);

    expect(
      await screen.findByRole("heading", { level: 1, name: "P-001 · 라이브" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/빠른 구매형 · 목표: 첫 주문 · 시드 \d \/ 3/)).toBeInTheDocument();
    expect(screen.getByText("토큰 · 비용").nextElementSibling).toHaveTextContent(/토큰 · \$/);
    expect(screen.getByRole("heading", { name: "행동 로그" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Think-aloud" })).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "실행 화면으로" }));
    expect(await screen.findByRole("list", { name: "세션" })).toBeInTheDocument();
  });

  it("P10 — 분석 단계를 보여주고, 끝나면 리포트로 자동 이동한다", async () => {
    const run = await startRun(["order"]);
    /* 준비 2 + 시드 3회 × (세션 2틱 + 시드 전환) 뒤 분석 단계 */
    let current = await getPersonaRun();
    for (let i = 0; i < 30 && current.stage !== "analyzing"; i += 1)
      current = await getPersonaRun();
    renderWithProviders(
      <Routes>
        <Route path={ROUTES.testRun.path} element={<TestRunPage />} />
        <Route path={ROUTES.report.path} element={<ReportProbe />} />
      </Routes>,
      { route: `/projects/banchan/runs/${run.id}` },
    );

    expect(await screen.findByText("분석 중")).toBeInTheDocument();
    const checklist = screen.getByRole("list", { name: "결과 분석" });
    expect(checklist).toHaveTextContent("세션 60개 종료 (시드 3회)");
    expect(checklist).toHaveTextContent("리포트 생성 · 범위 계산");
    expect(screen.getByText("다음: 리포트 (자동 이동)")).toBeInTheDocument();

    expect(await screen.findByText(`리포트 ${run.id}`, {}, { timeout: 15000 })).toBeInTheDocument();
  }, 20000);

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
          reason: "접속 불가 · 응답 시간 초과 3회",
        },
      ],
    });
    renderRun("fixed-run");

    expect(
      await screen.findByRole("heading", { name: "실행을 끝내지 못했어요" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("접속 불가 · 응답 시간 초과 3회 · 끝난 세션 0 / 1"),
    ).toBeInTheDocument();
    expect(screen.getByText("실패")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "다시 시도" })).toHaveAttribute(
      "href",
      "/projects/banchan/tests/new",
    );
    expect(screen.getByRole("link", { name: "설정 수정" })).toHaveAttribute(
      "href",
      "/projects/banchan/tests/new",
    );
  });

  it("E12 — 비용 상한에 닿아 멈추면 멈춘 시점과 부분 리포트를 보여준다", async () => {
    serveRun({
      status: "completed",
      seeds: { current: 2, total: 3 },
      stopped: {
        reason: "budget",
        seed: 2,
        finished: 33,
        total: 60,
        cost_ratio: 1,
        tokens: 1_100_000,
      },
      sessions: [{ ...baseSession, id: "quick_order", status: "success" }],
    });
    renderRun("fixed-run");

    expect(
      await screen.findByText("실행당 LLM 비용 상한에 닿아 시드 2 / 3에서 멈췄어요"),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: /첫 주문 · \d+차/ })).toBeInTheDocument();
    expect(screen.getByText("33 / 60 (시드 1 전체 + 시드 2 일부)")).toBeInTheDocument();
    expect(screen.getByText("상한 100% · 토큰 1.1M")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "부분 리포트 보기" })).toHaveAttribute(
      "href",
      "/projects/banchan/runs/fixed-run/report",
    );
  });

  it("행동·시간 한도에 닿은 세션은 한도 도달로 표시하고 오류로 센다", async () => {
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
  it("받아 둔 실행이 있을 때 다시 받기에 실패하면 화면은 두고 다시 시도를 안내한다", async () => {
    const run = await startRun(["order"]);
    await advance(2);
    const { queryClient } = renderRun(run.id!);
    await screen.findByRole("list", { name: "세션" });

    server.use(http.get("*/api/personas", () => HttpResponse.error()));
    await queryClient.refetchQueries({ queryKey: ["personas", "current"] }).catch(() => {});

    expect(await screen.findByText(/최신 상태를 불러오지 못했어요/)).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "세션" })).toBeInTheDocument();
  });

  it("세션 라이브에서 돌아와도 고른 과업을 유지한다", async () => {
    const user = userEvent.setup();
    const run = await startRun();
    await advance(3);
    renderRun(run.id!);

    const tabs = await screen.findByRole("radiogroup", { name: "과업" });
    await user.click(within(tabs).getByRole("radio", { name: "쿠폰으로 주문" }));
    await user.click(within(screen.getByRole("list", { name: "세션" })).getAllByRole("link")[0]);
    await user.click(await screen.findByRole("link", { name: "실행 화면으로" }));

    expect(
      within(await screen.findByRole("radiogroup", { name: "과업" })).getByRole("radio", {
        name: "쿠폰으로 주문",
      }),
    ).toBeChecked();
  });
});
