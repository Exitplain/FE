import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";

import { ROUTES } from "@/constants/routes";
import { setMeasurementMock } from "@/mocks/handlers/measurements";
import { server } from "@/mocks/node";
import { createTestProject, waitForProject } from "@/test/projects";
import { renderWithProviders } from "@/test/renderWithProviders";

import { CHECK_TIMEOUT_MS } from "./hooks/useMeasurement";
import AnalyticsPage from "./index";

async function renderAnalytics(projectId: string, search = "") {
  const result = renderWithProviders(<AnalyticsPage />, {
    route: `/projects/${projectId}/analytics${search}`,
    path: ROUTES.analytics.path,
  });
  await waitForProject();
  return result;
}

/* 매핑까지 저장해 실측 퍼널·비교를 볼 수 있는 프로젝트 */
async function connectedProject(patch = {}) {
  const projectId = await createTestProject();
  setMeasurementMock(Number(projectId), {
    key: "ep_00000000c0de",
    received: true,
    savedAt: "2026-11-18T09:00:00+09:00",
    ...patch,
  });
  return projectId;
}

describe("R01~R11 실제 고객 데이터 분석", () => {
  it("R06 — 연결된 프로젝트는 과업별 실제 고객 데이터 단계별 이동을 보여주고, 기기별로 나눠 볼 수 있다(R07)", async () => {
    const user = userEvent.setup();
    await renderAnalytics(await connectedProject());

    expect(
      await screen.findByRole("heading", { level: 1, name: "실제 고객 데이터 단계별 이동" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("비교 가능")).toBeInTheDocument();
    const funnel = screen.getByRole("table", { name: "실제 고객 데이터 단계별 이동" });
    expect(within(funnel).getAllByRole("row")).toHaveLength(6);
    expect(within(funnel).getByRole("row", { name: /장바구니/ })).toHaveTextContent(
      "546회 방문 · 44.0% · 이탈 41.3%",
    );

    await user.click(screen.getByRole("radio", { name: "모바일" }));
    expect(await screen.findByRole("heading", { name: "모바일 · 856회 방문" })).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: "데스크톱 · 384회 방문" }),
    ).toBeInTheDocument();
  });

  it("E09 — 표본이 모자라면 수집 중으로 알리고 단계마다 표본 부족을 표시한다", async () => {
    await renderAnalytics(await connectedProject({ scale: 0.05 }));

    expect(await screen.findByText("수집 중")).toBeInTheDocument();
    expect(screen.getByText("6단계 중 0개만 표본을 채웠어요")).toBeInTheDocument();
    expect(screen.getAllByText("표본 부족")).toHaveLength(6);
  });

  it("E03 → R01~R05 — 미연결이면 연결을 안내하고, 키 발급·설치 확인(첫 수집 대기)·매핑을 거쳐 수집을 시작한다", async () => {
    const user = userEvent.setup();
    const projectId = await createTestProject();
    await renderAnalytics(projectId);

    await user.click(await screen.findByRole("button", { name: "실제 고객 데이터 연결하기" }));
    expect(
      screen.getByRole("heading", { level: 1, name: "실제 고객 데이터 연결" }),
    ).toBeInTheDocument();
    /* 화면을 열면 키를 발급해 스니펫을 보여줍니다 */
    const key = `ep_${Number(projectId).toString(16).padStart(12, "0")}`;
    expect(await screen.findByText(new RegExp(`data-project="${key}"`))).toBeInTheDocument();
    expect(screen.getByText("https://shop.example.com 에서 온 수집만 받아요")).toBeInTheDocument();
    expect(screen.getByText("설치를 확인하면 열려요")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "사이트 열기 ↗" })).toHaveAttribute("target", "_blank");

    await user.click(screen.getByRole("button", { name: "설치 확인" }));
    expect(screen.getByRole("button", { name: "확인 중…" })).toBeDisabled();
    expect(screen.getByText(/첫 수집 대기 중/)).toBeInTheDocument();

    /* 사이트에서 첫 수집이 오면 다음 조회에서 설치됨으로 바뀝니다 */
    setMeasurementMock(Number(projectId), { received: true });
    expect(
      await screen.findByText(
        /수집을 받고 있어요 · https:\/\/shop.example.com/,
        {},
        { timeout: 5000 },
      ),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "단계 매핑하기" }));

    expect(screen.getByRole("heading", { level: 1, name: "이벤트 단계 매핑" })).toBeInTheDocument();
    /* 경로가 같으면 일치, 비슷하면 이름 유사로 자동 연결됩니다 */
    expect(await screen.findByText("6개 중 6개 연결")).toBeInTheDocument();
    const detail = screen.getByRole("row", { name: /\/product\/:id/ });
    expect(detail).toHaveTextContent("이름 유사");
    expect(
      within(detail).getByRole("button", { name: "/product/:id 단계: 상품 상세" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /coupon_applied/ })).toHaveTextContent("후보 없음");

    await user.click(screen.getByRole("button", { name: "coupon_applied 단계: 매핑 안 함" }));
    await user.click(screen.getByRole("menuitemradio", { name: "3. 장바구니" }));
    expect(
      screen.getByRole("button", { name: "coupon_applied 단계: 장바구니" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "매핑 저장" }));
    expect(
      await screen.findByRole("heading", { level: 1, name: "실제 고객 데이터 단계별 이동" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("비교 가능")).toBeInTheDocument();
  }, 15000);

  it("R05 — 저장한 매핑은 다시 열어도 그대로이고, 예측 리포트가 없으면 이유를 알려준다", async () => {
    const user = userEvent.setup();
    const projectId = await createTestProject();
    setMeasurementMock(Number(projectId), { key: "ep_0000000000ab", received: true });
    const first = await renderAnalytics(projectId, "?view=mapping");
    await user.click(await screen.findByRole("button", { name: "/faq 단계: 매핑 안 함" }));
    await user.click(screen.getByRole("menuitemradio", { name: "1. 첫 화면" }));
    await user.click(screen.getByRole("button", { name: "매핑 저장" }));
    await screen.findByRole("heading", { level: 1, name: "실제 고객 데이터 단계별 이동" });
    first.unmount();

    await renderAnalytics(projectId, "?view=mapping");
    expect(await screen.findByRole("button", { name: "/faq 단계: 첫 화면" })).toBeInTheDocument();
  });

  it("R05 — 사전 테스트 리포트가 없으면 매핑할 단계가 없다고 알려준다", async () => {
    const projectId = await createTestProject();
    setMeasurementMock(Number(projectId), {
      key: "ep_0000000000ac",
      received: true,
      predicted: false,
    });
    await renderAnalytics(projectId, "?view=mapping");
    expect(
      await screen.findByText("먼저 사전 테스트를 한 번 실행해야 비교할 단계가 생겨요."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "매핑 저장" })).not.toBeInTheDocument();
  });

  it("R04 — 5분 동안 수집이 오지 않으면 확인할 것을 보여준다", async () => {
    const projectId = await createTestProject();
    setMeasurementMock(Number(projectId), { key: "ep_0000000000aa" });
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      await renderAnalytics(projectId, "?view=connect");
      await user.click(await screen.findByRole("button", { name: "설치 확인" }));
      await act(() => vi.advanceTimersByTimeAsync(CHECK_TIMEOUT_MS));
      expect(screen.getByText("5분 동안 수집이 오지 않았어요")).toBeInTheDocument();
      expect(
        within(screen.getByRole("list", { name: "확인할 것" })).getAllByRole("listitem"),
      ).toHaveLength(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it("배포 주소가 없는 프로젝트는 실제 고객 데이터를 시작하지 않고 이유를 알려준다", async () => {
    const projectId = await createTestProject();
    setMeasurementMock(Number(projectId), { deployed: false });
    await renderAnalytics(projectId);

    expect(
      await screen.findByRole("heading", {
        name: "배포된 사이트가 있어야 실제 고객 데이터를 모을 수 있어요",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "실제 고객 데이터 연결하기" }),
    ).not.toBeInTheDocument();
  });

  it("R08 → R09~R11 — 차이 구간에서 고른 세그먼트로 실제 재현을 돌리고, 재현 리포트의 불편한 점을 원인 가설로 본다", async () => {
    let created: Record<string, unknown> | null = null;
    let polls = 0;
    let sessionsServed = false;
    const runBase = {
      id: "repro-1",
      sequence_no: 4,
      name: "원인 재현",
      kind: "cause_repro",
      change_note: "원인 재현 · 장바구니",
      parent_run_id: "run-mock-base",
      created_at: "2026-11-19T10:00:00+09:00",
      started_at: "2026-11-19T10:00:01+09:00",
      finished_at: null,
      report: null,
      project_id: 1,
      cancel_requested: false,
      error: null,
    };
    const progress = (finished: number) => ({
      expected_sessions: 10,
      started_sessions: 10,
      finished_sessions: finished,
      sessions_by_status: {},
      task_runs: { total: 1, queued: 0, running: 1, succeeded: 0, failed: 0, cancelled: 0 },
    });
    const session = (code: string, status: string) => ({
      id: Number(code.slice(2)),
      session_key: code,
      persona: { code, segment_id: "segment_1", segment_name: "빠른 구매형" },
      task_id: "order",
      seed: 1,
      status,
      reason: null,
      steps: 5,
      duration_seconds: 30,
      max_frustration: 40,
      terminal_stage: "cart",
      stages_reached: [],
      latest_observation: null,
      final_screenshot_url: null,
      started_at: null,
      finished_at: null,
    });
    server.use(
      http.post("*/api/v1/runs", async ({ request }) => {
        created = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          { run_id: "repro-1", status: "queued", status_url: "/api/v1/runs/repro-1" },
          { status: 202 },
        );
      }),
      http.get("*/api/v1/runs/repro-1", () => {
        polls += 1;
        /* 세션 목록을 한 번 내려 준 뒤에야 끝난 것으로 바꿔, 느린 환경에서도 R10 을 거쳐 가게 합니다 */
        return polls < 2 || !sessionsServed
          ? HttpResponse.json({
              ...runBase,
              status: "running",
              phase: "running",
              progress: progress(1),
            })
          : HttpResponse.json({
              ...runBase,
              status: "completed",
              phase: "done",
              progress: progress(10),
            });
      }),
      http.get("*/api/v1/runs/repro-1/sessions", () => {
        sessionsServed = true;
        return HttpResponse.json({
          items: [session("P-001", "simulated_dropout"), session("P-002", "running")],
          next_cursor: null,
          total: 2,
        });
      }),
      http.get("*/api/v1/runs/repro-1/reports", () =>
        HttpResponse.json({ report_id: "repro-report", run_ref: "repro-1", data: { tasks: [] } }),
      ),
      http.get("*/api/v1/reports/repro-report/screens", () =>
        HttpResponse.json({
          report_id: "repro-report",
          available: true,
          reason: null,
          message: null,
          note: "",
          tasks: [
            {
              task_id: "order",
              name: "첫 주문 완료",
              valid_sessions: 10,
              screens: [
                {
                  screen_id: "/cart",
                  name: "장바구니",
                  order: 2,
                  reached: 8,
                  dropouts_here: 3,
                  is_goal: false,
                  screenshot_url: null,
                  friction_sessions: 5,
                  frictions: [
                    {
                      category: "navigation",
                      name: "탐색 실패",
                      sessions: 2,
                      dropouts: 1,
                      detail: "",
                      screenshot_url: null,
                    },
                    {
                      category: "cost",
                      name: "비용 충격",
                      sessions: 4,
                      dropouts: 2,
                      detail: "배송비가 장바구니에서 처음 보여요",
                      screenshot_url: null,
                    },
                  ],
                },
              ],
              problems: [],
              causes: [],
            },
          ],
        }),
      ),
    );
    const user = userEvent.setup();
    await renderAnalytics(await connectedProject(), "?view=compare");

    expect(await screen.findByText("불일치")).toBeInTheDocument();
    expect(
      screen.getByText("예측 장바구니→회원가입 / 실제 고객 데이터 상품 상세→장바구니"),
    ).toBeInTheDocument();
    expect(screen.getByText("5.2%p")).toBeInTheDocument();
    expect(screen.getByText("5개 단계 절댓값 평균")).toBeInTheDocument();
    expect(screen.getByText("3차 (11월 7일) · 가장 최근")).toBeInTheDocument();
    /* 첫 단계(기준 100%)는 비교표에 넣지 않습니다 */
    expect(
      within(screen.getByRole("table", { name: "단계별 비교" })).queryByRole("row", {
        name: /첫 화면/,
      }),
    ).not.toBeInTheDocument();
    const cart = screen.getByRole("row", { name: /장바구니/ });
    expect(cart).toHaveTextContent("55~65%44.0%−16.0%p");

    await user.click(within(cart).getByRole("button", { name: "이 구간 원인 재현" }));
    expect(
      screen.getByRole("heading", { level: 1, name: "원인 재현 · 장바구니" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("장바구니 · 실제 고객 데이터 44.0% · 예측 55~65% (−16.0%p)"),
    ).toBeInTheDocument();
    expect(screen.getByText("고른 세그먼트 · 20명")).toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: "가격 민감형 · 5명" }));
    await user.click(screen.getByRole("checkbox", { name: "꼼꼼한 비교형 · 5명" }));
    expect(screen.getByText("고른 세그먼트 · 10명")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "재현 시작" }));

    /* 비교한 사전 테스트 실행을 기준으로, 그 과업 × 고른 세그먼트만 돌립니다 */
    expect(await screen.findByRole("list", { name: "재현 방문" })).toBeInTheDocument();
    expect(created).toEqual({
      plan_revision_id: "plan-rev-mock",
      base_run_id: "run-mock-base",
      change_note: "원인 재현 · 장바구니",
      reproduce: {
        task_id: "order",
        segment_ids: ["segment_1", "segment_4"],
        stage_id: "/cart",
        stage_name: "장바구니",
      },
    });
    /* 세션 목록은 실행 상태보다 늦게 올 수 있어 기다려서 찾습니다 */
    expect(
      await screen.findByRole("listitem", { name: "P-001 · 빠른 구매형 · 이탈" }),
    ).toBeInTheDocument();

    /* 실행이 끝나면 결과로 넘어가 장바구니 화면 마찰을 많은 순서로 보여줍니다 */
    expect(
      await screen.findByRole("heading", { name: "원인 가설" }, { timeout: 5000 }),
    ).toBeInTheDocument();
    const items = within(screen.getByRole("list", { name: "원인 가설 목록" }))
      .getAllByRole("listitem")
      .map((item) => item.textContent);
    expect(items[0]).toContain("비용 충격10명 중 4명 · 이 원인으로 이탈 2명");
    expect(items[1]).toContain("탐색 실패");
    expect(screen.getByText("배송비가 장바구니에서 처음 보여요")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /재현 리포트 전체 보기/ })).toHaveAttribute(
      "href",
      expect.stringContaining("/runs/repro-1/report"),
    );
    expect(screen.getByRole("button", { name: "조정안 확인" })).toBeInTheDocument();
  }, 15000);

  it("과업을 바꾸면 그 과업의 비교로 바뀐다", async () => {
    const user = userEvent.setup();
    await renderAnalytics(await connectedProject(), "?view=compare");

    await user.click(await screen.findByRole("radio", { name: "쿠폰으로 주문" }));

    expect(screen.getByText("일치")).toBeInTheDocument();
    expect(screen.getByText("0곳")).toBeInTheDocument();
    expect(screen.getByText("모두 범위 안")).toBeInTheDocument();
  });

  it("매핑하지 않은 단계는 실제 고객 데이터 없이 비워 두고 오차에서 뺀다", async () => {
    await renderAnalytics(
      await connectedProject({ mapping: { "/signup": null } }),
      "?view=compare",
    );
    const signup = await screen.findByRole("row", { name: /회원가입/ });
    expect(signup).toHaveTextContent("매핑 안 됨");
    expect(screen.getByText("4개 단계 절댓값 평균")).toBeInTheDocument();
  });

  it("미연결 프로젝트는 데이터 화면 주소로 들어와도 E03 을 보여준다", async () => {
    await renderAnalytics(await createTestProject(), "?view=compare");

    expect(
      await screen.findByRole("heading", { name: "실제 고객 데이터가 아직 없어요" }),
    ).toBeInTheDocument();
  });

  it("샘플 프로젝트는 실제 고객 데이터를 연결할 수 없다고 알려준다", async () => {
    await renderAnalytics("1");

    expect(
      await screen.findByText(/샘플 프로젝트는 실제 고객 데이터를 연결할 수 없어요/),
    ).toBeInTheDocument();
  });
});
