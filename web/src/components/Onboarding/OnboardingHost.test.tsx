import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import axiosInstance from "@/apis/axiosInstance";
import { queryKeys } from "@/apis/queryKeys";
import ProjectCreateDialogHost from "@/components/Projects/ProjectCreateDialogHost";
import GuidePage from "@/pages/guide";
import { useDemoSessionStore } from "@/stores/useDemoSessionStore";
import { ONBOARDING_STORAGE_KEY, useOnboardingStore } from "@/stores/useOnboardingStore";
import { createTestQueryClient, renderWithProviders } from "@/test/renderWithProviders";
import type { AuthSession } from "@/types/auth.type";

import OnboardingHost from "./OnboardingHost";
import OnboardingHint from "./OnboardingHint";

const signedIn: AuthSession = { authenticated: true, user: { id: 42, email: "maker@example.com" } };
function LocationProbe() {
  const location = useLocation();
  return (
    <output aria-label="현재 주소">
      {location.pathname}
      {location.search}
      {location.hash}
    </output>
  );
}
function renderTour(session: AuthSession, route = "/") {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(queryKeys.auth.session(), session);
  return renderWithProviders(
    <>
      <OnboardingHost />
      <LocationProbe />
      <input aria-label="작업 메모" />
    </>,
    { route, queryClient },
  );
}
beforeEach(() => {
  useDemoSessionStore.getState().signOut();
  useOnboardingStore.setState({ accounts: {}, tour: null, reportTips: {} });
  localStorage.removeItem(ONBOARDING_STORAGE_KEY);
});
afterEach(() => {
  vi.restoreAllMocks();
  useDemoSessionStore.getState().signOut();
  useOnboardingStore.setState({ accounts: {}, tour: null, reportTips: {} });
  localStorage.removeItem(ONBOARDING_STORAGE_KEY);
});

