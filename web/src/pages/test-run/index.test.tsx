import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { Route, Routes, useParams, useSearchParams } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { confirmPersonaRun, discoverPersonaPlan, getPersonaRun } from "@/apis/persona.api";
import { ROUTES } from "@/constants/routes";
import { server } from "@/mocks/node";
import { useRetestStore } from "@/stores/useRetestStore";
import ProjectRoute from "@/components/Projects/ProjectRoute";
import { renderWithProviders } from "@/test/renderWithProviders";
import type { RunDetail, RunSession } from "@/types/run.type";

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

function RetestProbe() {
  const { runId } = useParams();
  const [params] = useSearchParams();
  return (
    <p>
      비교 {runId} {params.get("b")}
    </p>
  );
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
    route: `/projects/1/runs/${runId}${query}`,
    path: ROUTES.testRun.path,
  });
}

/* 화면이 받을 제품 API 실행 응답(상태·세션·이벤트)을 고정합니다 */
function serveRun(detail: Partial<RunDetail>, sessions: RunSession[]) {
  const run: RunDetail = {
    id: "fixed-run",
    sequence_no: 1,
    name: "1차·첫 주문",
    kind: "pretest",
    status: "running",
    change_note: "",
    parent_run_id: null,
    created_at: new Date().toISOString(),
    started_at: new Date().toISOString(),
    finished_at: null,
    report: null,
    project_id: 1,
    phase: "running",
    cancel_requested: false,
    error: null,
    progress: {
      expected_sessions: sessions.length,
      started_sessions: sessions.length,
      finished_sessions: 0,
      sessions_by_status: {},
      task_runs: { total: 1, queued: 0, running: 1, succeeded: 0, failed: 0, cancelled: 0 },
    },
    ...detail,
  };
  server.use(
    http.get("*/api/v1/runs/:runId", () => HttpResponse.json(run)),
    http.get("*/api/v1/runs/:runId/sessions", () =>
      HttpResponse.json({ items: sessions, next_cursor: null, total: sessions.length }),
    ),
    http.get("*/api/v1/runs/:runId/events", () =>
      HttpResponse.json({ items: [], next_after: 0, has_more: false }),
    ),
  );
}

function session(id: number, overrides: Partial<RunSession> = {}): RunSession {
  return {
    id,
    session_key: `session-${id}`,
    persona: { code: `P-00${id}`, segment_id: "segment_1", segment_name: "빠른 구매형" },
    task_id: "order",
    seed: 1,
    status: "running",
    reason: null,
    steps: 3,
    duration_seconds: null,
    max_frustration: 20,
    terminal_stage: "detail",
    stages_reached: ["landing", "detail"],
    latest_observation: null,
    final_screenshot_url: null,
    started_at: new Date().toISOString(),
    finished_at: null,
    ...overrides,
  };
}

