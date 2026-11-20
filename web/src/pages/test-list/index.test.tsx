import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { MemoryRouter, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import { confirmPersonaRun, discoverPersonaPlan } from "@/apis/persona.api";
import { queryKeys } from "@/apis/queryKeys";
import ProjectRoute from "@/components/Projects/ProjectRoute";
import { RESUME_ACTIVE_RUN_STATE } from "@/constants/navigationState";
import { ROUTES } from "@/constants/routes";
import { projectErrorHandlers } from "@/mocks/handlers/projects";
import { server } from "@/mocks/node";
import { finishPersonaMock } from "@/mocks/personaMock";
import type { WizardPlan } from "@/pages/new-test/utils/newTest";
import { useNewTestStore } from "@/stores/useNewTestStore";
import { RESULT_TTL_MS, type SiteCheckJob, useSiteCheckStore } from "@/stores/useSiteCheckStore";
import { createTestProject } from "@/test/projects";
import { createTestQueryClient, renderWithProviders } from "@/test/renderWithProviders";
import type { RunItem } from "@/types/run.type";

import TestListPage from "./index";

const queryClientRef: { current: QueryClient | null } = { current: null };

function renderPage(projectId = "1") {
  const result = renderWithProviders(<TestListPage />, {
    route: `/projects/${projectId}/tests`,
    path: ROUTES.testList.path,
  });
  queryClientRef.current = result.queryClient;
  return result;
}

async function startRun() {
  const plan = await discoverPersonaPlan({ variant: "problem" });
  await confirmPersonaRun({
    plan_id: plan.plan_id,
    feature_ids: ["shopping"],
    task_ids: ["order"],
    ages: ["any"],
    context: "",
    additional_request: "",
  });
}

const REPORT: RunItem["report"] = {
  id: "report-1",
  status: "final",
  revision: 1,
  goal_rates: [{ task_id: "order", name: "첫 주문", achievement_rate: 0.42 }],
};

/* 제품 API 실행 목록 항목 (BE runs.services.run_item 형태) */
function make(n: number, overrides: Partial<RunItem> = {}): RunItem {
  return {
    id: `run-${n}`,
    sequence_no: n,
    name: `${n}차`,
    kind: "pretest",
    status: "completed",
    change_note: "",
    parent_run_id: null,
    created_at: "2026-11-07T05:00:00+00:00",
    started_at: null,
    finished_at: null,
    report: null,
    ...overrides,
  };
}

/* mock 은 조회할 때마다 진행하므로 테스트에서는 끝까지 바로 돌립니다 */
function completeRun() {
  finishPersonaMock();
}

describe("P01 사전 테스트 목록", () => {
  it("프로젝트 머리말과 새 테스트 시작 링크를 보여준다", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { level: 1, name: "반찬로드" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "새 테스트 시작하기" })).toHaveAttribute(
      "href",
      "/projects/1/tests/new",
    );
  });

  it("실행 기록이 없으면 빈 상태(E02)만 보여주고 머리말 버튼은 숨긴다", async () => {
    renderPage();

    expect(
      await screen.findByRole("heading", { name: "아직 진행 중인 테스트가 없어요" }),
    ).toBeInTheDocument();
    expect(screen.getByText("AI 고객 20명이 어디서 왜 떠나는지 알려줘요")).toBeInTheDocument();
    /* 새 테스트 링크는 빈 상태 안의 하나뿐입니다 */
    expect(screen.getAllByRole("link", { name: "새 테스트 시작하기" })).toHaveLength(1);
    expect(screen.queryByRole("heading", { name: "사전 테스트" })).not.toBeInTheDocument();
  });

  it("진행 중인 실행은 실행 화면으로, 완료된 실행은 리포트로 연결한다", async () => {
    await startRun();
    completeRun();
    await startRun();

    renderPage();

    const table = await screen.findByRole("table", { name: "사전 테스트" });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByRole("link")).toHaveAttribute(
      "href",
      expect.stringMatching(/^\/projects\/1\/runs\/mock-run-\d+$/),
    );
    /* 막 시작한 실행은 브라우저 준비 단계 (모든 세션 대기) */
    expect(within(rows[0]).getByText("준비 중")).toBeInTheDocument();
    expect(within(rows[1]).getByRole("link")).toHaveAttribute(
      "href",
      expect.stringMatching(/^\/projects\/1\/runs\/mock-run-\d+\/report$/),
    );
    expect(within(rows[1]).getByText("완료")).toBeInTheDocument();
  });

  it("목록을 불러오지 못하면 다시 시도해 복구할 수 있다", async () => {
    server.use(projectErrorHandlers.runsNetworkError);
    const user = userEvent.setup();
    renderPage();

    const retry = await screen.findByRole("button", { name: "다시 시도" });
    server.resetHandlers();
    await user.click(retry);

    expect(
      await screen.findByRole("heading", { name: "아직 진행 중인 테스트가 없어요" }),
    ).toBeInTheDocument();
  });

  it("실행이 끝나도 그 실행이 목록에서 사라지지 않고 완료로 바뀐다", async () => {
    await startRun();
    renderPage();

    const table = await screen.findByRole("table", { name: "사전 테스트" });
    expect(await within(table).findByText("준비 중")).toBeInTheDocument();

    // 화면의 polling 대신 직접 끝까지 진행시키고 목록을 다시 받게 합니다
    completeRun();
    await queryClientRef.current!.invalidateQueries({ queryKey: queryKeys.runs.all });

    expect(await within(table).findByText("완료")).toBeInTheDocument();
    expect(within(table).getAllByRole("row")).toHaveLength(2);
  });

  it("내 프로젝트는 주소의 프로젝트 id 로 실행 목록을 묻는다", async () => {
    const runPaths: string[] = [];
    server.use(
      http.get("*/api/v1/projects/:projectId/runs", ({ request }) => {
        runPaths.push(new URL(request.url).pathname);
        return HttpResponse.json({ items: [], next_cursor: null, total: 0 });
      }),
    );
    renderPage(await createTestProject());

    expect(
      await screen.findByRole("heading", { name: "아직 진행 중인 테스트가 없어요" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "스튜디오 예약" })).toBeInTheDocument();
    expect(runPaths).toEqual(["/api/v1/projects/101/runs"]);
  });

  it("반찬로드는 샘플 프로젝트 1번의 실행 목록을 보고 개발 API 는 부르지 않는다", async () => {
    await startRun();
    const runPaths: string[] = [];
    let devRequests = 0;
    server.use(
      http.get("*/api/v1/projects/:projectId/runs", ({ request }) => {
        runPaths.push(new URL(request.url).pathname);
      }),
      http.get("*/api/personas", () => {
        devRequests += 1;
      }),
      http.get("*/api/personas/reports", () => {
        devRequests += 1;
      }),
    );
    renderPage();

    expect(await screen.findByRole("table", { name: "사전 테스트" })).toBeInTheDocument();
    expect(runPaths[0]).toBe("/api/v1/projects/1/runs");
    expect(devRequests).toBe(0);
  });

  it("BE 가 만든 이름과 과업별 달성률을 보여준다", async () => {
    await startRun();
    completeRun();
    renderPage();

    const table = await screen.findByRole("table", { name: "사전 테스트" });
    const [row] = within(table).getAllByRole("row").slice(1);
    expect(within(row).getByRole("link", { name: /^1차·/ })).toBeInTheDocument();
    expect(within(row).getByText(/^\d+%$/)).toBeInTheDocument();
  });

  it("다음 페이지가 있으면 더 보기로 이어 붙인다", async () => {
    server.use(
      http.get("*/api/v1/projects/:projectId/runs", ({ request }) => {
        const cursor = new URL(request.url).searchParams.get("cursor");
        return HttpResponse.json(
          cursor === "page-2"
            ? { items: [make(1)], next_cursor: null, total: 3 }
            : { items: [make(3), make(2)], next_cursor: "page-2", total: 3 },
        );
      }),
    );
    const user = userEvent.setup();
    renderPage();

    const table = await screen.findByRole("table", { name: "사전 테스트" });
    expect(within(table).getAllByRole("row")).toHaveLength(3);
    await user.click(screen.getByRole("button", { name: "더 보기" }));

    expect(await within(table).findByText("1차")).toBeInTheDocument();
    expect(within(table).getAllByRole("row")).toHaveLength(4);
    expect(screen.queryByRole("button", { name: "더 보기" })).not.toBeInTheDocument();
  });

  it("다음 페이지를 받지 못하면 알리고, 페이지가 겹쳐도 같은 실행은 한 번만 보여준다", async () => {
    let failNext = true;
    server.use(
      http.get("*/api/v1/projects/:projectId/runs", ({ request }) => {
        if (!new URL(request.url).searchParams.get("cursor")) {
          return HttpResponse.json({ items: [make(3), make(2)], next_cursor: "page-2", total: 3 });
        }
        if (failNext) {
          failNext = false;
          return HttpResponse.error();
        }
        /* 그사이 새 실행이 생겨 2차가 다음 페이지에도 옵니다 */
        return HttpResponse.json({ items: [make(2), make(1)], next_cursor: null, total: 4 });
      }),
    );
    const user = userEvent.setup();
    renderPage();

    const table = await screen.findByRole("table", { name: "사전 테스트" });
    await user.click(screen.getByRole("button", { name: "더 보기" }));
    expect(
      await screen.findByText("다음 기록을 불러오지 못했어요. 다시 눌러 주세요."),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "더 보기" }));
    expect(await within(table).findByText("1차")).toBeInTheDocument();
    expect(within(table).getAllByText("2차")).toHaveLength(1);
  });

  it("취소된 실행은 취소됨으로 표시하고, 리포트가 없으면 이름에 링크가 없다", async () => {
    server.use(
      http.get("*/api/v1/projects/:projectId/runs", () =>
        HttpResponse.json({
          items: [
            make(2, { status: "cancelled" }),
            make(1, { status: "completed", report: REPORT }),
          ],
          next_cursor: null,
          total: 2,
        }),
      ),
    );
    renderPage();

    const table = await screen.findByRole("table", { name: "사전 테스트" });
    const [cancelled, completed] = within(table).getAllByRole("row").slice(1);
    expect(within(cancelled).getByText("취소됨")).toBeInTheDocument();
    expect(within(cancelled).queryByRole("link")).not.toBeInTheDocument();
    expect(within(completed).getByRole("link", { name: "1차" })).toHaveAttribute(
      "href",
      "/projects/1/runs/run-1/report",
    );
    expect(within(completed).getByText("42%")).toBeInTheDocument();
  });

  it("프로젝트를 받지 못하면 다시 시도해 복구할 수 있다", async () => {
    server.use(http.get("*/api/v1/projects/:projectId", () => HttpResponse.error()));
    const user = userEvent.setup();
    renderPage();

    /* 네트워크 오류는 한 번 더 물은 뒤(약 1초) 오류를 보여 줍니다 */
    const retry = await screen.findByRole("button", { name: "다시 시도" }, { timeout: 3000 });
    server.resetHandlers();
    await user.click(retry);

    expect(
      await screen.findByRole("heading", { name: "아직 진행 중인 테스트가 없어요" }),
    ).toBeInTheDocument();
  });

  it("없는 프로젝트면 찾을 수 없다고 알린다", async () => {
    renderPage("unknown");

    expect(await screen.findByText("프로젝트를 찾을 수 없어요")).toBeInTheDocument();
  });
});

