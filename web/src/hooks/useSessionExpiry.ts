import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";

import { resetCsrfToken } from "@/apis/axiosInstance";
import { queryKeys } from "@/apis/queryKeys";
import { useDemoSessionStore } from "@/stores/useDemoSessionStore";
import type { AuthSession } from "@/types/auth.type";
import { onSessionRequired } from "@/utils/authSessionEvents";

import { toAccount } from "./useAuthSession";

/** Keep the current route mounted while L09 and the login dialog cover it. */
export function useSessionExpiry(session: AuthSession | undefined) {
  const client = useQueryClient();
  const expire = useCallback(() => {
    const cached = client.getQueryData<AuthSession>(queryKeys.auth.session());
    const store = useDemoSessionStore.getState();
    // An anonymous visitor receiving 401 has not lost a session.
    if (!store.account && !cached?.authenticated) return;
    store.expire();
    resetCsrfToken();
    // Revert in-flight reads to their previous state before a 401 can replace
    // the current form with an error page. Mutations are never replayed.
    void client.cancelQueries();
    client.setQueryData<AuthSession>(queryKeys.auth.session(), { authenticated: false });
  }, [client]);

  useEffect(() => onSessionRequired(expire), [expire]);

  useEffect(() => {
    if (!session) return;
    if (!session.authenticated && useDemoSessionStore.getState().account) expire();
    else useDemoSessionStore.getState().setAccount(toAccount(session));
  }, [session, expire]);

  useEffect(() => {
    if (!session?.authenticated || !session.session_expires_at) return;
    const expiresAt = Date.parse(session.session_expires_at);
    if (!Number.isFinite(expiresAt)) return;
    let timer: ReturnType<typeof window.setTimeout>;
    const schedule = () => {
      const remaining = expiresAt - Date.now();
      if (remaining <= 0) {
        expire();
        return;
      }
      // setTimeout overflows for dates more than ~24 days away.
      timer = window.setTimeout(schedule, Math.min(remaining, 2_147_483_647));
    };
    schedule();
    return () => window.clearTimeout(timer);
  }, [session, expire]);
}
