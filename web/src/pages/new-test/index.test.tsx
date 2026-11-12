import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes, useParams } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";

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
    <Routes>
      <Route path={ROUTES.newTest.path} element={<NewTestPage />} />
      <Route path={ROUTES.testRun.path} element={<RunProbe />} />
    </Routes>,
    { route: `/projects/banchan/tests/new${query}` },
  );
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
    expect(screen.getAllByRole("listitem")[0]).toHaveAttribute("aria-current", "step");
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
});
