import { act, screen, waitFor, within } from "@testing-library/react";
import { Fragment, StrictMode } from "react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { Link, Route, Routes, useParams } from "react-router-dom";
import { beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";

import { confirmPersonaRun, discoverPersonaPlan } from "@/apis/persona.api";
import { ROUTES } from "@/constants/routes";
import { planErrorHandlers } from "@/mocks/handlers/plans";
import { server } from "@/mocks/node";
import { patchPlan, putTestAccounts } from "@/mocks/planMock";
import { useNewTestStore } from "@/stores/useNewTestStore";
import { useRunTaskNamesStore } from "@/stores/useRunTaskNamesStore";
import { useSiteCheckStore } from "@/stores/useSiteCheckStore";
import ProjectRoute from "@/components/Projects/ProjectRoute";
import { createTestProject, waitForProject } from "@/test/projects";
import { renderWithProviders } from "@/test/renderWithProviders";
import axiosInstance from "@/apis/axiosInstance";
import { queryKeys } from "@/apis/queryKeys";
import { useOnboardingStore } from "@/stores/useOnboardingStore";

import NewTestPage from "./index";

function RunProbe() {
  const { runId } = useParams();
  return <p>실행 화면 {runId}</p>;
}

async function renderWizard(step?: string) {
  const query = step ? `?step=${step}` : "";
  const result = renderWithProviders(
    <>
      {/* 같은 화면에서 프로젝트만 바뀌는 경우를 확인하려는 링크 */}
      {/* createTestProject 로 만든 첫 프로젝트(101) */}
      <Link to="/projects/101/tests/new">스튜디오 예약 새 테스트</Link>
      {/* 브라우저 앞으로 가기처럼 "다음" 없이 시작 전 확인으로 돌아오는 경우 */}
      <Link to="/projects/1/tests/new?step=confirm">확인 화면으로</Link>
      <Routes>
        <Route element={<ProjectRoute />}>
          <Route path={ROUTES.newTest.path} element={<NewTestPage />} />
          <Route path={ROUTES.testRun.path} element={<RunProbe />} />
        </Route>
      </Routes>
    </>,
    { route: `/projects/1/tests/new${query}` },
  );
  await waitForProject();
  return result;
}

/* 사이트 확인 → 과업·타겟 입력 → 페르소나 → 시작 전 확인 화면까지 */
async function goToConfirm(user: ReturnType<typeof userEvent.setup>) {
  await checkSite(user);
  await user.click(screen.getByRole("button", { name: "다음: 과업 · 타겟" }));
  await user.type(await screen.findByLabelText("타겟 고객 설명"), "첫 방문자");
  await user.click(screen.getByRole("button", { name: "다음: 페르소나" }));
  /* 3단계에 들어오면 세그먼트 유형을 한 번 추론합니다 (segment-inferences) */
  await screen.findByText("빠른 구매형");
  await user.click(await screen.findByRole("button", { name: "다음: 시작 전 확인" }));
  await screen.findByRole("list", { name: "입력 요약" });
}

/* 시작 전 확인에서 "페르소나 생성" → P06 생성 중 → P07 세그먼트 카드까지 */
async function goToReview(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "페르소나 생성" }));
  await screen.findByRole("list", { name: "페르소나 세그먼트" });
}

async function checkSite(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "확인" }));
  await screen.findByText("접근 가능 · 응답 0.8초 · 기능 4개 찾음");
}

beforeEach(() => useNewTestStore.getState().reset("", ""));

