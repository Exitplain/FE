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
  await user.click(screen.getByRole("button", { name: "사이트 확인" }));
  await screen.findByText(/기능 4개 · 과업 6개를 찾았어요/);
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
    await user.click(screen.getByRole("button", { name: "사이트 확인" }));

    expect(screen.getByText("https:// 로 시작하는 주소를 입력해 주세요")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다음: 과업 · 타겟" })).toBeDisabled();
  });

  it("E08 — 사이트를 확인하지 못하면 다시 시도할 수 있다", async () => {
    server.use(personaErrorHandlers.discoverUnavailable);
    const user = userEvent.setup();
    renderWizard();

    await user.click(screen.getByRole("button", { name: "사이트 확인" }));

    expect(await screen.findByText(/사이트에 접속하지 못했어요/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다음: 과업 · 타겟" })).toBeDisabled();
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
    expect(screen.getByText(/\/product/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "30대" }));
    await user.type(screen.getByLabelText("타겟 고객 설명"), "퇴근 후 첫 주문");
    await user.click(screen.getByRole("button", { name: "다음: 페르소나" }));

    // P05b: BE 고정 프로필 3개
    expect(await screen.findByText("빠른 구매")).toBeInTheDocument();
    expect(screen.getByText("꼼꼼한 첫 방문")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "다음: 시작 전 확인" }));

    // P05c: 요약과 단계별 변경 링크
    const summary = await screen.findByRole("list", { name: "입력 요약" });
    expect(within(summary).getByText(/30대/)).toBeInTheDocument();
    expect(within(summary).getAllByRole("link", { name: /변경/ }).length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: "실행 시작" }));

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
    await user.type(screen.getByLabelText("타겟 고객 설명"), "첫 방문자");
    await user.click(screen.getByRole("button", { name: "다음: 페르소나" }));

    expect(screen.getByText("과업을 1개 이상 골라주세요")).toBeInTheDocument();
    expect(screen.queryByText("빠른 구매")).not.toBeInTheDocument();
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
    await user.click(await screen.findByRole("button", { name: "실행 시작" }));

    expect(await screen.findByText(/탐색 결과가 만료됐어요/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "사이트 확인" })).toBeInTheDocument();
  });

  it("사이트를 확인하지 않고 다른 단계 주소로 들어오면 첫 단계를 보여준다", () => {
    renderWizard("confirm");

    expect(screen.getByRole("button", { name: "사이트 확인" })).toBeInTheDocument();
  });

  it("P04 — 테스트 계정을 붙여넣고 중복을 알려준 뒤 저장한다", async () => {
    const user = userEvent.setup();
    renderWizard();

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

  it("사이트를 확인하는 동안에는 주소와 데모 버전을 바꿀 수 없다", async () => {
    server.use(http.post("*/api/personas/discover", () => new Promise<Response>(() => {})));
    const user = userEvent.setup();
    renderWizard();

    await user.click(screen.getByRole("button", { name: "사이트 확인" }));

    expect(await screen.findByText(/사이트를 확인하는 중이에요/)).toBeInTheDocument();
    expect(screen.getByLabelText("제품 URL")).toBeDisabled();
    expect(screen.getByRole("radio", { name: "개선 버전" })).toBeDisabled();
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
    await user.click(screen.getByRole("button", { name: "실행 시작" }));

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
    await user.click(screen.getByRole("button", { name: "실행 시작" }));

    expect(await screen.findByText(/기능·과업·연령을 한 개 이상 선택해주세요/)).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "입력 요약" })).toBeInTheDocument();
  });

  it("같은 화면에서 프로젝트가 바뀌면 입력과 안내를 처음으로 돌린다", async () => {
    const user = userEvent.setup();
    renderWizard();
    await checkSite(user);

    await user.click(screen.getByRole("link", { name: "스튜디오 예약 새 테스트" }));

    expect(await screen.findByLabelText("제품 URL")).toHaveValue("https://studio.example");
    expect(screen.queryByText(/기능 4개 · 과업 6개를 찾았어요/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다음: 과업 · 타겟" })).toBeDisabled();
  });

  it("로그인 없이 테스트로 되돌리면 입력한 테스트 계정을 지운다", async () => {
    const user = userEvent.setup();
    renderWizard();
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

    expect(await screen.findByText(/사이트에 접속하지 못했어요/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다음: 과업 · 타겟" })).toBeDisabled();
  });
});
