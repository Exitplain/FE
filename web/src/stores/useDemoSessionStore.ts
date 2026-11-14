import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type DemoAccount = { name: string; email: string };
type DemoSession = {
  account: DemoAccount | null;
  dialog: "login" | "expired" | null;
  openLogin: () => void;
  closeDialog: () => void;
  signIn: (email?: string) => void;
  signOut: () => void;
  expire: () => void;
};

/* UI 확인용 세션입니다. 인증 토큰·권한 검사와 분리하며 다른 화면의 입력 상태는 건드리지 않습니다. */
export const useDemoSessionStore = create<DemoSession>()(
  persist(
    (set) => ({
      account: null,
      dialog: null,
      openLogin: () => set({ dialog: "login" }),
      closeDialog: () => set({ dialog: null }),
      signIn: (email) =>
        set({
          account: { name: "메이커", email: email?.trim() || "maker@example.com" },
          dialog: null,
        }),
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