describe("P02~P07 새 테스트", () => {
  it("첫 테스트 안내는 실제 검증과 단계 이동을 따라가며 실행 요청은 대신 보내지 않는다", async () => {
    const user = userEvent.setup();
    const post = vi.spyOn(axiosInstance, "post");
    onTestFinished(() => {
      useOnboardingStore.setState({ accounts: {}, tour: null, reportTips: {} });
      post.mockRestore();
    });
    const { queryClient } = await renderWizard();
    act(() => {
      queryClient.setQueryData(queryKeys.auth.session(), {
        authenticated: true,
        user: { id: 42, email: "maker@example.com" },
      });
      useOnboardingStore.getState().start("id:42");
    });
    expect(await screen.findByRole("heading", { name: "사이트를 확인하세요" })).toBeInTheDocument();
    await checkSite(user);
    await user.click(screen.getByRole("button", { name: "다음: 과업 · 타겟" }));
    expect(
      await screen.findByRole("heading", { name: "고객이 달성할 목표를 고르세요" }),
    ).toBeInTheDocument();
    await user.type(screen.getByLabelText("타겟 고객 설명"), "처음 방문한 고객");
    await user.click(screen.getByRole("button", { name: "다음: 페르소나" }));
    expect(
      await screen.findByRole("heading", { name: "AI 고객 구성을 확인하세요" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "다음: 시작 전 확인" }));
    expect(
      await screen.findByRole("heading", { name: "입력한 설정을 마지막으로 확인하세요" }),
    ).toBeInTheDocument();
    await goToReview(user);
    expect(
      await screen.findByRole("heading", { name: "생성된 페르소나를 확인하면 준비 끝이에요" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "준비 안내 마치기" }));
    expect(screen.queryByRole("region", { name: "첫 테스트 준비 안내" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "실행 시작" })).toBeEnabled();
    expect(post.mock.calls.some(([url]) => url === "/api/v1/runs")).toBe(false);
    expect(useOnboardingStore.getState().reportTips["id:42"]).toBe("1");
  });

  it("프로젝트 주소를 미리 채우고 4단계 중 첫 단계를 보여준다", async () => {
    await renderWizard();

    expect(screen.getByRole("heading", { level: 1, name: "새 테스트" })).toBeInTheDocument();
    expect(screen.getByLabelText("제품 URL")).toHaveValue("https://banchanroad.example");
    const steps = within(screen.getByRole("list", { name: "진행 단계" })).getAllByRole("listitem");
    expect(steps[0]).toHaveAttribute("aria-current", "step");
  });

  it("E07 — 주소 모양이 틀리면 확인하지 않고 안내한다", async () => {
    const user = userEvent.setup();
    await renderWizard();

    await user.clear(screen.getByLabelText("제품 URL"));
    await user.type(screen.getByLabelText("제품 URL"), "banchanroad");
    await user.click(screen.getByRole("button", { name: "확인" }));

    expect(
      screen.getByText("URL 형식이 아니에요 · https://로 시작하는 주소를 넣어주세요"),
    ).toBeInTheDocument();
    /* 다음을 눌러도 주소를 먼저 확인하므로 넘어가지 않습니다 */
    await user.click(screen.getByRole("button", { name: "다음: 과업 · 타겟" }));
    expect(screen.queryByLabelText("타겟 고객 설명")).not.toBeInTheDocument();
  });

  it("확인 전에는 안내 띠만 있고, 로그인 연결은 사이트를 확인한 뒤에 나온다", async () => {
    const user = userEvent.setup();
    await renderWizard();

    expect(screen.getByText("URL 형식과 사이트 접근 여부를 먼저 확인해요")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "로그인 연결" })).not.toBeInTheDocument();

    await checkSite(user);

    expect(screen.getByRole("heading", { name: "로그인 연결" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다시 확인" })).toBeInTheDocument();
  });

  it("확인 전에 다음을 누르면 사이트를 확인한 뒤 바로 과업·타겟으로 간다", async () => {
    const user = userEvent.setup();
    await renderWizard();

    await user.click(screen.getByRole("button", { name: "다음: 과업 · 타겟" }));

    expect(await screen.findByLabelText("타겟 고객 설명")).toBeInTheDocument();
  });

  it("E08 — 사이트를 확인하지 못하면 다시 시도할 수 있다", async () => {
    server.use(planErrorHandlers.siteUnreachable);
    const user = userEvent.setup();
    await renderWizard();

    await user.click(screen.getByRole("button", { name: "확인" }));

    expect(await screen.findByText(/사이트 응답 없음 · 점검·방화벽 가능성/)).toBeInTheDocument();
    expect(screen.getByText("오류 코드 503")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다시 확인" })).toBeInTheDocument();
  });

  it("P02b — 비동기 탐색 중에는 서버 진행 사건을 자세히 보기로 보여 주고, 실패로 끝나면 E08 로 안내한다", async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    const running = {
      id: "discovery-running",
      status: "running",
      features: [],
      tasks: [],
      progress: [
        { seq: 1, t: 0, kind: "queued", message: "사이트 확인을 시작했어요" },
        {
          seq: 2,
          t: 3,
          kind: "page_read",
          message: "'홈' 화면을 읽었어요 · 같은 사이트 링크 6개",
          path: "/",
        },
      ],
    };
    /* 첫 조회는 아직 진행 중, 테스트가 열어 주면 mock 의 정상 조회로 넘깁니다 */
    server.use(
      http.get("*/api/v1/discoveries/:discoveryId", async ({ params }) => {
        if (params.discoveryId !== "discovery-running") return;
        await gate;
        return HttpResponse.json({ ...running, status: "failed", error: null });
      }),
      http.post("*/api/v1/projects/:projectId/discoveries", () =>
        HttpResponse.json(running, { status: 202 }),
      ),
    );
    const user = userEvent.setup();
    await renderWizard();
    await user.click(screen.getByRole("button", { name: "확인" }));

    expect(
      await screen.findByText("'홈' 화면을 읽었어요 · 같은 사이트 링크 6개"),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /자세히 보기/ }));
    expect(screen.getByRole("list", { name: "사이트 확인 기록" })).toHaveTextContent(
      "사이트 확인을 시작했어요",
    );
    act(() => release());
    /* 실패로 끝난 탐색(오류 코드 없음)은 사이트 응답 없음(503)으로 안내합니다 */
    expect(await screen.findByText(/사이트 응답 없음 · 점검·방화벽 가능성/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /자세히 보기/ })).not.toBeInTheDocument();
  });

  it("비동기 탐색이 로그인 실패로 끝나면 동기 응답과 같은 409 안내를 보여 준다", async () => {
    server.use(
      http.post("*/api/v1/projects/:projectId/discoveries", () =>
        HttpResponse.json(
          { id: "discovery-login", status: "running", progress: [] },
          { status: 202 },
        ),
      ),
      http.get("*/api/v1/discoveries/:discoveryId", () =>
        HttpResponse.json({
          id: "discovery-login",
          status: "failed",
          progress: [],
          error: {
            code: "TEST_ACCOUNT_LOGIN_FAILED",
            message: "테스트 계정으로 로그인하지 못했습니다.",
          },
        }),
      ),
    );
    const user = userEvent.setup();
    await renderWizard();
    await user.click(screen.getByRole("button", { name: "확인" }));

    expect(await screen.findByText("오류 코드 409")).toBeInTheDocument();
    expect(screen.queryByText(/사이트 응답 없음/)).not.toBeInTheDocument();
  });

  it("이전 BE 처럼 탐색이 끝난 결과(201, status 없음)를 주면 조회 없이 그대로 쓴다", async () => {
    const requests: string[] = [];
    server.events.on("request:start", ({ request }) => {
      requests.push(`${request.method} ${new URL(request.url).pathname}`);
    });
    onTestFinished(() => server.events.removeAllListeners());
    server.use(
      http.post("*/api/v1/projects/:projectId/discoveries", async ({ request }) => {
        const { createDiscovery } = await import("@/mocks/planMock");
        const text = await request.text();
        return HttpResponse.json(createDiscovery(1, text ? JSON.parse(text) : {}), { status: 201 });
      }),
    );
    const user = userEvent.setup();
    await renderWizard();
    await checkSite(user);
    expect(requests.some((line) => line.startsWith("GET /api/v1/discoveries/"))).toBe(false);
  });

  it("사이트 확인 → 과업·타겟 → 페르소나 → 시작 전 확인 → 페르소나 확인 → 실행 화면으로 이동한다", async () => {
    const user = userEvent.setup();
    await renderWizard();

    await checkSite(user);
    await user.click(screen.getByRole("button", { name: "다음: 과업 · 타겟" }));

    // P05: 추천 과업이 미리 골라져 있고, 근거 경로를 보여준다
    expect(await screen.findByRole("button", { name: "첫 주문" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      within(screen.getByRole("complementary", { name: "사이트에서 찾은 기능" })).getByText(
        /\/product/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/과업 2개 선택 · 10명 × 2개 × 반복 1회/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "30대" }));
    await user.type(screen.getByLabelText("타겟 고객 설명"), "퇴근 후 첫 주문");
    await user.click(screen.getByRole("button", { name: "다음: 페르소나" }));

    // P05b: 세그먼트 4개 (기본 10명 = 3·3·2·2), 보정 적용일
    const segments = await screen.findByRole("list", { name: "세그먼트별 인원" });
    expect(within(segments).getAllByRole("listitem")).toHaveLength(4);
    expect(screen.getByLabelText("세그먼트 1 인원")).toHaveTextContent("3명");
    expect(screen.getByLabelText("세그먼트 4 인원")).toHaveTextContent("2명");
    expect(
      await screen.findByText("이 프로젝트에 맞춘 값으로 예측해요 · 11월 5일 적용"),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "다음: 시작 전 확인" }));

    // P05c: 요약과 단계별 변경 링크
    const summary = await screen.findByRole("list", { name: "입력 요약" });
    expect(within(summary).getByText(/30대/)).toBeInTheDocument();
    expect(
      within(summary).getByText("사이트 분석으로 자동 결정 · 과업별 7단계"),
    ).toBeInTheDocument();
    expect(
      within(summary).getByText("AI 고객 10명 · 과업 2개 · 예측 맞추기 11월 5일"),
    ).toBeInTheDocument();
    expect(within(summary).getAllByRole("link", { name: /변경/ }).length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: "페르소나 생성" }));

    expect(
      await screen.findByRole("heading", { level: 1, name: "페르소나 확인" }),
    ).toBeInTheDocument();

    // P07: 세그먼트 4개 카드 (대표 코드·코드 범위·행동 변수)
    const cards = await screen.findByRole("list", { name: "페르소나 세그먼트" });
    expect(within(cards).getAllByRole("listitem", { name: /형$/ })).toHaveLength(4);
    const quick = within(cards).getByRole("listitem", { name: "빠른 구매형" });
    expect(quick).toHaveTextContent("3명");
    expect(quick).toHaveTextContent("대표 P-001");
    expect(quick).toHaveTextContent("P-001~003");
    expect(within(quick).getByRole("meter", { name: "인내심 22" })).toHaveAttribute(
      "aria-valuenow",
      "22",
    );
    expect(
      screen.getByText("첫 주문 외 1개 · 데스크톱 1280 · 10명 × 반복 1회 (1/1)"),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "실행 시작" }));

    const probe = await screen.findByText(/실행 화면 mock-run-\d+/);
    /* 실행 응답에는 과업 id 만 있어, 실행 화면이 쓸 과업 이름을 실행 ID 로 남깁니다 */
    const runId = probe.textContent!.replace("실행 화면 ", "");
    expect(useRunTaskNamesStore.getState().byRunId[runId]).toMatchObject({ order: "첫 주문" });
  });

  it("P06 — 만드는 동안 생성 단계와 자리 표시 카드를 보여주고 실행을 막는다", async () => {
    const user = userEvent.setup();
    await renderWizard();
    await goToConfirm(user);
    /* 확정 응답을 붙잡아 생성 중 화면에 머물게 합니다 */
    server.use(http.post("*/api/v1/plans/:planId/confirmations", () => delay("infinite")));

    await user.click(screen.getByRole("button", { name: "페르소나 생성" }));

    expect(
      await screen.findByRole("heading", { name: "페르소나를 만들고 있어요" }),
    ).toBeInTheDocument();
    const steps = screen.getByRole("list", { name: "생성 단계" });
    expect(within(steps).getAllByRole("listitem")).toHaveLength(4);
    expect(within(steps).getAllByRole("listitem")[0]).toHaveTextContent("타겟 고객 설명 분석완료");
    expect(steps).toHaveTextContent("세그먼트 4종 추출");
    expect(steps).toHaveTextContent("10명 샘플링 · P-001~P-010 코드 부여");
    expect(screen.getByRole("button", { name: "실행 시작" })).toBeDisabled();
  });

  it("P07 — 이전을 누르면 시작 전 확인으로 돌아간다", async () => {
    const user = userEvent.setup();
    await renderWizard();
    await goToConfirm(user);
    await goToReview(user);

    await user.click(screen.getByRole("button", { name: "이전" }));

    expect(await screen.findByRole("list", { name: "입력 요약" })).toBeInTheDocument();
  });

  it("페르소나를 만들지 못하면 알리고 다시 시도할 수 있다", async () => {
    const user = userEvent.setup();
    await renderWizard();
    await goToConfirm(user);

    server.use(
      http.post(
        "*/api/v1/plans/:planId/confirmations",
        () =>
          HttpResponse.json(
            {
              error: {
                code: "PERSONA_GENERATION_FAILED",
                message: "페르소나를 만들지 못했습니다: 생성기 오류",
                fields: {},
              },
            },
            { status: 503 },
          ),
        { once: true },
      ),
    );
    await user.click(screen.getByRole("button", { name: "페르소나 생성" }));

    expect(await screen.findByText("페르소나를 만들지 못했어요")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(await screen.findByRole("list", { name: "페르소나 세그먼트" })).toBeInTheDocument();
  });

  it("확정 직전 서버의 테스트 계정 수가 바뀌면(409) 1단계에서 계정을 다시 받고 인원 기준을 맞춘다", async () => {
    const user = userEvent.setup();
    const accounts = (count: number) =>
      Array.from({ length: count }, (_, i) => ({ username: `u${i}@x.example`, password: "pw" }));
    /* 서버에 저장된 계정 8개를 위저드가 받아 옵니다 */
    await putTestAccounts(1, { accounts: accounts(8) });
    await renderWizard();
    await checkSite(user);
    expect(await screen.findByText(/테스트 계정 8개 등록/)).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /테스트 계정 로그인 상태로 테스트/ }));
    await user.click(screen.getByRole("button", { name: "다음: 과업 · 타겟" }));
    await user.type(await screen.findByLabelText("타겟 고객 설명"), "첫 방문자");
    await user.click(screen.getByRole("button", { name: "다음: 페르소나" }));
    expect(await screen.findByText("테스트 계정 8개 → AI 고객 8명")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "다음: 시작 전 확인" }));
    await screen.findByRole("list", { name: "입력 요약" });

    /* 다른 탭에서 계정을 5개로 바꿨습니다 */
    await putTestAccounts(1, { accounts: accounts(5) });
    server.use(
      http.post(
        "*/api/v1/plans/:planId/confirmations",
        () =>
          HttpResponse.json(
            {
              error: {
                code: "TEST_ACCOUNT_COUNT_MISMATCH",
                message: "테스트 계정 수와 페르소나 수가 달라요. 3단계에서 인원을 다시 맞춰주세요.",
                fields: {},
              },
            },
            { status: 409 },
          ),
        { once: true },
      ),
    );
    await user.click(screen.getByRole("button", { name: "페르소나 생성" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "테스트 계정 수와 페르소나 수가 달라요. 3단계에서 인원을 다시 맞춰주세요.",
    );
    expect(screen.queryByRole("button", { name: "다시 시도" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "변경 · 1단계" }));

    /* 서버 계정을 다시 받아 5개로 보이고, 다음에서 다시 확인해 에이전트 5명으로 맞춥니다 */
    expect(await screen.findByText(/테스트 계정 5개 등록/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "다음: 과업 · 타겟" }));
    await user.click(await screen.findByRole("button", { name: "다음: 페르소나" }));
    expect(await screen.findByText("테스트 계정 5개 → AI 고객 5명")).toBeInTheDocument();
  });

  it("P05a — 과업을 하나도 고르지 않으면 다음으로 가지 않는다", async () => {
    const user = userEvent.setup();
    await renderWizard();
    await checkSite(user);
    await user.click(screen.getByRole("button", { name: "다음: 과업 · 타겟" }));

    /* 추천으로 미리 골라 둔 두 과업을 해제합니다 */
    for (const name of ["첫 주문", "쿠폰으로 주문"]) {
      await user.click(await screen.findByRole("button", { name }));
    }

    /* 고르는 즉시 안내하고 다음을 막습니다 */
    expect(screen.getByText("과업을 1개 이상 골라주세요")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다음: 페르소나" })).toBeDisabled();
  });

  it("P05e — 세그먼트 합계가 4~20명 밖이면 안내하고 다음을 막는다", async () => {
    const user = userEvent.setup();
    await renderWizard();
    await checkSite(user);
    await user.click(screen.getByRole("button", { name: "다음: 과업 · 타겟" }));
    await user.type(await screen.findByLabelText("타겟 고객 설명"), "첫 방문자");
    await user.click(screen.getByRole("button", { name: "다음: 페르소나" }));

    /* 기본 10명에서 줄여도 범위 안이면 그대로 다음으로 갈 수 있습니다 */
    await user.click(await screen.findByRole("button", { name: "세그먼트 4 1명 줄이기" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다음: 시작 전 확인" })).toBeEnabled();

    /* 9명 → 21명 */
    for (let i = 0; i < 12; i += 1) {
      await user.click(screen.getByRole("button", { name: "세그먼트 1 1명 늘리기" }));
    }
    expect(screen.getByRole("alert")).toHaveTextContent(
      "합계를 4~20명 사이로 맞춰주세요 · 지금 21명",
    );
    expect(screen.getByRole("button", { name: "다음: 시작 전 확인" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "세그먼트 2 1명 줄이기" }));
    expect(screen.getByRole("button", { name: "다음: 시작 전 확인" })).toBeEnabled();
  });

  it("P05h — 테스트 계정으로 테스트하면 계정 수만큼 AI 고객을 나눈다", async () => {
    const user = userEvent.setup();
    await renderWizard();
    await checkSite(user);
    const accounts = Array.from({ length: 8 }, (_, i) => ({
      username: `u${i}@x.example`,
      password: "pw",
    }));
    /* 서버(mock)에 계정 8개를 저장해 둡니다 — 탐색이 계정 수로 에이전트 수를 정합니다 */
    await putTestAccounts(1, { accounts });
    act(() => {
      useNewTestStore.getState().setLoginMode("account");
      useNewTestStore.getState().setAccounts(accounts);
    });
    /* 로그인 방식이 바뀌어 다음을 누르면 테스트 계정 모드로 다시 확인합니다 */
    await user.click(screen.getByRole("button", { name: "다음: 과업 · 타겟" }));
    await user.type(await screen.findByLabelText("타겟 고객 설명"), "첫 방문자");
    await user.click(screen.getByRole("button", { name: "다음: 페르소나" }));

    expect(await screen.findByText("테스트 계정 8개 → AI 고객 8명")).toBeInTheDocument();
    expect(screen.getByLabelText("세그먼트 3 인원")).toHaveTextContent("2명");
  });

  it("타겟 고객 설명이 비어 있으면 다음으로 가지 않는다", async () => {
    const user = userEvent.setup();
    await renderWizard();
    await checkSite(user);
    await user.click(screen.getByRole("button", { name: "다음: 과업 · 타겟" }));
    await user.click(await screen.findByRole("button", { name: "다음: 페르소나" }));

    expect(screen.getByText("타겟 고객을 적어 주세요")).toBeInTheDocument();
  });

  it("탐색 결과가 만료되면(DISCOVERY_EXPIRED) 사이트 확인 단계로 돌아간다", async () => {
    const user = userEvent.setup();
    await renderWizard();
    await checkSite(user);
    await user.click(screen.getByRole("button", { name: "다음: 과업 · 타겟" }));
    await user.type(await screen.findByLabelText("타겟 고객 설명"), "첫 방문자");
    await user.click(screen.getByRole("button", { name: "다음: 페르소나" }));
    await user.click(await screen.findByRole("button", { name: "다음: 시작 전 확인" }));

    await screen.findByRole("list", { name: "입력 요약" });

    server.use(planErrorHandlers.confirmExpired);
    await user.click(screen.getByRole("button", { name: "페르소나 생성" }));

    expect(await screen.findByText(/탐색 결과가 만료됐어요/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "확인" })).toBeInTheDocument();
  });

  it("사이트를 확인하지 않고 다른 단계 주소로 들어오면 첫 단계를 보여준다", async () => {
    await renderWizard("confirm");

    expect(screen.getByRole("button", { name: "확인" })).toBeInTheDocument();
  });

  it("P04 — 테스트 계정을 붙여넣고 중복을 알려준 뒤 저장한다", async () => {
    const user = userEvent.setup();
    await renderWizard();
    await checkSite(user);

    await user.click(screen.getByRole("radio", { name: /테스트 계정 로그인 상태로 테스트/ }));
    await user.click(screen.getByRole("button", { name: "테스트 계정 등록" }));
    const dialog = await screen.findByRole("dialog", { name: "테스트 계정 등록" });
    await user.type(
      within(dialog).getByLabelText(/로그인 화면 주소/),
      "https://banchanroad.example/login",
    );

    await user.click(within(dialog).getByRole("radio", { name: "붙여넣기" }));
    await user.click(within(dialog).getByLabelText("계정 붙여넣기"));
    await user.paste("a@x.example,pw1\nb@x.example,pw2\na@x.example,pw3");
    await user.click(within(dialog).getByRole("button", { name: "목록에 넣기" }));

    expect(within(dialog).getByText("3 / 20")).toBeInTheDocument();
    expect(within(dialog).getAllByText("같은 아이디가 이미 있어요")).toHaveLength(2);
    expect(within(dialog).getByRole("button", { name: "계정 저장" })).toBeDisabled();

    await user.click(within(dialog).getAllByRole("button", { name: /계정 \d+ 삭제/ })[2]);
    await user.click(within(dialog).getByRole("button", { name: "계정 저장" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText(/테스트 계정 2개 등록/)).toBeInTheDocument();
  });

  it("P04 — 비밀번호를 암호화하지 못하면(503) 입력을 지우지 않고 다시 저장할 수 있다", async () => {
    const user = userEvent.setup();
    await renderWizard();
    await checkSite(user);
    server.use(
      http.put(
        "*/api/v1/projects/:projectId/test-accounts",
        () =>
          HttpResponse.json(
            {
              error: {
                code: "TEST_ACCOUNT_KEY_UNAVAILABLE",
                message: "비밀번호를 암호화하지 못했습니다. 잠시 뒤 다시 저장해주세요.",
                fields: {},
              },
            },
            { status: 503 },
          ),
        { once: true },
      ),
    );

    await user.click(screen.getByRole("radio", { name: /테스트 계정 로그인 상태로 테스트/ }));
    await user.click(screen.getByRole("button", { name: "테스트 계정 등록" }));
    const dialog = await screen.findByRole("dialog", { name: "테스트 계정 등록" });
    await user.type(
      within(dialog).getByLabelText(/로그인 화면 주소/),
      "https://banchanroad.example/login",
    );
    expect(
      within(dialog).getByText(
        "입력한 비밀번호는 암호화해서 저장하고, 화면에 다시 보여주지 않아요. 마지막으로 사용하거나 수정한 뒤 90일이 지나면 자동으로 삭제돼요.",
      ),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole("radio", { name: "붙여넣기" }));
    await user.click(within(dialog).getByLabelText("계정 붙여넣기"));
    await user.paste("a@x.example,pw1");
    await user.click(within(dialog).getByRole("button", { name: "목록에 넣기" }));
    await user.click(within(dialog).getByRole("button", { name: "계정 저장" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "비밀번호를 암호화하지 못했습니다. 잠시 뒤 다시 저장해주세요.",
    );
    expect(within(dialog).getByText("1 / 20")).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "계정 저장" }));
    expect(await screen.findByText(/테스트 계정 1개 등록/)).toBeInTheDocument();
  });

  it("다른 단계 주소로 들어와 사이트를 확인해도 과업·타겟부터 다시 입력한다", async () => {
    const user = userEvent.setup();
    await renderWizard("confirm");

    await checkSite(user);

    // 계획이 없을 때 주소가 사이트 단계로 바뀌었으므로, 확인 뒤에도 사이트 단계에 머뭅니다
    expect(screen.queryByRole("list", { name: "입력 요약" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다음: 과업 · 타겟" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "다음: 과업 · 타겟" }));
    expect(await screen.findByLabelText("타겟 고객 설명")).toBeInTheDocument();
  });

  it("P02b — 사이트를 확인하는 동안 지금 단계·지난 시간을 보여 주고 주소는 바꿀 수 없다", async () => {
    server.use(
      http.post("*/api/v1/projects/:projectId/discoveries", () => new Promise<Response>(() => {})),
    );
    const user = userEvent.setup();
    await renderWizard();

    await user.click(screen.getByRole("button", { name: "확인" }));

    /* 주소 확인이 끝나 기능 탐색 단계 문구와 지난 시간을 보여 줍니다 */
    expect(await screen.findByText("시작 화면의 메뉴와 기능을 읽는 중이에요")).toBeInTheDocument();
    expect(screen.getByText(/지남 · 보통 1~2분 걸려요/)).toBeInTheDocument();
    expect(screen.getByLabelText("제품 URL")).toBeDisabled();
    expect(screen.getByRole("button", { name: "확인 중…" })).toBeDisabled();
  });

  it("다른 실행이 진행 중이면(409) 실행 중이라고 알리고 페르소나 확인 화면에 머문다", async () => {
    const user = userEvent.setup();
    await renderWizard();
    await goToConfirm(user);
    await goToReview(user);

    // 다른 곳에서 먼저 시작한 실행 (mock 이 실제로 409 를 돌려줌)
    const plan = await discoverPersonaPlan({ variant: "problem" });
    const other = await confirmPersonaRun({
      plan_id: plan.plan_id,
      feature_ids: ["shopping"],
      task_ids: ["order"],
      ages: ["any"],
      context: "",
      additional_request: "",
    });
    await user.click(screen.getByRole("button", { name: "실행 시작" }));

    expect(await screen.findByText("이미 실행 중인 테스트가 있어요")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "페르소나 세그먼트" })).toBeInTheDocument();
    // 현재 실행을 다시 받아 그 실행으로 가는 링크를 보여줍니다
    expect(await screen.findByRole("link", { name: "실행 화면 보기" })).toHaveAttribute(
      "href",
      `/projects/1/runs/${other.id}`,
    );
  });

  it("실행을 시작하지 못하면(422) 페르소나 확인 화면에서 알리고 사이트 단계로 보내지 않는다", async () => {
    const user = userEvent.setup();
    await renderWizard();
    await goToConfirm(user);
    await goToReview(user);

    server.use(planErrorHandlers.runInvalid);
    await user.click(screen.getByRole("button", { name: "실행 시작" }));

    expect(await screen.findByText(/실행 입력을 만들지 못했습니다/)).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "페르소나 세그먼트" })).toBeInTheDocument();
  });

  it("같은 화면에서 프로젝트가 바뀌면 입력과 안내를 처음으로 돌린다", async () => {
    const user = userEvent.setup();
    expect(await createTestProject()).toBe("101");
    await renderWizard();
    await checkSite(user);

    await user.click(screen.getByRole("link", { name: "스튜디오 예약 새 테스트" }));

    expect(await screen.findByLabelText("제품 URL")).toHaveValue("https://studio.example");
    expect(screen.queryByText(/접근 가능/)).not.toBeInTheDocument();
    expect(screen.getByText("URL 형식과 사이트 접근 여부를 먼저 확인해요")).toBeInTheDocument();
  });

  it("로그인 없이 테스트로 되돌리면 입력한 테스트 계정을 지운다", async () => {
    const user = userEvent.setup();
    await renderWizard();
    await checkSite(user);
    act(() => {
      useNewTestStore.getState().setLoginMode("account");
      useNewTestStore.getState().setAccounts([{ username: "a@x.example", password: "pw" }]);
    });

    await user.click(await screen.findByRole("radio", { name: /로그인 없이 테스트/ }));

    expect(useNewTestStore.getState().accounts).toEqual([]);
  });
  it("화면을 떠나면 입력한 테스트 계정의 비밀번호를 지운다", async () => {
    const { unmount } = await renderWizard();
    act(() => {
      useNewTestStore.getState().setLoginMode("account");
      useNewTestStore.getState().setAccounts([{ username: "a@x.example", password: "pw" }]);
    });

    unmount();

    expect(useNewTestStore.getState().accounts).toEqual([
      { username: "a@x.example", password: "" },
    ]);
  });

  it("다시 확인이 실패하면 이전 결과로 다음 단계에 가지 않는다", async () => {
    const user = userEvent.setup();
    await renderWizard();
    await checkSite(user);

    server.use(planErrorHandlers.siteUnreachable);
    await user.click(screen.getByRole("button", { name: "다시 확인" }));

    expect(await screen.findByText(/사이트 응답 없음/)).toBeInTheDocument();
    /* 다음을 누르면 다시 확인하지만 실패해 넘어가지 않습니다 */
    await user.click(screen.getByRole("button", { name: "다음: 과업 · 타겟" }));
    expect(await screen.findByText(/사이트 응답 없음/)).toBeInTheDocument();
    expect(screen.queryByLabelText("타겟 고객 설명")).not.toBeInTheDocument();
  });
});

