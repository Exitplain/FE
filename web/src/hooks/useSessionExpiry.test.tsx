import { useQuery } from "@tanstack/react-query";
import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";

import axiosInstance from "@/apis/axiosInstance";
import { queryKeys } from "@/apis/queryKeys";
import { server } from "@/mocks/node";
import { useDemoSessionStore } from "@/stores/useDemoSessionStore";
import { createTestQueryClient, renderWithProviders } from "@/test/renderWithProviders";
import type { AuthSession } from "@/types/auth.type";

import { useSessionExpiry } from "./useSessionExpiry";

const signedIn: AuthSession = {
  authenticated: true,
  user: { email: "maker@example.com", name: "메이커" },
};

function Monitor({ session }: { session: AuthSession }) {
  useSessionExpiry(session);
  return null;
}

function DraftPage() {
  const query = useQuery({
    queryKey: ["expiry-test-draft"],
    queryFn: async () => (await axiosInstance.get("/api/v1/expiry-test-draft")).data,
    initialData: { title: "기존 작업" },
    staleTime: Infinity,
  });
  return query.isError ? <p>조회 오류</p> : <input aria-label="작성 중인 폼" />;
}

afterEach(() => {
  vi.useRealTimers();
  useDemoSessionStore.getState().signOut();
});

describe("서버 세션 만료 감지", () => {
  it("서버 만료 시각이 지나면 계정과 캐시를 비우고 L09를 연다", () => {
    vi.useFakeTimers();
    const session = { ...signedIn, session_expires_at: new Date(Date.now() + 1000).toISOString() };
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(queryKeys.auth.session(), session);
    renderWithProviders(<Monitor session={session} />, { queryClient });
    expect(useDemoSessionStore.getState().account).not.toBeNull();
    act(() => vi.advanceTimersByTime(1000));
    expect(useDemoSessionStore.getState().dialog).toBe("expired");
    expect(useDemoSessionStore.getState().account).toBeNull();
    expect(queryClient.getQueryData(queryKeys.auth.session())).toEqual({ authenticated: false });
  });

  it("로그인 후 세션 재조회가 200 authenticated:false여도 만료를 알린다", () => {
    const { rerender } = renderWithProviders(<Monitor session={signedIn} />);
    expect(useDemoSessionStore.getState().account).not.toBeNull();
    rerender(<Monitor session={{ authenticated: false }} />);
    expect(useDemoSessionStore.getState().dialog).toBe("expired");
  });

  it("배경 조회의 401이 폼을 오류 화면으로 바꿔 입력을 지우지 않는다", async () => {
    server.use(
      http.get("*/api/v1/expiry-test-draft", () =>
        HttpResponse.json(
          { error: { code: "AUTH_REQUIRED", message: "로그인이 필요합니다.", fields: {} } },
          { status: 401 },
        ),
      ),
    );
    const user = userEvent.setup();
    const { queryClient } = renderWithProviders(
      <>
        <Monitor session={signedIn} />
        <DraftPage />
      </>,
    );
    await user.type(screen.getByLabelText("작성 중인 폼"), "입력 유지");
    await act(async () => {
      await queryClient.refetchQueries({ queryKey: ["expiry-test-draft"] });
    });
    expect(useDemoSessionStore.getState().dialog).toBe("expired");
    expect(screen.getByLabelText("작성 중인 폼")).toHaveValue("입력 유지");
    expect(screen.queryByText("조회 오류")).not.toBeInTheDocument();
  });
});
