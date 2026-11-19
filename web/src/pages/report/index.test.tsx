import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, onTestFinished } from "vitest";

import { confirmPersonaRun, discoverPersonaPlan } from "@/apis/persona.api";
import { buildPath, ROUTES } from "@/constants/routes";
import { reportErrorHandlers, runDetailOf } from "@/mocks/handlers/reports";
import { server } from "@/mocks/node";
import { finishPersonaMock, runList } from "@/mocks/personaMock";
import { useDemoSessionStore } from "@/stores/useDemoSessionStore";
import { useRunTaskNamesStore } from "@/stores/useRunTaskNamesStore";
import { renderWithProviders } from "@/test/renderWithProviders";
import type { RunReport } from "@/types/report.type";

import ReportPage from "./index";
import { cannedReport, orderTask } from "./reportFixture";

/* 기본은 첫 과업(order)으로 엽니다. 주소에 과업이 없을 때(전체)를 보려면 search 에 "" 를 넘깁니다 */
function renderReport(runId: string, search = "?task=order") {
  return renderWithProviders(<ReportPage />, {
    route: `${buildPath("report", { projectId: "1", runId })}${search}`,
    path: ROUTES.report.path,
  });
}

async function startRun(features = ["shopping", "coupon"], tasks = ["order", "coupon"]) {
  const plan = await discoverPersonaPlan({ variant: "problem" });
  return confirmPersonaRun({
    plan_id: plan.plan_id,
    feature_ids: features,
    task_ids: tasks,
    ages: ["any"],
    context: "",
    additional_request: "",
  });
}

/* mock 은 조회할 때마다 진행하므로 테스트에서는 끝까지 바로 돌립니다 */
async function completeRun() {
  await startRun();
  return finishPersonaMock().id!;
}

/* 리포트가 아직 없다고(404) 답합니다 */
function noReportYet() {
  server.use(
    http.get("*/api/v1/runs/:runId/reports", () =>
      HttpResponse.json(
        { error: { code: "NOT_FOUND", message: "이 실행의 리포트가 아직 없습니다.", fields: {} } },
        { status: 404 },
      ),
    ),
  );
}

/* mock 의 실행 상태(GET /api/v1/runs/{id})를 그대로 만들어 일부만 바꿀 때 씁니다 */
function mockRunDetail(runId: string) {
  return runDetailOf(runList({ progress: false }).find((item) => item.id === runId)!);
}

/* 정해 둔 리포트를 돌려줍니다 (실행 상태는 mock 실행 목록을 그대로 씀) */
function serveReport(report: RunReport = cannedReport()) {
  server.use(http.get("*/api/v1/runs/:runId/reports", () => HttpResponse.json(report)));
}

