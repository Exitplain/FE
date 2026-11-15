import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { confirmPersonaRun, discoverPersonaPlan, getPersonaRun } from "@/apis/persona.api";
import { queryKeys } from "@/apis/queryKeys";
import { buildPath, ROUTES } from "@/constants/routes";
import { personaErrorHandlers } from "@/mocks/handlers/personas";
import { server } from "@/mocks/node";
import { finishPersonaMock } from "@/mocks/personaMock";
import { useRetestStore } from "@/stores/useRetestStore";
import { renderWithProviders } from "@/test/renderWithProviders";
import type { DropCause, PersonaReport, ReportActual } from "@/types/persona.type";

import ReportPage from "./index";

function renderReport(runId: string, search = "") {
  return renderWithProviders(<ReportPage />, {
    route: `${buildPath("report", { projectId: "banchan", runId })}${search}`,
    path: ROUTES.report.path,
  });
}

async function startRun(features: string[], tasks: string[]) {
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
async function completeRun(features = ["shopping", "coupon"], tasks = ["order", "coupon"]) {
  await startRun(features, tasks);
  return finishPersonaMock().id!;
}

describe("P12 리포트", () => {
  it("첫 과업의 요약·예측 퍼널·원인·개선 Top 3 를 보여준다", async () => {
    const runId = await completeRun();
    renderReport(runId);

    expect(
      await screen.findByRole("heading", { level: 1, name: "첫 주문 · 1차" }),
    ).toBeInTheDocument();
    /* 패널 20명 · 시드 3회 · 최근 보정(11월 5일) */
    expect(screen.getByText(/20명 × 시드 3회 · 보정 11월 5일/)).toBeInTheDocument();
    /* 시드별 완료자 중앙 소요 시간의 범위 */
    expect(screen.getByText("완료자 중앙 소요 시간").nextElementSibling).toHaveTextContent(
      "1분 26초~1분 35초",
    );

    /* 퍼널 마지막 도달 8~13명 / 첫 단계 20명 */
    expect(screen.getByText("40~65%")).toBeInTheDocument();
    expect(screen.getByText("완료 8~13명 / 20명")).toBeInTheDocument();
    /* 가입 단계 이탈이 가장 많음 → 직전 단계(장바구니)에서 가입으로 가는 구간 */
    expect(screen.getByText("장바구니 → 가입")).toBeInTheDocument();

    const funnel = screen.getByRole("table", { name: "예측 퍼널" });
    expect(within(funnel).getAllByRole("row")).toHaveLength(6);
    expect(within(funnel).getByRole("row", { name: /첫 화면/ })).toHaveTextContent("20명 (100%)");
    expect(within(funnel).getByRole("row", { name: /가입/ })).toHaveTextContent(
      "10~15명 · 이탈 5~8",
    );

    expect(screen.getByRole("table", { name: "이탈 원인 분포" })).toHaveTextContent(
      "입력 부담80%비용 충격20%",
    );

    const issue = screen.getByRole("button", { name: /입력 부담 · 가입 단계/ });
    expect(issue).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("캡처된 근거 화면이 없어요")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "세션 8개 전체 보기" })).toHaveAttribute(
      "href",
      buildPath("sessionDetail", { projectId: "banchan", runId, sessionId: "P-001_order" }),
    );
  });

  it("세그먼트 × 이탈 구간: 최다 구간을 한 줄로 보여주고 펼치면 히트맵 표가 나온다", async () => {
    const runId = await completeRun();
    renderReport(runId);

    const section = await screen.findByRole("region", { name: "세그먼트 × 이탈 구간" });
    /* 빠른 구매형이 장바구니 → 가입 구간에서 가장 많이 떠남 (상한 기준) */
    expect(section).toHaveTextContent("최다: 빠른 구매형 장바구니→가입 5명");

    await userEvent.click(within(section).getByRole("button", { name: "세그먼트 4개 더 보기" }));
    const table = within(section).getByRole("table", { name: "세그먼트 × 이탈 구간 히트맵" });
    expect(within(table).getAllByRole("columnheader")).toHaveLength(6);
    expect(within(table).getAllByRole("row")).toHaveLength(5);
    expect(within(table).getByRole("row", { name: /빠른 구매형/ })).toHaveTextContent(
      "빠른 구매형002~500",
    );

    await userEvent.click(within(section).getByRole("button", { name: "접기" }));
    expect(within(section).queryByRole("table")).not.toBeInTheDocument();
  });

  it("공유 링크 복사(P20): 모달에서 읽기 전용 링크를 복사한다", async () => {
    const user = userEvent.setup();
    const runId = await completeRun();
    renderReport(runId);

    await user.click(await screen.findByRole("button", { name: "공유 링크 복사" }));
    const dialog = screen.getByRole("dialog", { name: "공유 링크" });
    const link = within(dialog).getByRole("textbox", { name: "링크" });
    expect(link).toHaveValue(`${window.location.origin}/share/${runId}?task=order`);

    await user.click(within(dialog).getByRole("button", { name: "복사" }));
    expect(await navigator.clipboard.readText()).toBe(
      `${window.location.origin}/share/${runId}?task=order`,
    );
  });

  it("목업 비교(P12b): 관측 화면과 개선 목업이 없으면 만들지 않고 없다고 보여준다", async () => {
    const runId = await completeRun();
    renderReport(runId);

    await userEvent.click(await screen.findByRole("button", { name: "목업 비교" }));
    const dialog = screen.getByRole("dialog", { name: "현재 화면과 개선 가설 비교" });
    expect(dialog).toHaveTextContent("Top 3 · 1 입력 부담 · 가입 단계");
    expect(dialog).toHaveTextContent("캡처된 관측 화면이 없어요");
    expect(dialog).toHaveTextContent("아직 만든 개선 목업이 없어요");
    expect(within(dialog).getByRole("button", { name: "크게 보기" })).toBeDisabled();

    /* 아래 "닫기" 버튼 (오른쪽 위 X 아이콘도 이름이 "닫기") */
    await userEvent.click(within(dialog).getAllByRole("button", { name: "닫기" })[0]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("수정 후 재테스트(P17): 같은 과업·타겟으로 개선 버전을 실행하고 비교 대상을 기억한다", async () => {
    const user = userEvent.setup();
    useRetestStore.setState({ byRunId: {} });
    const runId = await completeRun();
    renderReport(runId);

    await user.click(await screen.findByRole("button", { name: "수정 후 재테스트" }));
    const dialog = screen.getByRole("dialog", { name: "수정 후 재테스트" });
    expect(within(dialog).getByLabelText("테스트 이름")).toHaveValue(
      "첫 주문 외 1개 · 2차 (재테스트)",
    );
    expect(dialog).toHaveTextContent("패널1차와 동일 · P-001~P-020");
    expect(dialog).toHaveTextContent("시드1차와 동일 · 3회");
    expect(dialog).toHaveTextContent("보정ON · 보정 적용됨(11월 5일)");
    expect(
      within(dialog).getByRole("checkbox", { name: "끝나면 1차와 자동으로 비교하기" }),
    ).toBeChecked();

    await user.type(within(dialog).getByLabelText(/무엇을 고쳤나요/), "가입 필수 입력 줄임");
    await user.click(within(dialog).getByRole("button", { name: "재테스트 시작" }));

    const run = await getPersonaRun();
    expect(run).toMatchObject({ status: "running", variant: "fixed" });
    expect(run.tasks.map((task) => task.id)).toEqual(["order", "coupon"]);
    expect(useRetestStore.getState().byRunId[run.id!]).toEqual({
      baseRunId: runId,
      name: "첫 주문 외 1개 · 2차 (재테스트)",
      note: "가입 필수 입력 줄임",
      autoCompare: true,
    });
  });

  it("재테스트는 실행 중인 테스트가 있으면 시작하지 않고 알린다 · ?retest=1 이면 바로 연다", async () => {
    const user = userEvent.setup();
    const runId = await completeRun();
    await startRun(["shopping"], ["order"]);
    renderReport(runId, "?retest=1");

    const dialog = await screen.findByRole("dialog", { name: "수정 후 재테스트" });
    await user.click(within(dialog).getByRole("button", { name: "재테스트 시작" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "이미 실행 중인 테스트가 있어요",
    );
  });

  it("과업 칩으로 다른 과업 리포트로 바꾼다", async () => {
    const runId = await completeRun();
    renderReport(runId);

    await userEvent.click(await screen.findByRole("radio", { name: "쿠폰으로 주문" }));

    expect(
      screen.getByRole("heading", { level: 1, name: "쿠폰으로 주문 · 1차" }),
    ).toBeInTheDocument();
    /* 과업을 바꿔도 그 과업의 첫 문제가 펼쳐져 있어야 합니다 */
    expect(screen.getByRole("button", { name: /탐색 실패 · 장바구니 단계/ })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("주소의 ?task= 로 과업을 고른다", async () => {
    const runId = await completeRun();
    renderReport(runId, "?task=coupon");

    expect(
      await screen.findByRole("heading", { level: 1, name: "쿠폰으로 주문 · 1차" }),
    ).toBeInTheDocument();
  });

  it("기술 실패 세션은 따로 보여주고 이탈률 계산에서 뺐다고 알린다", async () => {
    const runId = await completeRun(["delivery"], ["delivery"]);
    renderReport(runId);

    const section = await screen.findByRole("region", { name: "기술 실패 · 한도 초과" });
    expect(section).toHaveTextContent("이탈률·원인 계산에서 제외");
    expect(section).toHaveTextContent("P-001");
    expect(section).toHaveTextContent("접속 불가 · 응답 시간 초과 3회");
  });

  it("실행 선택(P12c)에서 다른 완료 실행으로 이동하고, 진행 중 실행은 고를 수 없다", async () => {
    const first = await completeRun();
    const second = await completeRun();
    await startRun(["shopping"], ["order"]);
    renderReport(second);

    await userEvent.click(await screen.findByRole("button", { name: /2차 · .* · 완료/ }));
    const menu = screen.getByRole("menu", { name: "실행 선택" });

    expect(within(menu).getByRole("menuitemradio", { name: /2차/ })).toBeChecked();
    expect(within(menu).getByRole("menuitemradio", { name: /3차/ })).toHaveAttribute(
      "aria-disabled",
      "true",
    );

    await userEvent.click(within(menu).getByRole("menuitemradio", { name: /1차/ }));

    expect(
      await screen.findByRole("heading", { level: 1, name: "첫 주문 · 1차" }),
    ).toBeInTheDocument();
    expect(first).not.toBe(second);
  });

  it("없는 실행이면 E18 을 보여준다", async () => {
    renderReport("mock-run-없음");

    expect(
      await screen.findByRole("heading", { name: "실행 기록을 찾을 수 없어요" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "테스트 목록 보기" })).toHaveAttribute(
      "href",
      "/projects/banchan/tests",
    );
  });

  it("아직 끝나지 않은 실행이면 과거 결과 대신 실행 화면으로 안내한다", async () => {
    const run = await startRun(["shopping"], ["order"]);
    renderReport(run.id!);

    expect(
      await screen.findByRole("heading", { name: "아직 끝나지 않은 테스트예요" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "실행 화면 보기" })).toHaveAttribute(
      "href",
      buildPath("testRun", { projectId: "banchan", runId: run.id! }),
    );
  });

  it("불러오지 못하면 E20 을 보여주고 다시 시도할 수 있다", async () => {
    const runId = await completeRun();
    server.use(personaErrorHandlers.reportNetworkError);
    renderReport(runId);

    expect(
      await screen.findByRole("heading", { name: "리포트를 불러오지 못했어요" }, { timeout: 3000 }),
    ).toBeInTheDocument();

    server.resetHandlers();
    await userEvent.click(screen.getByRole("button", { name: "다시 시도" }));

    expect(
      await screen.findByRole("heading", { level: 1, name: "첫 주문 · 1차" }),
    ).toBeInTheDocument();
  });
});

/* mock 실행으로 만들기 어려운 응답(과업 없음·퍼널 없음·원인 여러 종·사람 관측)은 직접 돌려줍니다 */
function cannedReport(overrides: Partial<PersonaReport> = {}): PersonaReport {
  const finding = (id: string, category: DropCause, affected: number) => ({
    id,
    task_id: "order",
    stage: "signup" as const,
    category,
    title: "",
    affected_sessions: affected,
    task_sessions: 10,
    evidence: [],
    interpretation: "",
    recommendation: `${id} 개선안`,
    mockup: null,
  });
  return {
    schema_version: "test",
    run_id: "canned",
    created_at: "2026-11-07T03:00:00+00:00",
    target: "",
    variant: "fixed",
    audience: {},
    policy: "",
    model_calls: 0,
    summary: {
      sessions: 10,
      success: 4,
      simulated_dropout: 6,
      technical: 0,
      findings: 4,
      missing_evidence: 0,
    },
    tasks: [{ id: "order", name: "첫 주문", total: 10, success: 4, dropout: 6, technical: 0 }],
    findings: [
      finding("f1", "input_burden", 3),
      finding("f2", "cost", 1),
      finding("f3", "navigation", 1),
      finding("f4", "trust", 1),
    ],
    evidence: [],
    technical_failures: [],
    alignment: {
      participants: 3,
      observations: 3,
      metrics: {
        outcome: { matched: 2, total: 3 },
        stage: { matched: 2, total: 3 },
        cause: { matched: 1, total: 3 },
      },
      status: "partial",
    },
    limitations: ["테스트용 한계 문구"],
    ...overrides,
  };
}

/* 실측 비교는 과업마다 있어 첫 과업에 넣습니다 */
function withActual(actual: ReportActual) {
  const report = cannedReport();
  return { ...report, tasks: [{ ...report.tasks[0], actual }] };
}

function serveReport(report: PersonaReport) {
  server.use(http.get("*/api/personas/report", () => HttpResponse.json(report)));
}

describe("P12 리포트 — 응답 모양별", () => {
  it("퍼널이 없는 과업은 완료 / (전체 - 기술 실패) 로 달성률을 보여준다", async () => {
    serveReport(cannedReport());
    renderReport("canned");

    expect(await screen.findByText("40%")).toBeInTheDocument();
    expect(screen.getByText("완료 4명 / 10명")).toBeInTheDocument();
    expect(screen.getByText("이 과업은 단계별 예측 기록이 없어요.")).toBeInTheDocument();
    expect(screen.getByText("최대 이탈 구간").nextElementSibling).toHaveTextContent("이탈 없음");
  });

  it("예측에 이탈이 없으면 실측 비교도 최대 이탈 구간을 지어내지 않는다", async () => {
    serveReport(
      withActual({
        status: "comparable",
        mean_error_pp: 1.2,
        gap_stages: [],
        max_drop: { predicted: null, actual: ["product", "cart"] },
      }),
    );
    renderReport("canned");

    const summary = await screen.findByRole("region", { name: "실측 비교 요약" });
    expect(summary).toHaveTextContent("차이 구간없음");
    expect(summary).toHaveTextContent("최대 이탈 구간예측과 불일치");
    expect(summary).toHaveTextContent("예측 이탈 없음 · 실측 상품→장바구니");
  });

  it("세그먼트 칸 수가 퍼널 구간과 다르면 히트맵과 섹션 이동 항목을 숨긴다", async () => {
    const base = cannedReport().tasks[0];
    serveReport(
      cannedReport({
        tasks: [
          {
            ...base,
            funnel: [
              { stage: "landing", reached: [10, 10], dropout: [0, 0] },
              { stage: "cart", reached: [6, 6], dropout: [4, 4] },
            ],
            segments: [
              {
                id: "quick",
                name: "빠른 구매",
                dropouts: [
                  [1, 1],
                  [2, 2],
                ],
              },
            ],
          },
        ],
      }),
    );
    renderReport("canned");

    await screen.findByRole("heading", { level: 1, name: "첫 주문" });
    expect(screen.queryByRole("region", { name: "세그먼트 × 이탈 구간" })).not.toBeInTheDocument();
    expect(
      within(screen.getByRole("navigation", { name: "리포트 영역" })).queryByRole("link", {
        name: "히트맵",
      }),
    ).not.toBeInTheDocument();
  });

  it("원인이 4종 이상이면 3종만 먼저 보여주고 더 보기·접기로 펼친다", async () => {
    serveReport(cannedReport());
    renderReport("canned");

    const table = await screen.findByRole("table", { name: "이탈 원인 분포" });
    expect(within(table).getAllByRole("row")).toHaveLength(3);
    /* 분모는 과업 이탈 세션 6 */
    expect(within(table).getByRole("row", { name: /입력 부담/ })).toHaveTextContent("50%");

    await userEvent.click(screen.getByRole("button", { name: "원인 1종 더 보기" }));
    expect(
      within(screen.getByRole("table", { name: "이탈 원인 분포" })).getAllByRole("row"),
    ).toHaveLength(4);
    await userEvent.click(screen.getByRole("button", { name: "접기" }));
    expect(
      within(screen.getByRole("table", { name: "이탈 원인 분포" })).getAllByRole("row"),
    ).toHaveLength(3);
  });

  it("실측과 비교할 수 있으면 평균 오차·차이 구간·최대 이탈 구간·사람 관측을 보여준다", async () => {
    serveReport(
      withActual({
        status: "comparable",
        mean_error_pp: 4.5,
        gap_stages: ["cart"],
        max_drop: { predicted: ["cart", "signup"], actual: ["product", "cart"] },
      }),
    );
    renderReport("canned");

    const summary = await screen.findByRole("region", { name: "실측 비교 요약" });
    expect(summary).toHaveTextContent("비교 가능");
    expect(summary).toHaveTextContent("평균 오차4.5%p");
    expect(summary).toHaveTextContent("차이 구간1곳 · 장바구니");
    expect(summary).toHaveTextContent("최대 이탈 구간예측과 불일치");
    expect(summary).toHaveTextContent("3건 · 결과 2/3 일치");
    expect(summary).toHaveTextContent("예측 장바구니→가입 · 실측 상품→장바구니");
    expect(within(summary).getByRole("link", { name: "실측 분석 보기" })).toHaveAttribute(
      "href",
      "/projects/banchan/analytics",
    );
  });

  it.each([
    [
      { status: "unconnected" as const },
      "미연결",
      "실측 데이터가 아직 없어요",
      "실측 데이터 연결하기",
    ],
    [
      { status: "collecting" as const, stages_ready: 3, stages_total: 7 },
      "수집 중",
      "표본을 모으는 중이에요 · 7개 단계 중 3개 충족",
      "실측 퍼널 보기",
    ],
    [
      { status: "stale" as const, last_event_at: "2026-11-06T03:00:00+00:00" },
      "수집 중단",
      "최근 24시간 동안 이벤트가 없어요 · 마지막 수신 11월 6일",
      "설치 다시 확인",
    ],
  ])(
    "실측 상태(P14) %# — %s 배지와 안내, 다음 행동을 보여준다",
    async (actual, badge, title, action) => {
      serveReport(withActual(actual));
      renderReport("canned");

      const summary = await screen.findByRole("region", { name: "실측 비교 요약" });
      expect(summary).toHaveTextContent(badge);
      expect(summary).toHaveTextContent(title);
      expect(within(summary).getByRole("link", { name: action })).toHaveAttribute(
        "href",
        "/projects/banchan/analytics",
      );
    },
  );

  it("과업 결과가 없어도 빈 화면이 아니라 안내와 실행 전체 기록을 보여준다", async () => {
    serveReport(
      cannedReport({
        tasks: [],
        findings: [],
        technical_failures: [
          {
            session_id: "patient_delivery",
            persona_name: "여유 있는 탐색",
            task_name: "배송 지역 확인",
            status: "agent_failure",
            reason: "브라우저 실행 오류",
          },
        ],
      }),
    );
    renderReport("canned");

    expect(
      await screen.findByRole("heading", { name: "이 실행에는 과업 결과가 없어요" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "기술 실패 · 한도 초과" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "결과 해석의 한계" })).toHaveTextContent(
      "테스트용 한계 문구",
    );
  });

  it("받아 둔 리포트가 있으면 다시 받기에 실패해도 오류 화면과 겹치지 않는다", async () => {
    serveReport(cannedReport());
    const { queryClient } = renderReport("canned");
    await screen.findByRole("heading", { level: 1, name: "첫 주문" });

    server.use(personaErrorHandlers.reportNetworkError);
    await queryClient.refetchQueries({ queryKey: queryKeys.personas.report("canned") });

    expect(screen.getByRole("heading", { level: 1, name: "첫 주문" })).toBeInTheDocument();
    expect(screen.queryByText("리포트를 불러오지 못했어요")).not.toBeInTheDocument();
  });
});
