import { create } from "zustand";

import type { TestAccount } from "@/pages/new-test/utils/newTest";
import type { AgeOption, DiscoverResponse, Variant } from "@/types/persona.type";

/*
  새 테스트(P02~P05c) 단계별 입력. 단계를 오가도 값이 남아야 해서 zustand 에 둡니다.
  - persist 를 쓰지 않습니다: 테스트 계정 비밀번호가 브라우저 저장소에 남지 않게 하려는 것입니다.
    새로고침하면 처음부터 다시 입력합니다 (BE 탐색 계획도 15분이면 만료).
  - plan(탐색 결과)은 서버 응답이지만 POST(discover) 결과라 Query 캐시로 공유할 수 없어,
    confirm 에 보낼 plan_id 와 함께 여기 둡니다. 주소·버전을 바꾸면 버립니다.
*/
type NewTestState = {
  projectId: string | null;
  siteUrl: string;
  /* BE 개발 서버의 반찬 데모 버전 (fixed=개선, problem=문제) */
  variant: Variant;
  loginMode: "none" | "account";
  accounts: TestAccount[];
  plan: DiscoverResponse | null;
  discoveredAt: number | null;
  taskIds: string[];
  /* 탐색 목록 밖에서 직접 적은 과업 — 실행에는 넣지 않고 따로 보관 */
  customTasks: string[];
  memo: string;
  targetDescription: string;
  ages: AgeOption[];
};

type NewTestActions = {
  reset: (projectId: string, siteUrl: string) => void;
  setSiteUrl: (siteUrl: string) => void;
  setVariant: (variant: Variant) => void;
  setLoginMode: (mode: NewTestState["loginMode"]) => void;
  setAccounts: (accounts: TestAccount[]) => void;
  setPlan: (plan: DiscoverResponse, discoveredAt?: number) => void;
  clearPlan: () => void;
  toggleTask: (taskId: string) => void;
  addCustomTask: (name: string) => void;
  removeCustomTask: (name: string) => void;
  setMemo: (memo: string) => void;
  setTargetDescription: (text: string) => void;
  setAges: (ages: AgeOption[]) => void;
};

const initialInput = (projectId: string | null, siteUrl: string): NewTestState => ({
  projectId,
  siteUrl,
  variant: "problem",
  loginMode: "none",
  accounts: [],
  plan: null,
  discoveredAt: null,
  taskIds: [],
  customTasks: [],
  memo: "",
  targetDescription: "",
  ages: ["any"],
});

export const useNewTestStore = create<NewTestState & NewTestActions>()((set) => ({
  ...initialInput(null, ""),
  reset: (projectId, siteUrl) => set(initialInput(projectId, siteUrl)),
  setSiteUrl: (siteUrl) =>
    set((state) =>
      state.siteUrl === siteUrl ? state : { siteUrl, plan: null, discoveredAt: null },
    ),
  setVariant: (variant) =>
    set((state) =>
      state.variant === variant ? state : { variant, plan: null, discoveredAt: null },
    ),
  setLoginMode: (loginMode) => set({ loginMode }),
  setAccounts: (accounts) => set({ accounts }),
  setPlan: (plan, discoveredAt = Date.now()) =>
    set({
      plan,
      discoveredAt,
      taskIds: plan.tasks.filter((task) => task.suggested).map((task) => task.id),
    }),
  clearPlan: () => set({ plan: null, discoveredAt: null }),
  toggleTask: (taskId) =>
    set((state) => ({
      taskIds: state.taskIds.includes(taskId)
        ? state.taskIds.filter((id) => id !== taskId)
        : [...state.taskIds, taskId],
    })),
  addCustomTask: (name) =>
    set((state) => {
      const trimmed = name.trim();
      if (!trimmed || state.customTasks.includes(trimmed)) return state;
      return { customTasks: [...state.customTasks, trimmed] };
    }),
  removeCustomTask: (name) =>
    set((state) => ({ customTasks: state.customTasks.filter((task) => task !== name) })),
  setMemo: (memo) => set({ memo }),
  setTargetDescription: (targetDescription) => set({ targetDescription }),
  setAges: (ages) => set({ ages }),
}));
