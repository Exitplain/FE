import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { Link, Route, Routes, useParams } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";

import { confirmPersonaRun, discoverPersonaPlan } from "@/apis/persona.api";
import { ROUTES } from "@/constants/routes";
import { personaErrorHandlers } from "@/mocks/handlers/personas";
import { server } from "@/mocks/node";
import { useNewTestStore } from "@/stores/useNewTestStore";
import { renderWithProviders } from "@/test/renderWithProviders";

import NewTestPage from "./index";

function RunProbe() {
  const { runId } = useParams();
  return <p>실행 화면 {runId}</p>;
}

function renderWizard(step?: string) {
  const query = step ? `?step=${step}` : "";
  return renderWithProviders(
    <>
      {/* 같은 화면에서 프로젝트만 바뀌는 경우를 확인하려는 링크 */}
      <Link to="/projects/studio/tests/new">스튜디오 예약 새 테스트</Link>
      <Routes>
        <Route path={ROUTES.newTest.path} element={<NewTestPage />} />
        <Route path={ROUTES.testRun.path} element={<RunProbe />} />
      </Routes>
    </>,
    { route: `/projects/banchan/tests/new${query}` },
  );
}

/* 사이트 확인 → 과업·타겟 입력 → 페르소나 → 시작 전 확인 화면까지 */
async function goToConfirm(user: ReturnType<typeof userEvent.setup>) {
  await checkSite(user);
  await user.click(screen.getByRole("button", { name: "다음: 과업 · 타겟" }));
  await user.type(await screen.findByLabelText("타겟 고객 설명"), "첫 방문자");
  await user.click(screen.getByRole("button", { name: "다음: 페르소나" }));
  await user.click(await screen.findByRole("button", { name: "다음: 시작 전 확인" }));
  await screen.findByRole("list", { name: "입력 요약" });
}

async function checkSite(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "확인" }));
  await screen.findByText("접근 가능 · 응답 0.8초 · 화면 12개 읽음");
}

beforeEach(() => useNewTestStore.getState().reset("", ""));