describe("P02 · P05b 리뷰 보완", () => {
  it("확인에 실패한 뒤 주소를 고치면 이전 오류 안내를 지운다", async () => {
    server.use(planErrorHandlers.siteUnreachable);
    const user = userEvent.setup();
    await renderWizard();
    await user.click(screen.getByRole("button", { name: "확인" }));
    expect(await screen.findByText(/사이트 응답 없음/)).toBeInTheDocument();

    await user.type(screen.getByLabelText("제품 URL"), "/shop");

    expect(screen.queryByText(/사이트 응답 없음/)).not.toBeInTheDocument();
    expect(screen.getByText("URL 형식과 사이트 접근 여부를 먼저 확인해요")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "로그인 연결" })).not.toBeInTheDocument();
  });

  it("서버에 연결하지 못하면(0) 사이트 응답 없음·로그인 안내 대신 연결 실패를 알린다", async () => {
    server.use(planErrorHandlers.discoveryNetworkError);
    const user = userEvent.setup();
    await renderWizard();

    await user.click(screen.getByRole("button", { name: "확인" }));

    expect(await screen.findByText("서버에 연결할 수 없어요")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "로그인 연결" })).not.toBeInTheDocument();
  });

  it("직접 추가한 과업은 빈 입력에서 Backspace 로 마지막 것부터 지운다", async () => {
    const user = userEvent.setup();
    await renderWizard();
    await checkSite(user);
    await user.click(screen.getByRole("button", { name: "다음: 과업 · 타겟" }));

    const input = await screen.findByLabelText(/과업 직접 추가/);
    await user.type(input, "배송지 바꾸기{Enter}리뷰 쓰기{Enter}");
    expect(
      within(screen.getByRole("list", { name: "직접 추가한 과업" })).getAllByRole("listitem"),
    ).toHaveLength(2);

    await user.type(input, "{Backspace}");

    expect(screen.getByRole("list", { name: "직접 추가한 과업" })).toHaveTextContent(
      "배송지 바꾸기",
    );
    expect(screen.queryByText("리뷰 쓰기")).not.toBeInTheDocument();
  });

  it("예측 맞추기 이력이 없는 프로젝트는 예측 맞추기 전으로 보여준다", async () => {
    const user = userEvent.setup();
    await createTestProject();
    await renderWizard();
    await user.click(screen.getByRole("link", { name: "스튜디오 예약 새 테스트" }));
    await waitForProject();
    await checkSite(user);
    await user.click(screen.getByRole("button", { name: "다음: 과업 · 타겟" }));
    await user.type(await screen.findByLabelText("타겟 고객 설명"), "첫 방문자");
    await user.click(screen.getByRole("button", { name: "다음: 페르소나" }));

    expect(
      await screen.findByText("아직 예측 맞추기 전이라 기본 모형으로 예측해요"),
    ).toBeInTheDocument();
  });
});