describe("P12 리포트 (GET /api/v1/runs/{id}/reports)", () => {
  it("끝난 실행의 리포트를 받아 첫 과업과 차수를 제목으로 보여준다", async () => {
    const runId = await completeRun();
    renderReport(runId);

    expect(
      await screen.findByRole("heading", { level: 1, name: "첫 주문 · 1차" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/AI 고객 \d+명 × 반복 \d+회/)).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "예측 단계별 이동" })).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "과업" })).toHaveTextContent("쿠폰");
  });

  it("요약 4칸: 반복별 달성률 범위·최대 이탈 구간·중앙 소요 시간·기록 방문", async () => {
    serveReport();
    renderReport(await completeRun());

    expect(await screen.findByText("45~55%")).toBeInTheDocument();
    expect(screen.getByText("완료 30명 / 58명 · 반복 합계")).toBeInTheDocument();
    /* 가입 단계에서 14명이 떠남 (장바구니 44명 대비 32%) */
    expect(screen.getByText("장바구니 → 가입")).toBeInTheDocument();
    expect(screen.getByText("이 구간 이탈 14명 · 32%")).toBeInTheDocument();
    expect(screen.getByText("중앙 소요 시간").nextElementSibling).toHaveTextContent("1분 26초");
    expect(screen.getByText("기록 방문").nextElementSibling).toHaveTextContent("60/60개");
    expect(screen.getByText("기술 실패 2 · 결과 없음 0")).toBeInTheDocument();
    /* 머리말 설명: 세션 목록의 페르소나 20명 × 시드 3회 */
    expect(screen.getByText("11월 7일 · AI 고객 20명 × 반복 3회")).toBeInTheDocument();
  });

  it("예측 단계별 이동은 반복별 도달 범위와 유효 방문 대비 비율을 보여준다", async () => {
    serveReport();
    renderReport(await completeRun());

    const funnel = await screen.findByRole("table", { name: "예측 단계별 이동" });
    expect(within(funnel).getAllByRole("row")).toHaveLength(7);
    expect(within(funnel).getByRole("row", { name: /랜딩/ })).toHaveTextContent("19~20명");
    expect(within(funnel).getByRole("row", { name: /가입/ })).toHaveTextContent("9~11명 · 52%");
  });

  it("지나가지 않는 단계(가입 0명 뒤에 결제)는 단계별 이동·최대 이탈 구간에서 뺀다", async () => {
    serveReport();
    const user = userEvent.setup();
    renderReport(await completeRun());

    await user.click(await screen.findByRole("radio", { name: "쿠폰으로 주문" }));

    const funnel = screen.getByRole("table", { name: "예측 단계별 이동" });
    expect(within(funnel).getAllByRole("row")).toHaveLength(6);
    expect(within(funnel).queryByRole("row", { name: /가입/ })).not.toBeInTheDocument();
    expect(screen.getByText("상세 → 장바구니")).toBeInTheDocument();
    /* 이 과업은 세그먼트 기록이 없어 히트맵과 섹션 이동 항목을 숨깁니다 */
    expect(screen.queryByRole("heading", { name: "세그먼트 × 이탈 구간" })).not.toBeInTheDocument();
    expect(
      within(screen.getByRole("navigation", { name: "리포트 영역" })).queryByRole("link", {
        name: "히트맵",
      }),
    ).not.toBeInTheDocument();
  });

  it("원인은 주 원인으로 떠난 방문이 있는 것만, 3종 먼저 보여주고 더 보기로 펼친다", async () => {
    serveReport();
    const user = userEvent.setup();
    renderReport(await completeRun());

    const causes = await screen.findByRole("table", { name: "이탈 원인 분포" });
    expect(within(causes).getAllByRole("row")).toHaveLength(3);
    expect(causes).toHaveTextContent("입력 부담50% · 14명");

    await user.click(screen.getByRole("button", { name: "원인 1종 더 보기" }));
    expect(within(causes).getAllByRole("row")).toHaveLength(4);
    /* 주 원인으로 떠난 세션이 없는 원인(가치 불명확)은 넣지 않습니다 */
    expect(causes).not.toHaveTextContent("가치 불명확");
  });

  it("세그먼트 × 이탈 구간: 최다 칸을 한 줄로 보여주고 펼치면 표가 나온다", async () => {
    serveReport();
    const user = userEvent.setup();
    renderReport(await completeRun());

    expect(await screen.findByText("최다: 알뜰 탐색형 장바구니 9명")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "세그먼트 2개 더 보기" }));

    const table = screen.getByRole("table", { name: "세그먼트 × 이탈 구간 히트맵" });
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((cell) => cell.textContent),
    ).toEqual(["세그먼트", "랜딩", "탐색", "상세", "장바구니", "가입", "결제 정보", "완료"]);
    expect(within(table).getByRole("row", { name: /바쁜 직장인/ })).toHaveTextContent("2355000");
  });

  it("기술 실패 방문과 결과 해석의 한계를 실행 전체 기준으로 아래에 보여준다", async () => {
    serveReport();
    renderReport(await completeRun());

    const failures = await screen.findByRole("region", { name: "기술 실패 · 한도 초과" });
    expect(failures).toHaveTextContent("P-007 · 반복 2");
    expect(failures).toHaveTextContent("첫 주문");
    expect(failures).toHaveTextContent("화면을 읽지 못했어요");
    /* 행을 누르면 그 세션 상세(E06)로 갑니다 */
    expect(within(failures).getByRole("link", { name: /P-007 · 반복 2/ })).toHaveAttribute(
      "href",
      expect.stringMatching(/\/runs\/[^/]+\/sessions\/order\/2\/P-007$/),
    );
    expect(screen.getByRole("list", { name: "결과 해석의 한계" })).toHaveTextContent(
      "실제 사용자 이탈률이 아닙니다",
    );
  });

  it("v1 리포트에 없는 개선 Top 3·실제 고객 데이터 비교는 보여주지 않는다", async () => {
    serveReport();
    renderReport(await completeRun());

    await screen.findByRole("table", { name: "예측 단계별 이동" });
    expect(screen.queryByRole("heading", { name: /개선 Top 3/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/실제 고객 데이터 비교/)).not.toBeInTheDocument();
  });

  it("P17 — 같은 확정 계획으로 재테스트를 시작하고 새 실행 화면으로 간다", async () => {
    const user = userEvent.setup();
    const created: { body: unknown; key: string | null }[] = [];
    serveReport();
    server.use(
      http.get("*/api/v1/plan-revisions/:id", () =>
        HttpResponse.json({
          plan_revision_id: "plan-revision-1",
          plan_id: "plan-1",
          plan_revision: 1,
          confirmed_at: "2026-11-07T00:00:00Z",
          persona_generator: "",
          data: {
            personas: Array.from({ length: 20 }, (_, i) => ({
              code: `P-${String(i + 1).padStart(3, "0")}`,
            })),
            limits: { seed_count: 3 },
            tasks: [{ id: "order", name: "첫 주문" }],
          },
        }),
      ),
      http.post("*/api/v1/runs", async ({ request }) => {
        created.push({ body: await request.json(), key: request.headers.get("Idempotency-Key") });
        return HttpResponse.json(
          { run_id: "run-new", status: "queued", status_url: "/api/v1/runs/run-new" },
          { status: 202 },
        );
      }),
    );
    const runId = await completeRun();
    renderReport(runId);

    await user.click(await screen.findByRole("button", { name: "수정 후 재테스트" }));
    const dialog = screen.getByRole("dialog", { name: "수정 후 재테스트" });
    expect(await within(dialog).findByText("1차와 동일 · P-001~P-020")).toBeInTheDocument();
    expect(within(dialog).getByText("1차와 동일 · 3회")).toBeInTheDocument();
    /* BE 이름 규칙(가장 큰 차수 + 1 · 과업 이름)으로 시작하면 붙을 이름을 보여 줍니다 */
    const name = within(dialog).getByRole("textbox", { name: "테스트 이름" });
    expect(name).toHaveValue("2차·첫 주문 (재테스트)");
    expect(name).toHaveAttribute("readonly");
    await user.type(
      within(dialog).getByRole("textbox", { name: /무엇을 고쳤나요/ }),
      "가입 입력 줄임",
    );
    await user.click(within(dialog).getByRole("button", { name: "재테스트 시작" }));

    /* 시작하면 모달을 닫고 새 실행 화면(P08)으로 이동합니다 (이 테스트는 리포트 경로만 그려 화면이 비워짐) */
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(created).toHaveLength(1);
    expect(created[0].body).toEqual({
      plan_revision_id: "plan-revision-1",
      /* 이 리포트의 실행을 이전 실행으로 남깁니다 */
      base_run_id: runId,
      change_note: "가입 입력 줄임",
    });
    expect(created[0].key).toBeTruthy();
    /* 새 실행 화면이 쓸 과업 이름을 확정 계획에서 남깁니다 */
    expect(useRunTaskNamesStore.getState().byRunId["run-new"]).toEqual({ order: "첫 주문" });
  });

  it("주소의 ?task= 로 과업을 고르고, 과업 칩으로 바꾼다", async () => {
    serveReport();
    const user = userEvent.setup();
    renderReport(await completeRun(), "?task=coupon");

    expect(
      await screen.findByRole("heading", { level: 1, name: "쿠폰으로 주문 · 1차" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "첫 주문" }));
    expect(screen.getByRole("heading", { level: 1, name: "첫 주문 · 1차" })).toBeInTheDocument();
  });

  it("주소에 과업이 없으면 기본으로 과업 전체를 이탈 많은 순 카드로 비교하고, 카드를 누르면 그 과업으로 간다", async () => {
    serveReport();
    const user = userEvent.setup();
    renderReport(await completeRun(), "");

    expect(
      await screen.findByRole("heading", { level: 1, name: "전체 과업 · 1차" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "전체" })).toHaveAttribute("aria-checked", "true");
    /* 실행 전체 기준 요약: 이탈이 있었던 과업 수 · 전체 달성률(summary) · 기록 세션 */
    expect(screen.getByText(/에서 이탈이 있었어요/)).toHaveTextContent("2개 과업 중 2개에서");
    expect(screen.getByText("59%")).toBeInTheDocument();
    expect(screen.getByText("120/120")).toBeInTheDocument();
    /* 이탈 많은 순: 첫 주문(28) → 쿠폰으로 주문(20) */
    const cards = within(screen.getByRole("list", { name: "과업별 결과" })).getAllByRole("button");
    expect(cards.map((card) => card.getAttribute("aria-label"))).toEqual([
      "첫 주문 리포트 보기",
      "쿠폰으로 주문 리포트 보기",
    ]);
    expect(within(cards[1]).getByText("65~70%")).toBeInTheDocument();
    expect(within(cards[1]).getByText("이탈 20")).toBeInTheDocument();
    /* 퍼널·히트맵은 과업마다 단계가 달라 전체에서는 보이지 않습니다 */
    expect(screen.queryByRole("navigation", { name: "리포트 영역" })).not.toBeInTheDocument();

    await user.click(cards[1]);
    expect(
      screen.getByRole("heading", { level: 1, name: "쿠폰으로 주문 · 1차" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "쿠폰으로 주문" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("과업을 보다가 전체 칩을 고르면 과업 전체 비교로 바꾼다", async () => {
    serveReport();
    const user = userEvent.setup();
    renderReport(await completeRun(), "?task=order");

    expect(
      await screen.findByRole("heading", { level: 1, name: "첫 주문 · 1차" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "전체" }));
    expect(screen.getByRole("heading", { level: 1, name: "전체 과업 · 1차" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "과업별 결과" })).toBeInTheDocument();
  });

  it("주소의 과업 id 를 모르면 첫 과업으로 연다", async () => {
    serveReport();
    renderReport(await completeRun(), "?task=unknown");

    expect(
      await screen.findByRole("heading", { level: 1, name: "첫 주문 · 1차" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "첫 주문" })).toHaveAttribute("aria-checked", "true");
  });

  it("과업이 하나뿐이면 전체 칩을 보여 주지 않는다", async () => {
    serveReport(cannedReport([orderTask()]));
    renderReport(await completeRun(), "?task=all");

    expect(
      await screen.findByRole("heading", { level: 1, name: "첫 주문 · 1차" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "전체" })).not.toBeInTheDocument();
  });

  it("실행 선택(P12c)에서 다른 완료 실행으로 이동하고, 진행 중 실행은 고를 수 없다", async () => {
    const first = await completeRun();
    await completeRun();
    await startRun();
    const user = userEvent.setup();
    renderReport(first);

    await user.click(await screen.findByRole("button", { name: /1차 · .* · 완료/ }));
    const menu = screen.getByRole("menu", { name: "실행 선택" });
    expect(within(menu).getAllByRole("menuitemradio")).toHaveLength(3);
    expect(within(menu).getByRole("menuitemradio", { name: /3차/ })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await user.click(within(menu).getByRole("menuitemradio", { name: /2차/ }));

    /* 다른 실행은 과업 선택 없이 열리므로 기본인 과업 전체로 엽니다 */
    expect(
      await screen.findByRole("heading", { level: 1, name: "전체 과업 · 2차" }),
    ).toBeInTheDocument();
  });

  it("없는 실행이면 E18 을 보여준다", async () => {
    renderReport("mock-run-999");

    expect(
      await screen.findByRole("heading", { name: "실행 기록을 찾을 수 없어요" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "테스트 목록 보기" })).toHaveAttribute(
      "href",
      "/projects/1/tests",
    );
  });

  it("아직 끝나지 않은 실행이면 실행 화면으로 안내하고, 끝나면 리포트를 다시 받는다", async () => {
    const run = await startRun();
    renderReport(run.id!);

    expect(
      await screen.findByRole("heading", { name: "아직 끝나지 않은 테스트예요" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "실행 화면 보기" })).toHaveAttribute(
      "href",
      `/projects/1/runs/${run.id}`,
    );

    finishPersonaMock();
    expect(
      await screen.findByRole("heading", { level: 1, name: "첫 주문 · 1차" }, { timeout: 4000 }),
    ).toBeInTheDocument();
  });

  it("실패·취소로 끝난 실행은 리포트가 없다고 알린다", async () => {
    const runId = await completeRun();
    noReportYet();
    server.use(
      http.get("*/api/v1/runs/:runId", () =>
        HttpResponse.json({ ...mockRunDetail(runId), status: "failed", phase: "failed" }),
      ),
    );
    renderReport(runId);

    expect(
      await screen.findByRole("heading", { name: "이 실행에는 리포트가 없어요" }),
    ).toBeInTheDocument();
  });

  it("끝난 실행인데 리포트가 아직 없으면 만드는 중이라고 알리고 다시 받을 수 있다", async () => {
    const runId = await completeRun();
    noReportYet();
    const user = userEvent.setup();
    renderReport(runId);

    expect(
      await screen.findByRole("heading", { name: "리포트를 만들고 있어요" }),
    ).toBeInTheDocument();
    server.resetHandlers();
    await user.click(screen.getByRole("button", { name: "다시 시도" }));

    expect(
      await screen.findByRole("heading", { level: 1, name: "첫 주문 · 1차" }),
    ).toBeInTheDocument();
  });

  it("로그인하지 않았으면(401) 로그인 창을 열 수 있고, 남의 프로젝트(403)면 권한이 없다고 알린다", async () => {
    const runId = await completeRun();
    server.use(reportErrorHandlers.reportUnauthorized);
    const user = userEvent.setup();
    const { unmount } = renderReport(runId);

    await user.click(await screen.findByRole("button", { name: "로그인" }));
    expect(useDemoSessionStore.getState().dialog).toBe("login");
    unmount();

    server.use(reportErrorHandlers.reportForbidden);
    renderReport(runId);
    expect(
      await screen.findByRole("heading", { name: "이 리포트를 볼 권한이 없어요" }),
    ).toBeInTheDocument();
  });

  it("불러오지 못하면 E20 을 보여주고 다시 시도할 수 있다", async () => {
    const runId = await completeRun();
    server.use(reportErrorHandlers.reportNetworkError);
    const user = userEvent.setup();
    renderReport(runId);

    const retry = await screen.findByRole("button", { name: "다시 시도" }, { timeout: 3000 });
    server.resetHandlers();
    await user.click(retry);

    expect(
      await screen.findByRole("heading", { level: 1, name: "첫 주문 · 1차" }),
    ).toBeInTheDocument();
  });

  it("과업 결과가 없어도 빈 화면이 아니라 안내와 실행 전체 기록을 보여준다", async () => {
    serveReport(cannedReport([]));
    renderReport(await completeRun());

    expect(
      await screen.findByRole("heading", { name: "이 실행에는 과업 결과가 없어요" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "기술 실패 · 한도 초과" })).toBeInTheDocument();
  });

  it("유효 방문이 없으면 달성률을 지어내지 않는다", async () => {
    serveReport(
      cannedReport([
        orderTask({
          valid_sessions: 0,
          success: 0,
          dropout: 0,
          seed_ranges: {
            success: { min: 0, max: 0 },
            dropout: { min: 0, max: 0 },
            achievement_rate: { min: 0, max: 0 },
          },
        }),
      ]),
    );
    renderReport(await completeRun());

    expect(await screen.findByText("완료 0명 / 0명 · 반복 합계")).toBeInTheDocument();
    expect(screen.getByText("목표 달성률").nextElementSibling).toHaveTextContent("—");
  });
});

describe("P12 리포트 · 화면 둘러보기 (GET /api/v1/reports/{id}/screens)", () => {
  const friction = (category: string, name: string, sessions: number, dropouts: number) => ({
    category,
    name,
    sessions,
    dropouts,
    detail: category === "input_burden" ? "필수 입력 8칸 (허용 4칸)" : "",
    screenshot_url: `/api/v1/observations/${sessions}/screenshot`,
  });
  const screens = (reportId: string) => ({
    report_id: reportId,
    available: true,
    reason: null,
    message: null,
    note: "",
    tasks: [
      {
        task_id: "order",
        name: "첫 주문",
        valid_sessions: 12,
        screens: [
          {
            screen_id: "/",
            name: "첫 화면",
            order: 0,
            reached: 12,
            dropouts_here: 0,
            is_goal: false,
            screenshot_url: "/api/v1/observations/1/screenshot",
            frictions: [],
            friction_sessions: 0,
          },
          {
            screen_id: "/cart",
            name: "장바구니",
            order: 1,
            reached: 11,
            dropouts_here: 1,
            is_goal: false,
            screenshot_url: "/api/v1/observations/2/screenshot",
            frictions: [friction("cost", "비용 충격", 5, 1)],
            friction_sessions: 5,
          },
          {
            screen_id: "/signup",
            name: "회원가입",
            order: 2,
            reached: 10,
            dropouts_here: 7,
            is_goal: false,
            screenshot_url: "/api/v1/observations/3/screenshot",
            frictions: [friction("input_burden", "입력 부담", 9, 7)],
            friction_sessions: 9,
          },
        ],
        problems: [
          {
            screen_id: "/signup",
            name: "회원가입",
            screenshot_url: "/api/v1/observations/3/screenshot",
            reached: 10,
            dropouts_here: 7,
            friction_sessions: 9,
            top: [friction("input_burden", "입력 부담", 9, 7)],
          },
          {
            screen_id: "/cart",
            name: "장바구니",
            screenshot_url: "/api/v1/observations/2/screenshot",
            reached: 11,
            dropouts_here: 1,
            friction_sessions: 5,
            top: [friction("cost", "비용 충격", 5, 1)],
          },
        ],
        causes: [
          {
            category: "input_burden",
            name: "입력 부담",
            sessions: 9,
            dropouts: 7,
            screens: [
              {
                screen_id: "/signup",
                name: "회원가입",
                sessions: 9,
                screenshot_url: "/api/v1/observations/3/screenshot",
              },
            ],
          },
          {
            category: "cost",
            name: "비용 충격",
            sessions: 5,
            dropouts: 1,
            screens: [
              {
                screen_id: "/cart",
                name: "장바구니",
                sessions: 5,
                screenshot_url: "/api/v1/observations/2/screenshot",
              },
            ],
          },
        ],
      },
    ],
  });

  it("실제 화면 캡처를 넘겨 보고, 화면마다 도달·이탈과 감지된 불편한 점을 보여 준다", async () => {
    server.use(
      http.get("*/api/v1/reports/:reportId/screens", ({ params }) =>
        HttpResponse.json(screens(String(params.reportId))),
      ),
    );
    const user = userEvent.setup();
    serveReport();
    renderReport(await completeRun());

    const walkthrough = await screen.findByRole("region", { name: "화면 둘러보기" });
    expect(within(walkthrough).getByRole("img", { name: "첫 화면 화면 캡처" })).toHaveAttribute(
      "src",
      expect.stringContaining("/api/v1/observations/1/screenshot"),
    );
    expect(
      within(walkthrough).getByText("이 화면에서 감지된 불편한 점이 없어요"),
    ).toBeInTheDocument();

    await user.click(within(walkthrough).getByRole("button", { name: "다음 화면" }));
    await user.click(within(walkthrough).getByRole("button", { name: "다음 화면" }));
    expect(
      within(walkthrough).getByText("도달 10회 방문 · 여기서 이탈 7회 방문"),
    ).toBeInTheDocument();
    expect(within(walkthrough).getByText("입력 부담 · 9회 방문")).toBeInTheDocument();
    expect(within(walkthrough).getByText("필수 입력 8칸 (허용 4칸)")).toBeInTheDocument();
    expect(within(walkthrough).getByRole("button", { name: "회원가입 화면 보기" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    /* 문제가 있었던 화면: 마찰이 많은 순서, 누르면 그 화면으로 */
    const problems = screen.getByRole("region", { name: "문제가 있었던 화면" });
    const cards = within(problems)
      .getAllByRole("listitem")
      .map((item) => within(item).getByRole("button"));
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveTextContent("회원가입/signup입력 부담 · 9회 방문이탈 7");
    expect(cards[1]).toHaveTextContent("장바구니/cart비용 충격 · 5회 방문이탈 1");
    await user.click(cards[1]);
    expect(within(walkthrough).getByRole("button", { name: "장바구니 화면 보기" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("원인 분포는 감지된 불편한 점(모든 방문)이 기본이고 이탈 원인으로 바꿀 수 있다", async () => {
    server.use(
      http.get("*/api/v1/reports/:reportId/screens", ({ params }) =>
        HttpResponse.json(screens(String(params.reportId))),
      ),
    );
    const user = userEvent.setup();
    serveReport();
    renderReport(await completeRun());

    const list = await screen.findByRole("list", { name: "감지된 불편한 점 분포" });
    expect(within(list).getAllByRole("listitem")[0]).toHaveTextContent(
      "입력 부담9회 방문 · 이탈 7",
    );
    await user.click(screen.getByRole("button", { name: "이탈 원인 (이탈 방문만)" }));
    expect(screen.queryByRole("list", { name: "감지된 불편한 점 분포" })).not.toBeInTheDocument();
    expect(screen.getByRole("table", { name: "이탈 원인 분포" })).toBeInTheDocument();
  });

  it("캡처가 없는 예전·샘플 리포트는 화면 둘러보기를 숨기고 이탈 원인만 보여 준다", async () => {
    server.use(
      http.get("*/api/v1/reports/:reportId/screens", ({ params }) =>
        HttpResponse.json({
          report_id: params.reportId,
          available: false,
          reason: "NO_SCREENSHOTS",
          message: "",
          tasks: [],
          note: "",
        }),
      ),
    );
    serveReport();
    renderReport(await completeRun());
    expect(await screen.findByRole("table", { name: "이탈 원인 분포" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "화면 둘러보기" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "이탈 원인 (이탈 방문만)" }),
    ).not.toBeInTheDocument();
  });
});

describe("P20 공유 링크", () => {
  it("쓸 수 있는 링크가 없으면 만들고, 다시 열면 같은 링크를 쓴다", async () => {
    let created = 0;
    const runId = await completeRun();
    const user = userEvent.setup();
    renderReport(runId, "?task=order");
    const count = ({ request }: { request: Request }) => {
      if (request.method === "POST" && request.url.includes("/share-links")) created += 1;
    };
    server.events.on("request:start", count);
    onTestFinished(() => server.events.removeListener("request:start", count));

    await user.click(await screen.findByRole("button", { name: "공유 링크 복사" }));
    const dialog = screen.getByRole("dialog", { name: "공유 링크" });
    const link = await within(dialog).findByRole("textbox", { name: "링크" });
    expect(link).toHaveValue(`${window.location.origin}/share/mock-share-1?task=order`);

    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "공유 링크 복사" }));
    expect(
      await within(screen.getByRole("dialog", { name: "공유 링크" })).findByRole("textbox", {
        name: "링크",
      }),
    ).toHaveValue(`${window.location.origin}/share/mock-share-1?task=order`);
    expect(created).toBe(1);
  });
});
