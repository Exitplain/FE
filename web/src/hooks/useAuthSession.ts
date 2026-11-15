import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { getSession, logout } from "@/apis/auth.api";
import { resetCsrfToken } from "@/apis/axiosInstance";
import { queryKeys } from "@/apis/queryKeys";
import { type DemoAccount, useDemoSessionStore } from "@/stores/useDemoSessionStore";
import { useToastStore } from "@/stores/useToastStore";
import type { ApiError } from "@/types/api.type";
import { AUTH_ERROR, type AuthSession } from "@/types/auth.type";

const SIGNED_OUT: AuthSession = { authenticated: false };

/* 사이드바에 보여줄 이름·이메일. 이름이 없으면 이메일 앞부분을 씁니다 */
export function toAccount(session: AuthSession): DemoAccount | null {
  if (!session.authenticated || !session.user) return null;
  const { email, name } = session.user;
  return { name: name?.trim() || email.split("@")[0] || email, email };
}

/* 앱에 들어올 때 로그인 상태를 확인합니다 (AppLayout 에서 한 번 호출) */
export function useAuthSession() {
  return useQuery<AuthSession, ApiError>({
    queryKey: queryKeys.auth.session(),
    queryFn: getSession,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

/* 로그인 상태 말고 계정에 따라 달라지는 나머지 쿼리 전부 */
const notAuthQuery = {
  predicate: (query: { queryKey: readonly unknown[] }) =>
    query.queryKey[0] !== queryKeys.auth.all[0],
};

/*
  로그인·로그아웃으로 세션이 바뀌었을 때 캐시·계정 표시·CSRF 토큰을 한 번에 맞춥니다.
  - 진행 중인 세션 조회를 먼저 취소해, 늦게 도착한 옛 응답(authenticated: false)이 덮어쓰지 않게 합니다.
  - Django 는 로그인·로그아웃 때 CSRF 토큰을 바꾸므로 받아 둔 토큰을 비웁니다.
  - 다른 계정의 데이터나 비로그인 때의 401 오류가 남지 않게 나머지 쿼리를 다시 받습니다.
    로그인은 무효화(보던 화면은 유지하며 새로 조회), 로그아웃은 초기화(이전 계정 데이터를 바로 지움)합니다.
*/
export function useApplySession() {
  const queryClient = useQueryClient();
  return useCallback(
    async (session: AuthSession) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.auth.session() });
      queryClient.setQueryData(queryKeys.auth.session(), session);
      resetCsrfToken();
      useDemoSessionStore.getState().setAccount(toAccount(session));
      if (session.authenticated) void queryClient.invalidateQueries(notAuthQuery);
      else void queryClient.resetQueries(notAuthQuery);
    },
    [queryClient],
  );
}

/* 로그아웃 (L08). 이미 세션이 끝나 401 AUTH_REQUIRED 가 와도 로그아웃된 것으로 처리합니다 */
export function useLogout() {
  const applySession = useApplySession();
  return useMutation<void, ApiError>({
    mutationFn: logout,
    onSuccess: () => applySession(SIGNED_OUT),
    onError: (error) => {
      if (error.code === AUTH_ERROR.AUTH_REQUIRED) {
        void applySession(SIGNED_OUT);
        return;
      }
      useToastStore.getState().show(error.message, "status-error");
    },
  });
}