describe("실제 작업을 따라가는 첫 테스트 안내", () => {
  it("비로그인에는 권하지 않고 나중에를 선택하면 같은 계정에 반복하지 않는다", async () => {
    const user = userEvent.setup();
    const { queryClient, unmount } = renderTour({ authenticated: false });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    act(() => queryClient.setQueryData(queryKeys.auth.session(), signedIn));
    await user.click(await screen.findByRole("button", { name: "나중에" }));
    expect(useOnboardingStore.getState().accounts["id:42"]).toBe("dismissed");
    unmount();
    const again = renderTour(signedIn);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    act(() =>
      again.queryClient.setQueryData(queryKeys.auth.session(), {
        ...signedIn,
        user: { id: 43, email: "other@example.com" },
      }),
    );
    expect(
      await screen.findByRole("dialog", { name: "Exitplain이 처음이신가요?" }),
    ).toBeInTheDocument();
  });

  it("안내 링크는 입력과 주소 조건을 유지하며 실제 작업을 막거나 요청을 자동 실행하지 않는다", async () => {
    const user = userEvent.setup();
    const post = vi.spyOn(axiosInstance, "post");
    renderTour(signedIn, "/guide?tutorial=1&keep=yes#draft");
    await screen.findByRole("region", { name: "첫 테스트 준비 안내" });
    await user.type(screen.getByLabelText("작업 메모"), "작성 중");
    expect(screen.getByLabelText("현재 주소")).toHaveTextContent("/guide?keep=yes#draft");
    await user.click(screen.getByRole("button", { name: "안내 접기" }));
    expect(screen.queryByRole("link", { name: "새 프로젝트 열기" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "안내 펼치기" }));
    expect(screen.getByRole("link", { name: "새 프로젝트 열기" })).toHaveAttribute(
      "href",
      "/guide?keep=yes&create=1#draft",
    );
    await user.click(screen.getByRole("button", { name: "안내 종료" }));
    expect(screen.getByLabelText("작업 메모")).toHaveValue("작성 중");
    expect(post).not.toHaveBeenCalled();
  });

  it("등록 오류에는 같은 폼에서 안내하고 실제 등록이 성공하면 프로젝트 단계로 이어진다", async () => {
    const user = userEvent.setup();
    const post = vi.spyOn(axiosInstance, "post");
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(queryKeys.auth.session(), signedIn);
    useOnboardingStore.getState().start("id:42");
    renderWithProviders(
      <>
        <OnboardingHost />
        <ProjectCreateDialogHost />
        <LocationProbe />
        <Routes>
          <Route path="/projects/:id" element={<OnboardingHint step="test" />} />
          <Route path="*" element={null} />
        </Routes>
      </>,
      { route: "/guide?create=1", queryClient },
    );
    const dialog = screen.getByRole("dialog", { name: "새 프로젝트" });
    expect(within(dialog).getByRole("region", { name: "첫 테스트 준비 안내" })).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "만들기" }));
    expect(await screen.findByText("프로젝트 이름을 입력해주세요")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "진단할 사이트를 등록하세요" })).toBeInTheDocument();
    await user.type(within(dialog).getByRole("textbox", { name: "프로젝트 이름" }), "내 서비스");
    await user.type(
      within(dialog).getByRole("textbox", { name: "사이트 URL" }),
      "https://my-shop.example",
    );
    await user.click(within(dialog).getByRole("button", { name: "만들기" }));
    expect(
      await screen.findByRole("heading", { name: "이 프로젝트의 첫 테스트를 준비하세요" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("현재 주소")).toHaveTextContent("/projects/101");
    expect(post.mock.calls.filter(([url]) => url === "/api/v1/projects")).toHaveLength(1);
  });

  it("다시 보기와 계정 분리, 세션 만료 시 안내 숨김을 지원한다", async () => {
    const user = userEvent.setup();
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(queryKeys.auth.session(), signedIn);
    useOnboardingStore.setState({ accounts: { "id:42": "completed" } });
    renderWithProviders(
      <>
        <GuidePage />
        <OnboardingHost />
      </>,
      { route: "/guide", queryClient },
    );
    await user.click(screen.getByRole("button", { name: "튜토리얼 다시 보기" }));
    expect(screen.getByRole("region", { name: "첫 테스트 준비 안내" })).toBeInTheDocument();
    act(() => useDemoSessionStore.getState().expire());
    expect(screen.queryByRole("region", { name: "첫 테스트 준비 안내" })).not.toBeInTheDocument();
    act(() => {
      useDemoSessionStore.getState().closeDialog();
      queryClient.setQueryData(queryKeys.auth.session(), {
        ...signedIn,
        user: { id: 43, email: "other@example.com" },
      });
    });
    await waitFor(() =>
      expect(screen.queryByRole("region", { name: "첫 테스트 준비 안내" })).not.toBeInTheDocument(),
    );
  });

  it("완료 뒤 해당 프로젝트 리포트만 안내하고 확인 후에는 반복하지 않는다", async () => {
    const user = userEvent.setup();
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(queryKeys.auth.session(), signedIn);
    useOnboardingStore.getState().start("id:42");
    renderWithProviders(
      <>
        <OnboardingHint step="ready" projectId="101" />
        <OnboardingHint report projectId="101" />
        <OnboardingHint report projectId="102" />
      </>,
      { route: "/projects/101/tests/new?step=personas", queryClient },
    );
    const post = vi.spyOn(axiosInstance, "post");
    await user.click(screen.getByRole("button", { name: "준비 안내 마치기" }));
    expect(screen.queryByRole("region", { name: "첫 테스트 준비 안내" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("region", { name: "리포트 사용 안내" })).toHaveLength(1);
    expect(post).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "확인했어요" }));
    expect(screen.queryByRole("region", { name: "리포트 사용 안내" })).not.toBeInTheDocument();
  });

  it("사용자가 실행 화면으로 이동해도 안내를 마치고 해당 프로젝트의 리포트 안내만 예약한다", async () => {
    useOnboardingStore.getState().start("id:42");
    const post = vi.spyOn(axiosInstance, "post");
    renderTour(signedIn, "/projects/101/runs/my-run");
    await waitFor(() => expect(useOnboardingStore.getState().accounts["id:42"]).toBe("completed"));
    expect(useOnboardingStore.getState().reportTips["id:42"]).toBe("101");
    expect(screen.queryByRole("region", { name: "첫 테스트 준비 안내" })).not.toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it("진행 중인 안내를 새로고침 뒤 복원하고 저장소를 못 써도 화면은 작동한다", async () => {
    useOnboardingStore.getState().start("id:42");
    useOnboardingStore.setState({ tour: null }, false);
    // Simulate the persisted payload left before reload.
    localStorage.setItem(
      ONBOARDING_STORAGE_KEY,
      JSON.stringify({
        state: { accounts: { "id:42": "started" }, tour: { accountKey: "id:42" }, reportTips: {} },
        version: 0,
      }),
    );
    await useOnboardingStore.persist.rehydrate();
    expect(useOnboardingStore.getState().tour).toEqual({ accountKey: "id:42" });
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => useOnboardingStore.getState().dismiss("id:42")).not.toThrow();
    spy.mockRestore();
  });
});