describe("P02~P07 제품 API 계약", () => {
  /* 이 테스트 동안 오간 /api/v1 요청을 모읍니다 */
  function recordRequests() {
    const requests: { method: string; path: string; headers: Headers; body: string }[] = [];
    const listener = async ({ request }: { request: Request }) => {
      const url = new URL(request.url);
      if (!url.pathname.startsWith("/api/v1/")) return;
      requests.push({
        method: request.method,
        path: url.pathname,
        headers: request.headers,
        body: await request.clone().text(),
      });
    };
    server.events.on("request:start", listener);
    onTestFinished(() => server.events.removeListener("request:start", listener));
    return requests;
  }

  const calls = (requests: ReturnType<typeof recordRequests>, method: string, path: RegExp) =>
    requests.filter((request) => request.method === method && path.test(request.path));

  const productError = (status: number, code: string, message: string, fields = {}) =>
    HttpResponse.json({ error: { code, message, fields } }, { status });

  it("사이트 확인 → 탐색 → 계획 → 저장(If-Match) → 확정 → 페르소나 → 실행(Idempotency-Key) 순서로 부른다", async () => {
    const requests = recordRequests();
    const user = userEvent.setup();
    await renderWizard();
    await goToConfirm(user);
    await goToReview(user);
    await user.click(screen.getByRole("button", { name: "실행 시작" }));
    expect(await screen.findByText(/^실행 화면 mock-run-\d+$/)).toBeInTheDocument();

    expect(
      requests
        .filter((request) => request.method !== "GET" || request.path.includes("plan-revisions"))
        .map((request) => `${request.method} ${request.path.replace(/[a-z-]+-\d+/g, ":id")}`),
    ).toEqual([
      "POST /api/v1/projects/1/check",
      "POST /api/v1/projects/1/discoveries",
      "POST /api/v1/projects/1/plans",
      "PATCH /api/v1/plans/:id",
      "POST /api/v1/plans/:id/segment-inferences",
      "PATCH /api/v1/plans/:id",
      "POST /api/v1/plans/:id/confirmations",
      "GET /api/v1/plan-revisions/:id/personas",
      "POST /api/v1/runs",
    ]);
    const patches = calls(requests, "PATCH", /^\/api\/v1\/plans\//);
    expect(patches.map((request) => request.headers.get("If-Match"))).toEqual(['"1"', '"3"']);
    expect(JSON.parse(calls(requests, "POST", /segment-inferences$/)[0].body)).toEqual({
      revision: 2,
    });
    expect(JSON.parse(patches[0].body)).toMatchObject({
      audience: { context: "첫 방문자", ages: ["any"] },
    });
    expect(JSON.parse(patches[1].body).segments).toHaveLength(4);
    /* 시드를 바꾸지 않으면 limits 는 보내지 않습니다 */
    expect(JSON.parse(patches[1].body)).not.toHaveProperty("limits");
    expect(JSON.parse(calls(requests, "POST", /confirmations$/)[0].body)).toEqual({ revision: 4 });
    expect(calls(requests, "POST", /^\/api\/v1\/runs$/)[0].headers.get("Idempotency-Key")).toMatch(
      /^[0-9a-f-]{36}$/,
    );
  });

  it("P05b — 반복을 바꾸면 세그먼트 인원과 같은 저장(PATCH)에 limits.seed_count 를 싣는다", async () => {
    const requests = recordRequests();
    const user = userEvent.setup();
    await renderWizard();
    await checkSite(user);
    await user.click(screen.getByRole("button", { name: "다음: 과업 · 타겟" }));
    await user.type(await screen.findByLabelText("타겟 고객 설명"), "첫 방문자");
    await user.click(screen.getByRole("button", { name: "다음: 페르소나" }));

    expect(await screen.findByLabelText("반복 횟수")).toHaveTextContent("1회");
    expect(screen.getByRole("button", { name: "반복 1회 줄이기" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "반복 1회 늘리기" }));
    expect(
      screen.getByText("데스크톱 1280 · 동시 5회 방문 · 반복 2회 · 스텝 40"),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "다음: 시작 전 확인" }));
    await screen.findByRole("list", { name: "입력 요약" });

    const patches = calls(requests, "PATCH", /^\/api\/v1\/plans\//);
    expect(patches).toHaveLength(2);
    expect(JSON.parse(patches[1].body)).toMatchObject({
      segments: expect.any(Array),
      limits: { seed_count: 2 },
    });
  });

  it("P05b — 모바일을 고르면 같은 저장(PATCH)에 limits.viewport_width 를 싣고 확인 화면에 표시한다", async () => {
    const requests = recordRequests();
    const user = userEvent.setup();
    await renderWizard();
    await checkSite(user);
    await user.click(screen.getByRole("button", { name: "다음: 과업 · 타겟" }));
    await user.type(await screen.findByLabelText("타겟 고객 설명"), "첫 방문자");
    await user.click(screen.getByRole("button", { name: "다음: 페르소나" }));

    await user.click(await screen.findByRole("radio", { name: "모바일 390" }));
    expect(screen.getByText("모바일 390 · 동시 5회 방문 · 반복 1회 · 스텝 40")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "다음: 시작 전 확인" }));
    await screen.findByRole("list", { name: "입력 요약" });

    const patches = calls(requests, "PATCH", /^\/api\/v1\/plans\//);
    expect(JSON.parse(patches[1].body)).toMatchObject({ limits: { viewport_width: 390 } });
    expect(JSON.parse(patches[1].body).limits).not.toHaveProperty("seed_count");
    expect(screen.getByText(/모바일 390 · 동시 5회 방문/)).toBeInTheDocument();
  });

  it("다른 곳에서 계획이 바뀌어 저장이 충돌하면(409) 최신 revision 으로 한 번 더 저장한다", async () => {
    const requests = recordRequests();
    const user = userEvent.setup();
    await renderWizard();
    await checkSite(user);
    await user.click(screen.getByRole("button", { name: "다음: 과업 · 타겟" }));
    await user.type(await screen.findByLabelText("타겟 고객 설명"), "첫 방문자");
    server.use(
      http.patch(
        "*/api/v1/plans/:planId",
        () =>
          productError(
            409,
            "REVISION_CONFLICT",
            "다른 곳에서 계획이 바뀌었습니다. 최신 내용을 다시 불러와주세요.",
          ),
        { once: true },
      ),
    );
    await user.click(screen.getByRole("button", { name: "다음: 페르소나" }));

    expect(await screen.findByRole("heading", { name: "세그먼트 비율" })).toBeInTheDocument();
    expect(calls(requests, "PATCH", /^\/api\/v1\/plans\//)).toHaveLength(2);
    expect(calls(requests, "GET", /^\/api\/v1\/plans\//)).toHaveLength(1);
  });

  it("저장하지 못하면 단계에 머물며 서버 이유를 보여준다", async () => {
    const user = userEvent.setup();
    await renderWizard();
    await checkSite(user);
    await user.click(screen.getByRole("button", { name: "다음: 과업 · 타겟" }));
    await user.type(await screen.findByLabelText("타겟 고객 설명"), "첫 방문자");
    server.use(
      http.patch("*/api/v1/plans/:planId", () =>
        productError(422, "VALIDATION_ERROR", "선택할 수 없는 과업입니다: order", {
          task_ids: ["선택할 수 없는 과업입니다: order"],
        }),
      ),
    );
    await user.click(screen.getByRole("button", { name: "다음: 페르소나" }));

    expect(
      await screen.findByText("입력을 저장하지 못했어요 · 선택할 수 없는 과업입니다: order"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("타겟 고객 설명")).toBeInTheDocument();
  });

  it("확정을 막는 이유(blocking)가 있으면 그 단계 링크와 함께 보여주고 생성을 막는다", async () => {
    const user = userEvent.setup();
    server.use(
      http.patch("*/api/v1/plans/:planId", async ({ params, request }) => {
        const plan = patchPlan(
          String(params.planId),
          request.headers.get("If-Match"),
          (await request.json()) as Record<string, unknown>,
        );
        plan.review.blocking = [
          { step: 3, code: "SEGMENT_TOTAL", message: "세그먼트 합계가 맞지 않습니다." },
        ];
        return HttpResponse.json(plan);
      }),
    );
    await renderWizard();
    await goToConfirm(user);

    const blocking = screen.getByRole("list", { name: "확인이 필요한 입력" });
    expect(blocking).toHaveTextContent("세그먼트 합계가 맞지 않습니다.");
    expect(within(blocking).getByRole("link", { name: "변경 · 3단계" })).toHaveAttribute(
      "href",
      "/projects/1/tests/new?step=persona",
    );
    expect(screen.getByRole("button", { name: "페르소나 생성" })).toBeDisabled();
  });

  it("같은 revision 을 다시 확정하면(ALREADY_CONFIRMED) 이미 만든 확정본을 그대로 쓴다", async () => {
    const requests = recordRequests();
    const user = userEvent.setup();
    await renderWizard();
    await goToConfirm(user);
    await goToReview(user);
    await user.click(screen.getByRole("button", { name: "이전" }));
    await goToReview(user);

    const personas = calls(requests, "GET", /^\/api\/v1\/plan-revisions\/.+\/personas$/);
    expect(calls(requests, "POST", /confirmations$/)).toHaveLength(2);
    expect(personas).toHaveLength(2);
    expect(personas[1].path).toBe(personas[0].path);
  });

  it.each([
    ["연결이 끊겨(0) 다시 누르면 같은 키", () => HttpResponse.error(), true],
    [
      "서버가 거절해(422) 다시 누르면 새 키",
      () => productError(422, "RUN_INPUT_INVALID", "실행 입력을 만들지 못했습니다."),
      false,
    ],
  ])("실행 시작 Idempotency-Key — %s", async (_name, failure, same) => {
    const requests = recordRequests();
    const user = userEvent.setup();
    await renderWizard();
    await goToConfirm(user);
    await goToReview(user);
    server.use(http.post("*/api/v1/runs", failure, { once: true }));
    await user.click(screen.getByRole("button", { name: "실행 시작" }));
    await screen.findByText("실행을 시작하지 못했어요");
    await user.click(screen.getByRole("button", { name: "실행 시작" }));
    await screen.findByText(/^실행 화면 mock-run-\d+$/);

    const keys = calls(requests, "POST", /^\/api\/v1\/runs$/).map((request) =>
      request.headers.get("Idempotency-Key"),
    );
    expect(keys).toHaveLength(2);
    expect(keys[1] === keys[0]).toBe(same);
  });

  it("고친 입력을 저장하지 않고 시작 전 확인으로 돌아와도, 페르소나 생성 전에 그 부분을 저장한다", async () => {
    const requests = recordRequests();
    const user = userEvent.setup();
    await renderWizard();
    await goToConfirm(user);
    /* "변경 · 2단계" 로 가서 타겟을 고친 뒤 "다음" 없이 시작 전 확인 주소로 돌아옵니다 */
    await user.click(screen.getByRole("link", { name: "타겟 고객 변경" }));
    const target = await screen.findByLabelText("타겟 고객 설명");
    await user.clear(target);
    await user.type(target, "퇴근 후 주문하는 직장인");
    await user.click(screen.getByRole("link", { name: "확인 화면으로" }));
    expect(await screen.findByRole("list", { name: "입력 요약" })).toHaveTextContent(
      "퇴근 후 주문하는 직장인",
    );

    await goToReview(user);

    const patches = calls(requests, "PATCH", /^\/api\/v1\/plans\//);
    expect(patches).toHaveLength(3);
    expect(JSON.parse(patches[2].body)).toEqual({
      audience: { context: "퇴근 후 주문하는 직장인", ages: ["any"] },
    });
    /* 저장 1 → 세그먼트 유형 추론 2 → 인원 저장 3 → 타겟 저장 4 (타겟이 바뀌어 유형은 확정 때 다시 정함) */
    expect(JSON.parse(calls(requests, "POST", /confirmations$/)[0].body)).toEqual({ revision: 5 });
  });

  it("입력이 그대로면 페르소나 생성 전에 다시 저장하지 않는다", async () => {
    const requests = recordRequests();
    const user = userEvent.setup();
    await renderWizard();
    await goToConfirm(user);
    await goToReview(user);

    expect(calls(requests, "PATCH", /^\/api\/v1\/plans\//)).toHaveLength(2);
  });

  it("확정하는 사이 다른 곳에서 계획이 바뀌면(409) 최신 revision 으로 다시 확정한다", async () => {
    const requests = recordRequests();
    const user = userEvent.setup();
    await renderWizard();
    await goToConfirm(user);
    server.use(
      http.post(
        "*/api/v1/plans/:planId/confirmations",
        () =>
          productError(
            409,
            "REVISION_CONFLICT",
            "다른 곳에서 계획이 바뀌었습니다. 최신 내용을 다시 불러와주세요.",
          ),
        { once: true },
      ),
    );
    await goToReview(user);

    expect(calls(requests, "POST", /confirmations$/)).toHaveLength(2);
    expect(calls(requests, "GET", /^\/api\/v1\/plans\//)).toHaveLength(1);
  });

  it("테스트 계정이 모자라 탐색하지 못해도(TEST_ACCOUNTS_REQUIRED) 로그인 없이로 돌아갈 수 있다", async () => {
    const user = userEvent.setup();
    await renderWizard();
    await checkSite(user);
    await user.click(screen.getByRole("radio", { name: /테스트 계정 로그인 상태로 테스트/ }));
    await user.click(screen.getByRole("button", { name: "다음: 과업 · 타겟" }));

    expect(
      await screen.findByText(/테스트 계정을 4개 이상 등록해주세요 · 지금 0개/),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /로그인 없이 테스트/ }));
    await user.click(screen.getByRole("button", { name: "다음: 과업 · 타겟" }));
    expect(await screen.findByLabelText("타겟 고객 설명")).toBeInTheDocument();
  });

  it("서버에 저장된 테스트 계정을 불러와 AI 고객 수를 맞추고, 저장할 때 기존 계정을 지우지 않는다", async () => {
    await putTestAccounts(1, {
      accounts: Array.from({ length: 8 }, (_, i) => ({
        username: `saved${i}@x.example`,
        password: "pw",
      })),
    });
    const requests = recordRequests();
    const user = userEvent.setup();
    await renderWizard();
    await checkSite(user);
    expect(await screen.findByText(/테스트 계정 8개 등록/)).toBeInTheDocument();

    /* 비밀번호를 다시 넣지 않고 저장해도 기존 계정은 id 로 보내 서버가 비밀번호를 유지합니다 */
    await user.click(screen.getByRole("button", { name: "테스트 계정 등록" }));
    const dialog = await screen.findByRole("dialog", { name: "테스트 계정 등록" });
    await user.type(
      within(dialog).getByLabelText(/로그인 화면 주소/),
      "https://banchanroad.example/login",
    );
    await user.click(within(dialog).getByRole("button", { name: "계정 저장" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const [put] = calls(requests, "PUT", /test-accounts$/);
    const sent = JSON.parse(put.body).accounts as { id?: string; password?: string }[];
    expect(sent).toHaveLength(8);
    expect(sent.every((account) => account.id && account.password === undefined)).toBe(true);

    /* 서버 총원(8명)으로 진행합니다 */
    await user.click(screen.getByRole("button", { name: "다음: 과업 · 타겟" }));
    await user.type(await screen.findByLabelText("타겟 고객 설명"), "첫 방문자");
    await user.click(screen.getByRole("button", { name: "다음: 페르소나" }));
    expect(await screen.findByText("테스트 계정 8개 → AI 고객 8명")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다음: 시작 전 확인" })).toBeEnabled();
  });

  it.each([
    ["로그인 필요(401)", planErrorHandlers.discoveryUnauthorized, "로그인이 필요해요"],
    ["권한 없음(403)", planErrorHandlers.discoveryForbidden, "이 프로젝트에서는 실행할 수 없어요"],
  ])("%s 는 사이트 단계에서 알린다", async (_name, handler, text) => {
    server.use(handler);
    const user = userEvent.setup();
    await renderWizard();
    await user.click(screen.getByRole("button", { name: "확인" }));

    expect(await screen.findByText(text)).toBeInTheDocument();
    expect(screen.queryByLabelText("타겟 고객 설명")).not.toBeInTheDocument();
  });

  it("주소 확인이 실패해도 탐색이 되면 경고만 보여주고 다음으로 갈 수 있다", async () => {
    server.use(planErrorHandlers.checkFailed);
    const user = userEvent.setup();
    await renderWizard();
    await user.click(screen.getByRole("button", { name: "확인" }));

    expect(
      await screen.findByText("접근 확인 실패 · 주소를 찾을 수 없어요. 도메인을 다시 확인해주세요"),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "다음: 과업 · 타겟" }));
    expect(await screen.findByLabelText("타겟 고객 설명")).toBeInTheDocument();
  });

  it("테스트 계정을 저장하면 서버에 보내고, 다음에서 테스트 계정 모드로 다시 확인한다", async () => {
    const requests = recordRequests();
    const user = userEvent.setup();
    await renderWizard();
    await checkSite(user);
    await user.click(screen.getByRole("button", { name: "테스트 계정 등록" }));
    const dialog = await screen.findByRole("dialog", { name: "테스트 계정 등록" });
    await user.type(
      within(dialog).getByLabelText(/로그인 화면 주소/),
      "https://banchanroad.example/login",
    );
    await user.click(within(dialog).getByRole("radio", { name: "붙여넣기" }));
    await user.click(within(dialog).getByLabelText("계정 붙여넣기"));
    await user.paste(
      ["u0@x.example,pw0", "u1@x.example,pw1", "u2@x.example,pw2", "u3@x.example,pw3"].join("\n"),
    );
    await user.click(within(dialog).getByRole("button", { name: "목록에 넣기" }));
    await user.click(within(dialog).getByRole("button", { name: "계정 저장" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    const [put] = calls(requests, "PUT", /test-accounts$/);
    expect(JSON.parse(put.body).accounts).toHaveLength(4);
    expect(JSON.parse(put.body).accounts[0]).toEqual({ username: "u0@x.example", password: "pw0" });

    await user.click(screen.getByRole("button", { name: "다음: 과업 · 타겟" }));
    await screen.findByLabelText("타겟 고객 설명");
    const discoveries = calls(requests, "POST", /discoveries$/);
    expect(JSON.parse(discoveries[discoveries.length - 1].body).login_mode).toBe("test_account");
  });

  it("50대 이상 칩은 서버 연령 50plus 로 저장한다", async () => {
    const requests = recordRequests();
    const user = userEvent.setup();
    await renderWizard();
    await checkSite(user);
    await user.click(screen.getByRole("button", { name: "다음: 과업 · 타겟" }));
    await user.type(await screen.findByLabelText("타겟 고객 설명"), "첫 방문자");
    await user.click(screen.getByRole("button", { name: "50대 이상" }));
    await user.click(screen.getByRole("button", { name: "다음: 페르소나" }));
    await screen.findByRole("heading", { name: "세그먼트 비율" });

    const [patch] = calls(requests, "PATCH", /^\/api\/v1\/plans\//);
    expect(JSON.parse(patch.body).audience.ages).toEqual(["50plus"]);
  });
});

describe("P02b 사이트 확인 — 다른 화면에 갔다 와도 이어진다", () => {
  /* 기능 탐색 응답을 원할 때까지 붙잡아 둡니다 (풀면 기본 mock 응답으로 이어짐) */
  function holdDiscovery() {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    server.use(
      http.post("*/api/v1/projects/:projectId/discoveries", async () => {
        await gate;
        return undefined;
      }),
    );
    return () => act(() => release());
  }

  /* main.tsx 처럼 StrictMode 로 감쌀 수 있게 (개발 모드에서는 위저드가 두 번 열림) */
  function renderWithOtherPage({ strict = false } = {}) {
    const Wrapper = strict ? StrictMode : Fragment;
    return renderWithProviders(
      <Wrapper>
        <Link to="/projects/1/tests/new">새 테스트로</Link>
        <Link to="/elsewhere">다른 화면으로</Link>
        <Routes>
          <Route element={<ProjectRoute />}>
            <Route path={ROUTES.newTest.path} element={<NewTestPage />} />
          </Route>
          <Route path="/elsewhere" element={<p>다른 화면</p>} />
        </Routes>
      </Wrapper>,
      { route: "/projects/1/tests/new" },
    );
  }

  it("확인 중에 떠났다 돌아오면 진행 표시를 이어 보여 주고, 끝나면 결과가 채워진다", async () => {
    const release = holdDiscovery();
    const user = userEvent.setup();
    renderWithOtherPage();
    await waitForProject();

    await user.click(screen.getByRole("button", { name: "확인" }));
    expect(await screen.findByText("시작 화면의 메뉴와 기능을 읽는 중이에요")).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: "다른 화면으로" }));
    expect(screen.getByText("다른 화면")).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "새 테스트로" }));

    /* 확인이 아직 진행 중이라 같은 단계를 이어 보여 줍니다 */
    expect(await screen.findByText("시작 화면의 메뉴와 기능을 읽는 중이에요")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "확인 중…" })).toBeDisabled();

    await release();
    expect(await screen.findByText("접근 가능 · 응답 0.8초 · 기능 4개 찾음")).toBeInTheDocument();
  });

  it("떠나 있는 사이 확인이 끝났으면 돌아왔을 때 결과로 바로 다음 단계에 갈 수 있다 (StrictMode)", async () => {
    const release = holdDiscovery();
    const user = userEvent.setup();
    renderWithOtherPage({ strict: true });
    await waitForProject();

    await user.click(screen.getByRole("button", { name: "확인" }));
    await screen.findByText("시작 화면의 메뉴와 기능을 읽는 중이에요");
    await user.click(screen.getByRole("link", { name: "다른 화면으로" }));

    await release();
    /* 위저드가 없는 사이 계획까지 만들어져 위저드 입력에 들어가 있습니다 */
    await waitFor(() => expect(useNewTestStore.getState().plan).not.toBeNull());
    expect(useSiteCheckStore.getState().jobs["1"]).toBeUndefined();

    await user.click(screen.getByRole("link", { name: "새 테스트로" }));
    expect(await screen.findByText("접근 가능 · 응답 0.8초 · 기능 4개 찾음")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "다음: 과업 · 타겟" }));
    expect(await screen.findByLabelText("타겟 고객 설명")).toBeInTheDocument();
  });
});

describe("P02 어떻게 테스트할까요? — 코드만 있어요", () => {
  async function chooseCode(user: ReturnType<typeof userEvent.setup>) {
    await renderWizard();
    await user.click(screen.getByRole("radio", { name: /코드만 있어요/ }));
  }

  it("받은 정적 사이트 코드로 확인하면 주소 확인 없이 미리보기로 둘러보고 과업·타겟으로 간다", async () => {
    const requests: { method: string; path: string; body: string }[] = [];
    server.events.on("request:start", async ({ request }) => {
      if (request.method === "POST") {
        requests.push({
          method: request.method,
          path: new URL(request.url).pathname,
          body: await request.clone().text(),
        });
      }
    });
    onTestFinished(() => server.events.removeAllListeners());
    const user = userEvent.setup();
    await chooseCode(user);
    await user.type(screen.getByLabelText("저장소 주소"), "https://github.com/acme/banchanroad");
    await user.click(screen.getByRole("button", { name: "코드 받기" }));
    await screen.findByText(/코드를 준비했어요/);

    const next = screen.getByRole("button", { name: "다음: 과업 · 타겟" });
    expect(next).toBeEnabled();
    await user.click(next);
    expect(await screen.findByLabelText("타겟 고객 설명")).toBeInTheDocument();

    const paths = requests.map((r) => r.path);
    expect(paths).not.toContain("/api/v1/projects/1/check");
    const discovery = requests.find((r) => r.path === "/api/v1/projects/1/discoveries");
    expect(JSON.parse(discovery!.body)).toEqual({
      source_snapshot_id: "00000000-0000-4000-8000-000000000001",
      login_mode: "none",
      variant: "problem",
    });
  });

  it("빌드가 필요한 코드는 다음으로 가지 않고 이유를 알려 준다", async () => {
    server.use(
      http.get("*/api/v1/source-snapshots/:id", ({ params }) =>
        HttpResponse.json({
          id: String(params.id),
          project_id: 1,
          connection_id: 1,
          provider: "git",
          repository_url: "https://github.com/acme/app",
          connection_status: "active",
          ref: "",
          commit_sha: "b".repeat(40),
          subdirectory: "",
          tree_digest: "",
          state: "ready",
          runnable: "needs_build",
          static_root: "",
          file_count: 40,
          total_bytes: 1,
          skipped: {},
          framework: {},
          analysis: { counts: { routes: 3, edges: 2, global_edges: 0, unresolved: 0 } },
          progress: [],
          error: null,
          files_available: true,
          previewable: false,
          created_at: "",
          updated_at: "",
        }),
      ),
    );
    const user = userEvent.setup();
    await chooseCode(user);
    await user.type(screen.getByLabelText("저장소 주소"), "https://github.com/acme/app");
    await user.click(screen.getByRole("button", { name: "코드 받기" }));
    await screen.findByText(/코드를 준비했어요 · commit bbbbbbb/);
    expect(screen.getByRole("button", { name: "다음: 과업 · 타겟" })).toBeDisabled();
    expect(screen.getByText(/빌드가 필요한 코드는 아직 테스트할 수 없어요/)).toBeInTheDocument();
  });

  it("기본은 URL 이고, 코드를 고르면 같은 화면에서 저장소 입력이 펼쳐지고 코드를 받기 전에는 다음이 막힌다", async () => {
    const user = userEvent.setup();
    await renderWizard();
    expect(screen.getByRole("radio", { name: /배포된 URL이 있어요/ })).toBeChecked();
    expect(screen.getByLabelText("제품 URL")).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: /코드만 있어요/ }));
    expect(screen.queryByLabelText("제품 URL")).not.toBeInTheDocument();
    expect(screen.getByLabelText("저장소 주소")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "공개 git 저장소" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "다음: 과업 · 타겟" })).toBeDisabled();
    expect(screen.getByText("코드를 먼저 받아 주세요")).toBeInTheDocument();

    /* URL 로 돌아가면 기존 흐름 그대로 */
    await user.click(screen.getByRole("radio", { name: /배포된 URL이 있어요/ }));
    await checkSite(user);
  });

  it("공개 git 저장소를 받아 commit·정적 사이트·화면 경로와 저장하지 않은 파일을 알려 준다", async () => {
    const requests: { path: string; body: string }[] = [];
    server.events.on("request:start", async ({ request }) => {
      if (request.method === "POST" && request.url.includes("source-snapshots")) {
        requests.push({ path: new URL(request.url).pathname, body: await request.clone().text() });
      }
    });
    onTestFinished(() => server.events.removeAllListeners());
    const user = userEvent.setup();
    await chooseCode(user);
    await user.type(screen.getByLabelText("저장소 주소"), "https://github.com/acme/banchanroad");
    await user.type(screen.getByLabelText("브랜치"), "main");
    await user.click(screen.getByRole("button", { name: "코드 받기" }));

    expect(
      await screen.findByText(
        "코드를 준비했어요 · commit a2d43dd · 파일 11개 · 정적 사이트 · 화면 경로 15개",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/비밀값으로 보이는 파일 1개는 저장하지 않았어요/)).toBeInTheDocument();
    expect(requests).toEqual([
      {
        path: "/api/v1/projects/1/source-snapshots",
        body: JSON.stringify({ git_url: "https://github.com/acme/banchanroad", ref: "main" }),
      },
    ]);
  });

  it("받기에 실패하면 서버 안내를 보여 주고, 주소 형식이 틀리면 보내지 않는다", async () => {
    const user = userEvent.setup();
    await chooseCode(user);
    await user.type(screen.getByLabelText("저장소 주소"), "github.com/acme");
    await user.click(screen.getByRole("button", { name: "코드 받기" }));
    expect(
      screen.getByText("https 로 시작하는 공개 저장소 주소를 입력해주세요"),
    ).toBeInTheDocument();

    await user.clear(screen.getByLabelText("저장소 주소"));
    await user.type(screen.getByLabelText("저장소 주소"), "https://github.com/acme/missing");
    await user.click(screen.getByRole("button", { name: "코드 받기" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "저장소를 받지 못했어요. 공개 저장소인지, 브랜치 이름이 맞는지 확인해주세요.",
    );
  });

  it("zip 을 올려 받는다 (commit 없이 내용으로 고정)", async () => {
    const user = userEvent.setup();
    await chooseCode(user);
    await user.click(screen.getByRole("button", { name: "zip 업로드" }));
    await user.upload(
      screen.getByLabelText("zip 파일"),
      new File(["PK"], "demo-shop.zip", { type: "application/zip" }),
    );
    await user.click(screen.getByRole("button", { name: "코드 받기" }));
    expect(
      await screen.findByText("코드를 준비했어요 · 파일 11개 · 정적 사이트 · 화면 경로 15개"),
    ).toBeInTheDocument();
  });
});