describe("P08~P11 실행 화면", () => {
  it("P08 — 준비 중에는 체크리스트와 준비한 브라우저 수(시작한 세션 / 예상 세션)를 보여준다", async () => {
    const run = await startRun();
    renderRun(run.id!);

    expect(
      await screen.findByRole("heading", { level: 1, name: /1차 · 첫 주문 외 1개/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("준비 중")).toBeInTheDocument();
    const checklist = screen.getByRole("list", { name: "실행 준비" });
    expect(checklist).toHaveTextContent("페르소나 불러오기완료");
    expect(checklist).toHaveTextContent("브라우저 40개 준비");
    expect(screen.getByText("다음: 세션 40개와 Think-aloud (자동 전환)")).toBeInTheDocument();
    /* 준비 중에는 상태 필터가 없습니다 */
    expect(screen.queryByRole("radiogroup", { name: "세션 상태" })).not.toBeInTheDocument();
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
    serveRun({}, [
      session(1),
      session(2, {
        persona: { code: "P-002", segment_id: "segment_2", segment_name: "꼼꼼한 비교형" },
      }),
    ]);
    renderRun("fixed-run");

    await user.click((await screen.findAllByRole("link", { name: /빠른 구매형/ }))[0]);

    expect(
      await screen.findByRole("heading", { level: 1, name: "P-001 · 라이브" }),
    ).toBeInTheDocument();
    expect(screen.getByText("빠른 구매형 · 목표: 첫 주문 · 시드 1")).toBeInTheDocument();
    /* 토큰·비용은 제품 API 에 없어 보이지 않습니다 */
    expect(screen.queryByText("토큰 · 비용")).not.toBeInTheDocument();
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
        <Route element={<ProjectRoute />}>
          <Route path={ROUTES.testRun.path} element={<TestRunPage />} />
          <Route path={ROUTES.report.path} element={<ReportProbe />} />
        </Route>
      </Routes>,
      { route: `/projects/1/runs/${run.id}` },
    );

    expect(await screen.findByText("분석 중")).toBeInTheDocument();
    const checklist = screen.getByRole("list", { name: "결과 분석" });
    expect(checklist).toHaveTextContent(/세션 \d+개 종료/);
    expect(checklist).toHaveTextContent("리포트 생성 · 범위 계산");
    expect(screen.getByText("다음: 리포트 (자동 이동)")).toBeInTheDocument();

    expect(await screen.findByText(`리포트 ${run.id}`, {}, { timeout: 15000 })).toBeInTheDocument();
  }, 20000);

  it("P17 에서 자동 비교를 고른 재테스트는 끝나면 리포트 대신 P18 로 이동한다", async () => {
    const run = await startRun(["order"]);
    useRetestStore
      .getState()
      .register(run.id!, { baseRunId: "base-run", name: "", note: "", autoCompare: true });
    let current = await getPersonaRun();
    for (let i = 0; i < 30 && current.stage !== "analyzing"; i += 1)
      current = await getPersonaRun();
    renderWithProviders(
      <Routes>
        <Route element={<ProjectRoute />}>
          <Route path={ROUTES.testRun.path} element={<TestRunPage />} />
          <Route path={ROUTES.report.path} element={<ReportProbe />} />
          <Route path={ROUTES.retest.path} element={<RetestProbe />} />
        </Route>
      </Routes>,
      { route: `/projects/1/runs/${run.id}` },
    );

    expect(
      await screen.findByText(`비교 base-run ${run.id}`, {}, { timeout: 15000 }),
    ).toBeInTheDocument();
    /* 한 번 이동하면 다시 이동하지 않게 끕니다 */
    expect(useRetestStore.getState().byRunId[run.id!].autoCompare).toBe(false);
  }, 20000);

  it("끝나면 결과를 요약하고 리포트로 연결한다", async () => {
    const run = await startRun(["order"]);
    await advance(20);
    renderRun(run.id!);

    expect(await screen.findByText("실행이 끝났어요")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "리포트 보기" })).toHaveAttribute(
      "href",
      `/projects/1/runs/${run.id}/report`,
    );
  });

  it("E05 — 실행이 실패하면 서버 오류 문구와 끝난 세션 수를 보여준다", async () => {
    serveRun(
      {
        status: "failed",
        phase: "failed",
        error: { code: "ALL_TASKS_FAILED", message: "모든 과업이 실패했어요" },
      },
      [session(1, { status: "agent_failure", reason: "접속 불가 · 응답 시간 초과 3회" })],
    );
    renderRun("fixed-run");

    expect(
      await screen.findByRole("heading", { name: "실행을 끝내지 못했어요" }),
    ).toBeInTheDocument();
    expect(screen.getByText("모든 과업이 실패했어요 · 끝난 세션 0 / 1")).toBeInTheDocument();
    expect(screen.getByText("실패")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "다시 시도" })).toHaveAttribute(
      "href",
      "/projects/1/tests/new",
    );
  });
  it("진행 중이면 중지할 수 있고, 중지한 실행은 중지됨으로 보여준다", async () => {
    const user = userEvent.setup();
    let cancelled = 0;
    serveRun({}, [session(1)]);
    server.use(
      http.post("*/api/v1/runs/:runId/cancel", () => {
        cancelled += 1;
        return HttpResponse.json({}, { status: 202 });
      }),
    );
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { unmount } = renderRun("fixed-run");

    await user.click(await screen.findByRole("button", { name: "중지" }));
    expect(cancelled).toBe(1);
    unmount();

    serveRun({ status: "cancelled", phase: "cancelled" }, [session(1, { status: "cancelled" })]);
    renderRun("fixed-run");
    expect(await screen.findByRole("heading", { name: "테스트를 중지했어요" })).toBeInTheDocument();
    expect(screen.getByText("중지됨")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "중지" })).not.toBeInTheDocument();
  });
  it("행동·시간 한도에 닿은 세션은 한도 도달로 표시하고 오류로 센다", async () => {
    serveRun({}, [
      session(1, { status: "budget_exceeded", steps: 35 }),
      session(2, {
        persona: { code: "P-002", segment_id: "segment_2", segment_name: "꼼꼼한 비교형" },
      }),
    ]);
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
      "/projects/1/tests",
    );
  });
  it("받아 둔 실행이 있을 때 다시 받기에 실패하면 화면은 두고 다시 시도를 안내한다", async () => {
    serveRun({}, [session(1)]);
    const { queryClient } = renderRun("fixed-run");
    await screen.findByRole("list", { name: "세션" });

    server.use(http.get("*/api/v1/runs/:runId/sessions", () => HttpResponse.error()));
    await queryClient
      .refetchQueries({ queryKey: ["runs", "sessions", "fixed-run"] })
      .catch(() => {});

    expect(await screen.findByText(/최신 상태를 불러오지 못했어요/)).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "세션" })).toBeInTheDocument();
  });
  it("세션 라이브에서 돌아와도 고른 과업을 유지한다", async () => {
    const user = userEvent.setup();
    serveRun({}, [session(1), session(2, { task_id: "coupon" })]);
    renderRun("fixed-run");

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