describe("P02~P05c 새 테스트", () => {
  it("프로젝트 주소를 미리 채우고 4단계 중 첫 단계를 보여준다", () => {
    renderWizard();

    expect(screen.getByRole("heading", { level: 1, name: "새 테스트" })).toBeInTheDocument();
    expect(screen.getByLabelText("제품 URL")).toHaveValue("https://banchanroad.example");
    const steps = within(screen.getByRole("list", { name: "진행 단계" })).getAllByRole("listitem");
    expect(steps[0]).toHaveAttribute("aria-current", "step");
  });

  it("E07 — 주소 모양이 틀리면 확인하지 않고 안내한다", async () => {
    const user = userEvent.setup();
    renderWizard();

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
    renderWizard();

    expect(screen.getByText("URL 형식과 사이트 접근 여부를 먼저 확인해요")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "로그인 연결" })).not.toBeInTheDocument();

    await checkSite(user);

    expect(screen.getByRole("heading", { name: "로그인 연결" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다시 확인" })).toBeInTheDocument();
  });

  it("확인 전에 다음을 누르면 사이트를 확인한 뒤 바로 과업·타겟으로 간다", async () => {
    const user = userEvent.setup();
    renderWizard();

    await user.click(screen.getByRole("button", { name: "다음: 과업 · 타겟" }));

    expect(await screen.findByLabelText("타겟 고객 설명")).toBeInTheDocument();
  });

  it("E08 — 사이트를 확인하지 못하면 다시 시도할 수 있다", async () => {
    server.use(personaErrorHandlers.discoverUnavailable);
    const user = userEvent.setup();
    renderWizard();

    await user.click(screen.getByRole("button", { name: "확인" }));

    expect(await screen.findByText(/사이트 응답 없음 · 점검·방화벽 가능성/)).toBeInTheDocument();
    expect(screen.getByText("오류 코드 503")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다시 확인" })).toBeInTheDocument();
  });

  it("사이트 확인 → 과업·타겟 → 페르소나 → 시작 전 확인 → 실행 화면으로 이동한다", async () => {
    const user = userEvent.setup();
    renderWizard();

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
    expect(screen.getByText(/과업 4개 선택 · 20명 × 4개 × 시드 3회/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "30대" }));
    await user.type(screen.getByLabelText("타겟 고객 설명"), "퇴근 후 첫 주문");
    await user.click(screen.getByRole("button", { name: "다음: 페르소나" }));

    // P05b: 세그먼트 4개 × 5명, 보정 적용일
    const segments = await screen.findByRole("list", { name: "세그먼트별 인원" });
    expect(within(segments).getAllByRole("listitem")).toHaveLength(4);
    expect(screen.getByLabelText("세그먼트 1 인원")).toHaveTextContent("5명");
    expect(
      await screen.findByText("이 프로젝트 보정값으로 예측해요 · 11월 5일 적용"),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "다음: 시작 전 확인" }));

    // P05c: 요약과 단계별 변경 링크
    const summary = await screen.findByRole("list", { name: "입력 요약" });
    expect(within(summary).getByText(/30대/)).toBeInTheDocument();
    expect(
      within(summary).getByText("사이트 분석으로 자동 결정 · 과업별 6단계"),
    ).toBeInTheDocument();
    expect(
      within(summary).getByText("에이전트 20명 · 과업 4개 · 보정 11월 5일"),
    ).toBeInTheDocument();
    expect(within(summary).getAllByRole("link", { name: /변경/ }).length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: "페르소나 생성" }));

    expect(await screen.findByText(/실행 화면 mock-run-\d+/)).toBeInTheDocument();
  });

  it("P05a — 과업을 하나도 고르지 않으면 다음으로 가지 않는다", async () => {
    const user = userEvent.setup();
    renderWizard();
    await checkSite(user);
    await user.click(screen.getByRole("button", { name: "다음: 과업 · 타겟" }));

    for (const name of ["첫 주문", "배송 지역 확인", "쿠폰으로 주문", "다음 배송 건너뛰기"]) {
      await user.click(await screen.findByRole("button", { name }));
    }

    /* 고르는 즉시 안내하고 다음을 막습니다 */
    expect(screen.getByText("과업을 1개 이상 골라주세요")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다음: 페르소나" })).toBeDisabled();
  });

  it("P05e — 세그먼트 합계가 20명이 아니면 안내하고 다음을 막는다", async () => {
    const user = userEvent.setup();
    renderWizard();
    await checkSite(user);
    await user.click(screen.getByRole("button", { name: "다음: 과업 · 타겟" }));
    await user.type(await screen.findByLabelText("타겟 고객 설명"), "첫 방문자");
    await user.click(screen.getByRole("button", { name: "다음: 페르소나" }));

    await user.click(await screen.findByRole("button", { name: "세그먼트 4 1명 줄이기" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "합계가 20명이 되도록 맞춰주세요 · 지금 19명",
    );
    expect(screen.getByRole("button", { name: "다음: 시작 전 확인" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "세그먼트 1 1명 늘리기" }));
    expect(screen.getByRole("button", { name: "다음: 시작 전 확인" })).toBeEnabled();
  });

  it("P05h — 테스트 계정으로 테스트하면 계정 수만큼 에이전트를 나눈다", async () => {
    const user = userEvent.setup();
    renderWizard();
    await checkSite(user);
    act(() => {
      useNewTestStore.getState().setLoginMode("account");
      useNewTestStore
        .getState()
        .setAccounts(
          Array.from({ length: 8 }, (_, i) => ({ username: `u${i}@x.example`, password: "pw" })),
        );
    });
    await user.click(screen.getByRole("button", { name: "다음: 과업 · 타겟" }));
    await user.type(await screen.findByLabelText("타겟 고객 설명"), "첫 방문자");
    await user.click(screen.getByRole("button", { name: "다음: 페르소나" }));

    expect(await screen.findByText("테스트 계정 8개 → 에이전트 8명")).toBeInTheDocument();
    expect(screen.getByLabelText("세그먼트 3 인원")).toHaveTextContent("2명");
  });

  it("타겟 고객 설명이 비어 있으면 다음으로 가지 않는다", async () => {
    const user = userEvent.setup();
    renderWizard();
    await checkSite(user);
    await user.click(screen.getByRole("button", { name: "다음: 과업 · 타겟" }));
    await user.click(await screen.findByRole("button", { name: "다음: 페르소나" }));

    expect(screen.getByText("타겟 고객을 적어 주세요")).toBeInTheDocument();
  });

  it("탐색 계획이 만료되면(400) 사이트 확인 단계로 돌아간다", async () => {
    const user = userEvent.setup();
    renderWizard();
    await checkSite(user);
    await user.click(screen.getByRole("button", { name: "다음: 과업 · 타겟" }));
    await user.type(await screen.findByLabelText("타겟 고객 설명"), "첫 방문자");
    await user.click(screen.getByRole("button", { name: "다음: 페르소나" }));
    await user.click(await screen.findByRole("button", { name: "다음: 시작 전 확인" }));

    server.use(personaErrorHandlers.confirmExpired);
    await user.click(await screen.findByRole("button", { name: "페르소나 생성" }));

    expect(await screen.findByText(/탐색 결과가 만료됐어요/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "확인" })).toBeInTheDocument();
  });

  it("사이트를 확인하지 않고 다른 단계 주소로 들어오면 첫 단계를 보여준다", () => {
    renderWizard("confirm");

    expect(screen.getByRole("button", { name: "확인" })).toBeInTheDocument();
  });

  it("P04 — 테스트 계정을 붙여넣고 중복을 알려준 뒤 저장한다", async () => {
    const user = userEvent.setup();
    renderWizard();
    await checkSite(user);

    await user.click(screen.getByRole("radio", { name: /테스트 계정 로그인 상태로 테스트/ }));
    await user.click(screen.getByRole("button", { name: "테스트 계정 등록" }));
    const dialog = await screen.findByRole("dialog", { name: "테스트 계정 등록" });

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
  it("다른 단계 주소로 들어와 사이트를 확인해도 과업·타겟부터 다시 입력한다", async () => {
    const user = userEvent.setup();
    renderWizard("confirm");

    await checkSite(user);

    // 계획이 없을 때 주소가 사이트 단계로 바뀌었으므로, 확인 뒤에도 사이트 단계에 머뭅니다
    expect(screen.queryByRole("list", { name: "입력 요약" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다음: 과업 · 타겟" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "다음: 과업 · 타겟" }));
    expect(await screen.findByLabelText("타겟 고객 설명")).toBeInTheDocument();
  });

  it("P02b — 사이트를 확인하는 동안에는 주소를 바꿀 수 없다", async () => {
    server.use(http.post("*/api/personas/discover", () => new Promise<Response>(() => {})));
    const user = userEvent.setup();
    renderWizard();

    await user.click(screen.getByRole("button", { name: "확인" }));

    expect(await screen.findByText("시작 화면의 메뉴와 기능을 읽는 중이에요")).toBeInTheDocument();
    expect(screen.getByLabelText("제품 URL")).toBeDisabled();
    expect(screen.getByRole("button", { name: "확인 중…" })).toBeDisabled();
  });

  it("다른 실행이 진행 중이면(409) 실행 중이라고 알리고 확인 화면에 머문다", async () => {
    const user = userEvent.setup();
    renderWizard();
    await goToConfirm(user);

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
    await user.click(screen.getByRole("button", { name: "페르소나 생성" }));

    expect(await screen.findByText("이미 실행 중인 테스트가 있어요")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "입력 요약" })).toBeInTheDocument();
    // 현재 실행을 다시 받아 그 실행으로 가는 링크를 보여줍니다
    expect(await screen.findByRole("link", { name: "실행 화면 보기" })).toHaveAttribute(
      "href",
      `/projects/banchan/runs/${other.id}`,
    );
  });

  it("만료가 아닌 입력 오류(400)는 확인 화면에서 알리고 사이트 단계로 보내지 않는다", async () => {
    const user = userEvent.setup();
    renderWizard();
    await goToConfirm(user);

    server.use(
      http.post("*/api/personas/confirm", () =>
        HttpResponse.json({ error: "기능·과업·연령을 한 개 이상 선택해주세요." }, { status: 400 }),
      ),
    );
    await user.click(screen.getByRole("button", { name: "페르소나 생성" }));

    expect(await screen.findByText(/기능·과업·연령을 한 개 이상 선택해주세요/)).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "입력 요약" })).toBeInTheDocument();
  });

  it("같은 화면에서 프로젝트가 바뀌면 입력과 안내를 처음으로 돌린다", async () => {
    const user = userEvent.setup();
    renderWizard();
    await checkSite(user);

    await user.click(screen.getByRole("link", { name: "스튜디오 예약 새 테스트" }));

    expect(await screen.findByLabelText("제품 URL")).toHaveValue("https://studio.example");
    expect(screen.queryByText(/접근 가능/)).not.toBeInTheDocument();
    expect(screen.getByText("URL 형식과 사이트 접근 여부를 먼저 확인해요")).toBeInTheDocument();
  });

  it("로그인 없이 테스트로 되돌리면 입력한 테스트 계정을 지운다", async () => {
    const user = userEvent.setup();
    renderWizard();
    await checkSite(user);
    act(() => {
      useNewTestStore.getState().setLoginMode("account");
      useNewTestStore.getState().setAccounts([{ username: "a@x.example", password: "pw" }]);
    });

    await user.click(await screen.findByRole("radio", { name: /로그인 없이 테스트/ }));

    expect(useNewTestStore.getState().accounts).toEqual([]);
  });
  it("화면을 떠나면 입력한 테스트 계정(비밀번호)을 지운다", () => {
    const { unmount } = renderWizard();
    act(() => {
      useNewTestStore.getState().setLoginMode("account");
      useNewTestStore.getState().setAccounts([{ username: "a@x.example", password: "pw" }]);
    });

    unmount();

    expect(useNewTestStore.getState().accounts).toEqual([]);
  });

  it("다시 확인이 실패하면 이전 결과로 다음 단계에 가지 않는다", async () => {
    const user = userEvent.setup();
    renderWizard();
    await checkSite(user);

    server.use(personaErrorHandlers.discoverUnavailable);
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
    server.use(personaErrorHandlers.discoverUnavailable);
    const user = userEvent.setup();
    renderWizard();
    await user.click(screen.getByRole("button", { name: "확인" }));
    expect(await screen.findByText(/사이트 응답 없음/)).toBeInTheDocument();

    await user.type(screen.getByLabelText("제품 URL"), "/shop");

    expect(screen.queryByText(/사이트 응답 없음/)).not.toBeInTheDocument();
    expect(screen.getByText("URL 형식과 사이트 접근 여부를 먼저 확인해요")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "로그인 연결" })).not.toBeInTheDocument();
  });

  it("서버에 연결하지 못하면(0) 사이트 응답 없음·로그인 안내 대신 연결 실패를 알린다", async () => {
    server.use(personaErrorHandlers.personasNetworkError);
    server.use(http.post("*/api/personas/discover", () => HttpResponse.error()));
    const user = userEvent.setup();
    renderWizard();

    await user.click(screen.getByRole("button", { name: "확인" }));

    expect(await screen.findByText("서버에 연결할 수 없어요")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "로그인 연결" })).not.toBeInTheDocument();
  });

  it("직접 추가한 과업은 빈 입력에서 Backspace 로 마지막 것부터 지운다", async () => {
    const user = userEvent.setup();
    renderWizard();
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

  it("보정 이력이 없는 프로젝트는 보정 전으로 보여준다", async () => {
    const user = userEvent.setup();
    renderWizard();
    await user.click(screen.getByRole("link", { name: "스튜디오 예약 새 테스트" }));
    await checkSite(user);
    await user.click(screen.getByRole("button", { name: "다음: 과업 · 타겟" }));
    await user.type(await screen.findByLabelText("타겟 고객 설명"), "첫 방문자");
    await user.click(screen.getByRole("button", { name: "다음: 페르소나" }));

    expect(await screen.findByText("아직 보정 전이라 기본 모형으로 예측해요")).toBeInTheDocument();
  });
});