describe("P05b 세그먼트 유형 추론", () => {
  async function toPersonaStep(user: ReturnType<typeof userEvent.setup>) {
    await renderWizard();
    await checkSite(user);
    await user.click(screen.getByRole("button", { name: "다음: 과업 · 타겟" }));
    await user.type(await screen.findByLabelText("타겟 고객 설명"), "첫 방문자");
    await user.click(screen.getByRole("button", { name: "다음: 페르소나" }));
    await screen.findByRole("heading", { name: "세그먼트 비율" });
  }

  it("3단계에 들어오면 세그먼트 이름·상황·능력치를 보여 주고, 다시 정할 수 있다", async () => {
    const user = userEvent.setup();
    let inferences = 0;
    const listener = ({ request }: { request: Request }) => {
      if (request.url.endsWith("/segment-inferences")) inferences += 1;
    };
    server.events.on("request:start", listener);
    onTestFinished(() => server.events.removeListener("request:start", listener));
    await toPersonaStep(user);

    const list = screen.getByRole("list", { name: "세그먼트별 인원" });
    expect(await within(list).findByText("빠른 구매형")).toBeInTheDocument();
    expect(
      within(list).getByText("입력 단계를 최소화하고 바로 주문하려는 방문자"),
    ).toBeInTheDocument();
    expect(within(list).getByText(/인내심 22 · 숙련도 80/)).toBeInTheDocument();
    expect(inferences).toBe(1);

    await user.click(screen.getByRole("button", { name: "다시 정하기" }));
    await waitFor(() => expect(inferences).toBe(2));
    /* 인원은 그대로 고칠 수 있습니다 */
    expect(screen.getByRole("button", { name: "세그먼트 1 1명 늘리기" })).toBeEnabled();
  });

  it("추론에 실패해도 다음 단계로 갈 수 있고, 다시 시도할 수 있다", async () => {
    const user = userEvent.setup();
    server.use(
      http.post(
        "*/api/v1/plans/:planId/segment-inferences",
        () =>
          HttpResponse.json(
            { error: { code: "PERSONA_GENERATION_FAILED", message: "실패", fields: {} } },
            { status: 503 },
          ),
        { once: true },
      ),
    );
    await toPersonaStep(user);

    expect(await screen.findByRole("alert")).toHaveTextContent("세그먼트 유형을 정하지 못했어요");
    expect(screen.getByText("세그먼트 1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다음: 시작 전 확인" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(await screen.findByText("빠른 구매형")).toBeInTheDocument();
  });
});
