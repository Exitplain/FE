import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Link } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { queryKeys } from "@/apis/queryKeys";
import { useOnboardingStore } from "@/stores/useOnboardingStore";
import { createTestQueryClient, renderWithProviders } from "@/test/renderWithProviders";
import OnboardingHint from "./OnboardingHint";
const defaultWidth = window.innerWidth;

beforeEach(() => useOnboardingStore.setState({ accounts: {}, tour: null, reportTips: {} }));
afterEach(() => {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: defaultWidth });
  vi.restoreAllMocks();
  useOnboardingStore.setState({ accounts: {}, tour: null, reportTips: {} });
});

it("실제 버튼을 뚫어 강조하고 창 크기 변경에 따라 위치를 맞추며 입력을 막지 않는다", async () => {
  let left = 20;
  const original = HTMLElement.prototype.getBoundingClientRect;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
    this: HTMLElement,
  ) {
    return this.dataset.tour
      ? {
          left,
          top: 200,
          width: 180,
          height: 40,
          right: left + 180,
          bottom: 240,
          x: left,
          y: 200,
          toJSON: () => ({}),
        }
      : original.call(this);
  });
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(queryKeys.auth.session(), {
    authenticated: true,
    user: { id: 42, email: "maker@example.com" },
  });
  useOnboardingStore.getState().start("id:42");
  renderWithProviders(
    <>
      <Link data-tour="create-project" to="/?create=1">
        새 프로젝트
      </Link>
      <input aria-label="작업 메모" />
      <OnboardingHint step="intro" />
    </>,
    { queryClient },
  );
  expect(screen.getByTestId("onboarding-highlight")).toHaveStyle({
    left: "14px",
    top: "194px",
    width: "192px",
    height: "52px",
  });
  expect(screen.getByTestId("onboarding-scrim")).toHaveClass("pointer-events-none");
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("작업 메모"), "작성 중");
  expect(screen.getByLabelText("작업 메모")).toHaveValue("작성 중");
  left = 40;
  act(() => window.dispatchEvent(new Event("resize")));
  await waitFor(() =>
    expect(screen.getByTestId("onboarding-highlight")).toHaveStyle({ left: "34px" }),
  );
  await user.click(screen.getByRole("button", { name: "안내 접기" }));
  expect(screen.queryByTestId("onboarding-scrim")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "안내 펼치기" }));
  expect(screen.getByTestId("onboarding-scrim")).toBeInTheDocument();
  expect(screen.getByLabelText("작업 메모")).toHaveValue("작성 중");
  await user.click(screen.getByRole("button", { name: "안내 종료" }));
  expect(screen.queryByTestId("onboarding-scrim")).not.toBeInTheDocument();
});

it("대상이 없거나 화면 밖이면 어두운 덮개 없이 닫을 수 있는 안내만 보여준다", async () => {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(queryKeys.auth.session(), {
    authenticated: true,
    user: { id: 42, email: "maker@example.com" },
  });
  useOnboardingStore.getState().start("id:42");
  renderWithProviders(<OnboardingHint step="intro" />, { queryClient });
  expect(screen.queryByTestId("onboarding-scrim")).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "새 프로젝트 열기" })).toBeInTheDocument();
  await userEvent.setup().click(screen.getByRole("button", { name: "안내 종료" }));
  expect(screen.queryByRole("region", { name: "첫 테스트 준비 안내" })).not.toBeInTheDocument();
});

it("좁은 창의 등록 모달은 안내를 폼 위에 배치해 입력을 가리지 않는다", async () => {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 560 });
  const original = HTMLElement.prototype.getBoundingClientRect;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
    this: HTMLElement,
  ) {
    return this.getAttribute("role") === "dialog"
      ? {
          left: 24,
          top: 24,
          width: 512,
          height: 700,
          right: 536,
          bottom: 724,
          x: 24,
          y: 24,
          toJSON: () => ({}),
        }
      : original.call(this);
  });
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(queryKeys.auth.session(), {
    authenticated: true,
    user: { id: 42, email: "maker@example.com" },
  });
  useOnboardingStore.getState().start("id:42");
  renderWithProviders(
    <div role="dialog" aria-label="새 프로젝트">
      <OnboardingHint step="create" />
      <input aria-label="프로젝트 이름" />
    </div>,
    { queryClient },
  );
  const card = screen.getByTestId("onboarding-coachmark");
  expect(card).not.toHaveClass("fixed");
  expect(card.closest('[data-onboarding-marker="create"]')).not.toBeNull();
  await userEvent.setup().type(screen.getByLabelText("프로젝트 이름"), "내 서비스");
  expect(screen.getByLabelText("프로젝트 이름")).toHaveValue("내 서비스");
});
