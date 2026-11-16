import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type DemoAccount = { name: string; email: string };
type DemoSession = {
  account: DemoAccount | null;
  dialog: "login" | "expired" | null;
  openLogin: () => void;
  closeDialog: () => void;
  /* 서버 세션(GET /api/v1/auth/session)에서 받은 계정 표시를 맞춥니다. 열린 모달은 건드리지 않습니다 */
  setAccount: (account: DemoAccount | null) => void;
  signOut: () => void;
  expire: () => void;
};

/*
  사이드바 계정 표시와 로그인·세션 만료 모달 상태입니다.
  로그인 여부의 기준은 서버 세션(hooks/useAuthSession.ts)이고, 이 스토어는 표시용 사본입니다.
  sessionStorage 에 계정 표시만 남겨 새로고침 직후 깜빡임을 줄이고, 세션 응답이 오면 덮어씁니다.
*/
export const useDemoSessionStore = create<DemoSession>()(
  persist(
    (set) => ({
      account: null,
      dialog: null,
      openLogin: () => set({ dialog: "login" }),
      closeDialog: () => set({ dialog: null }),
      setAccount: (account) => set({ account }),
      signOut: () => set({ account: null, dialog: null }),
      expire: () => set({ account: null, dialog: "expired" }),
    }),
    {
      name: "exitplain-demo-session",
      storage: createJSONStorage(() => sessionStorage),
      partialize: ({ account }) => ({ account }),
    },
  ),
);
