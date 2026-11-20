import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";

import type { AuthSession } from "@/types/auth.type";

export const ONBOARDING_STORAGE_KEY = "exitplain-onboarding-v1";
type Status = "started" | "dismissed" | "completed";
type Tour = { accountKey: string | null };
type OnboardingState = {
  accounts: Record<string, Status>;
  tour: Tour | null;
  start: (accountKey: string | null) => void;
  reportTips: Record<string, string>;
  dismiss: (accountKey: string | null) => void;
  complete: (accountKey: string | null, projectId: string) => void;
  dismissReport: (accountKey: string) => void;
};

export function onboardingAccountKey(session: AuthSession | undefined): string | null {
  if (!session?.authenticated || !session.user) return null;
  return session.user.id != null
    ? `id:${session.user.id}`
    : `email:${session.user.email.trim().toLowerCase()}`;
}

// Storage is optional: private browsing or a full disk must not block navigation.
const storage: StateStorage = {
  getItem: (key) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* memory only */
    }
  },
  removeItem: (key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      /* memory only */
    }
  },
};

/** Browser-only persistence until BE supplies an account-level onboarding API. */
export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      accounts: {},
      tour: null,
      reportTips: {},
      start: (accountKey) =>
        set((state) => ({
          tour: { accountKey },
          accounts: accountKey
            ? { ...state.accounts, [accountKey]: state.accounts[accountKey] ?? "started" }
            : state.accounts,
        })),
      dismiss: (accountKey) =>
        set((state) => ({
          tour: null,
          accounts: accountKey
            ? {
                ...state.accounts,
                [accountKey]:
                  state.accounts[accountKey] === "completed" ? "completed" : "dismissed",
              }
            : state.accounts,
        })),
      complete: (accountKey, projectId) =>
        set((state) => ({
          tour: null,
          accounts: accountKey ? { ...state.accounts, [accountKey]: "completed" } : state.accounts,
          reportTips: accountKey
            ? { ...state.reportTips, [accountKey]: projectId }
            : state.reportTips,
        })),
      dismissReport: (accountKey) =>
        set((state) => {
          const reportTips = { ...state.reportTips };
          delete reportTips[accountKey];
          return { reportTips };
        }),
    }),
    {
      name: ONBOARDING_STORAGE_KEY,
      storage: createJSONStorage(() => storage),
      partialize: ({ accounts, reportTips }) => ({
        accounts,
        reportTips,
      }),
      merge: (saved, current) => {
        const values = (saved as { accounts?: unknown } | null)?.accounts;
        const accounts =
          values && typeof values === "object"
            ? (Object.fromEntries(
                Object.entries(values).filter(([, value]) =>
                  ["started", "dismissed", "completed"].includes(value),
                ),
              ) as Record<string, Status>)
            : {};
        const record = saved as { tour?: Tour | null; reportTips?: Record<string, unknown> } | null;
        const reportTips =
          record?.reportTips && typeof record.reportTips === "object"
            ? (Object.fromEntries(
                Object.entries(record.reportTips).filter(([, value]) => typeof value === "string"),
              ) as Record<string, string>)
            : {};
        // A saved tour from an older version must not reopen after login or reload.
        return { ...current, accounts, tour: null, reportTips };
      },
    },
  ),
);