function RunProbe() {
  const { runId } = useParams();
  const navigate = useNavigate();
  return (
    <>
      <p>실행 화면 {runId}</p>
      <button type="button" onClick={() => navigate(-1)}>
        뒤로
      </button>
    </>
  );
}

/* 사이드바·프로젝트 탭처럼 이어 보기 state 를 붙여 목록으로 들어옵니다 */
function renderResume({
  resume = true,
  queryClient = createTestQueryClient(),
}: { resume?: boolean; queryClient?: QueryClient } = {}) {
  queryClientRef.current = queryClient;
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter
        initialEntries={[
          "/projects/1",
          { pathname: "/projects/1/tests", state: resume ? RESUME_ACTIVE_RUN_STATE : null },
        ]}
        initialIndex={1}
      >
        <Routes>
          <Route path="/projects/1" element={<p>이전 화면</p>} />
          <Route
            path={ROUTES.testList.path}
            element={
              <ProjectRoute>
                <TestListPage />
              </ProjectRoute>
            }
          />
          <Route path={ROUTES.testRun.path} element={<RunProbe />} />
          <Route path={ROUTES.newTest.path} element={<p>새 테스트 화면</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function siteCheckJob(job: Partial<SiteCheckJob>): SiteCheckJob {
  return {
    request: { siteUrl: "https://example.com", variant: "fixed", loginMode: "none" },
    status: "pending",
    phase: "discover",
    startedAt: Date.now(),
    finishedAt: null,
    result: null,
    error: null,
    ...job,
  };
}

function serveRuns(items: RunItem[]) {
  server.use(
    http.get("*/api/v1/projects/:projectId/runs", () =>
      HttpResponse.json({ items, next_cursor: null, total: items.length }),
    ),
  );
}

describe("P01 진행 중인 실행 이어 보기", () => {
  /* 새 테스트 입력은 테스트 설정(setup)이 비우지 않아, 다음 테스트로 남지 않게 여기서 비웁니다 */
  afterEach(() => useNewTestStore.getState().reset("", ""));

  it.each(["queued", "running", "finalizing"] as const)(
    "이어 보기로 들어왔고 %s 실행이 있으면 그 실행 화면을 바로 보여준다",
    async (status) => {
      serveRuns([make(2, { status }), make(1)]);
      renderResume();

      expect(await screen.findByText("실행 화면 run-2")).toBeInTheDocument();
    },
  );

  it("진행 중인 실행이 여러 개면 가장 최신 실행으로 간다", async () => {
    serveRuns([make(1), make(3, { status: "running" }), make(2, { status: "queued" })]);
    renderResume();

    expect(await screen.findByText("실행 화면 run-3")).toBeInTheDocument();
  });

  it("실행 화면으로 옮긴 뒤 뒤로 가면 목록이 아니라 그 전 화면으로 간다", async () => {
    serveRuns([make(1, { status: "running" })]);
    renderResume();
    expect(await screen.findByText("실행 화면 run-1")).toBeInTheDocument();

    /* 목록 항목은 실행 화면으로 바뀌어 남지 않으므로, 뒤로 가도 다시 실행 화면으로 튕기지 않습니다 */
    await userEvent.setup().click(screen.getByRole("button", { name: "뒤로" }));
    expect(await screen.findByText("이전 화면")).toBeInTheDocument();
  });

  it("진행 중인 실행이 없으면 목록을 그대로 보여준다", async () => {
    serveRuns([make(2, { status: "failed" }), make(1)]);
    renderResume();

    expect(await screen.findByRole("table", { name: "사전 테스트" })).toBeInTheDocument();
    expect(screen.queryByText(/^실행 화면/)).not.toBeInTheDocument();
  });

  it("진행 중인 실행이 없고 사이트 확인 중이면 새 테스트 화면으로 간다", async () => {
    serveRuns([make(1)]);
    useSiteCheckStore.setState({ jobs: { "1": siteCheckJob({ status: "pending" }) } });
    renderResume();

    expect(await screen.findByText("새 테스트 화면")).toBeInTheDocument();
  });

  it("사이트 확인을 마치고 받은 계획으로 이후 단계를 쓰는 중이면 새 테스트 화면으로 간다", async () => {
    serveRuns([make(1)]);
    useNewTestStore.setState({ projectId: "1", plan: {} as WizardPlan, planAt: Date.now() });
    renderResume();

    expect(await screen.findByText("새 테스트 화면")).toBeInTheDocument();
  });

  it("쓰던 새 테스트의 계획이 만료됐거나 다른 프로젝트 것이면 목록을 보여준다", async () => {
    serveRuns([make(1)]);
    useNewTestStore.setState({
      projectId: "1",
      plan: {} as WizardPlan,
      planAt: Date.now() - RESULT_TTL_MS - 1,
    });
    useSiteCheckStore.setState({ jobs: { "2": siteCheckJob({ status: "pending" }) } });
    renderResume();

    expect(await screen.findByRole("table", { name: "사전 테스트" })).toBeInTheDocument();
    expect(screen.queryByText("새 테스트 화면")).not.toBeInTheDocument();
  });

  it("진행 중인 실행이 있으면 새 테스트를 쓰는 중이어도 실행 화면으로 간다", async () => {
    serveRuns([make(1, { status: "running" })]);
    useSiteCheckStore.setState({ jobs: { "1": siteCheckJob({ status: "pending" }) } });
    renderResume();

    expect(await screen.findByText("실행 화면 run-1")).toBeInTheDocument();
  });

  it("이어 보기 표시 없이 들어오면 진행 중이어도 목록을 보여준다", async () => {
    serveRuns([make(1, { status: "running" })]);
    renderResume({ resume: false });

    expect(await screen.findByRole("table", { name: "사전 테스트" })).toBeInTheDocument();
    expect(screen.queryByText(/^실행 화면/)).not.toBeInTheDocument();
  });

  it("목록을 받는 동안에는 옮기지 않고 불러오는 중을 보여준다", async () => {
    server.use(
      http.get("*/api/v1/projects/:projectId/runs", async () => {
        await delay("infinite");
        return HttpResponse.json({ items: [], next_cursor: null, total: 0 });
      }),
    );
    renderResume();

    expect(await screen.findByText("사전 테스트를 불러오는 중이에요…")).toBeInTheDocument();
    expect(screen.queryByText(/^실행 화면/)).not.toBeInTheDocument();
  });

  it("목록을 받지 못하면 옮기지 않고 오류를 보여준다", async () => {
    server.use(projectErrorHandlers.runsNetworkError);
    renderResume();

    expect(await screen.findByRole("button", { name: "다시 시도" })).toBeInTheDocument();
    expect(screen.queryByText(/^실행 화면/)).not.toBeInTheDocument();
  });

  it("예전에 받아 둔 목록이 진행 중이어도 새로 받은 목록이 끝났으면 옮기지 않는다", async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(queryKeys.runs.list(1), {
      pages: [{ items: [make(1, { status: "running" })], next_cursor: null, total: 1 }],
      pageParams: [undefined],
    });
    serveRuns([make(1)]);
    renderResume({ queryClient });

    expect(await screen.findByText("완료")).toBeInTheDocument();
    expect(screen.queryByText(/^실행 화면/)).not.toBeInTheDocument();
  });

  it("목록에 머물기로 정한 뒤(이어 보기 state 를 지운 뒤) 새 실행이 진행 중이 되어도 갑자기 옮기지 않는다", async () => {
    serveRuns([make(1)]);
    renderResume();
    const table = await screen.findByRole("table", { name: "사전 테스트" });

    serveRuns([make(2, { status: "running" }), make(1)]);
    await queryClientRef.current!.invalidateQueries({ queryKey: queryKeys.runs.all });

    expect(await within(table).findByText("2차")).toBeInTheDocument();
    expect(screen.queryByText(/^실행 화면/)).not.toBeInTheDocument();
  });
});
