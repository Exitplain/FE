import { create } from "zustand";

import {
  evenSplit,
  inRange,
  panelSize,
  SEED_DEFAULT,
  sum,
  type TestAccount,
  type WizardPlan,
} from "@/pages/new-test/utils/newTest";
import type { Variant } from "@/types/persona.type";
import type { AgeKey, Plan } from "@/types/plan.type";

/*
  새 테스트(P02~P05c) 단계별 입력. 단계를 오가도 값이 남아야 해서 zustand 에 둡니다.
  - persist 를 쓰지 않습니다: 테스트 계정 비밀번호가 브라우저 저장소에 남지 않게 하려는 것입니다.
    새로고침하면 처음부터 다시 입력합니다 (BE 탐색 계획도 15분이면 만료).
  - plan 은 서버 계획(POST /api/v1/projects/{id}/plans)과 탐색 결과를 합친 값입니다(utils WizardPlan).
    입력은 화면에서 바로 바꾸고, 단계를 넘어갈 때 PATCH 로 서버 계획에 저장한 뒤 revision·review 를 갱신합니다.
    주소·버전을 바꾸면 버립니다.
*/
type NewTestState = {
  projectId: string | null;
  siteUrl: string;
  /* BE 개발 서버의 반찬 데모 버전 (fixed=개선, problem=문제) */
  variant: Variant;
  loginMode: "none" | "account";
  accounts: TestAccount[];
  plan: WizardPlan | null;
  taskIds: string[];
  /* 탐색 목록 밖에서 직접 적은 과업 — 실행에는 넣지 않고 따로 보관 */
  customTasks: string[];
  memo: string;
  targetDescription: string;
  ages: AgeKey[];
  /* P05b 세그먼트별 인원 (서버 계획 segments 순서). 서버 최소값은 1명 */
  segmentCounts: number[];
  /* P05b 시드 횟수 (서버 계획 limits.seed_count 와 다르면 "다음"에서 저장) */
  seedCount: number;
};

type NewTestActions = {
  reset: (projectId: string, siteUrl: string) => void;
  setSiteUrl: (siteUrl: string) => void;
  setVariant: (variant: Variant) => void;
  setLoginMode: (mode: NewTestState["loginMode"]) => void;
  setAccounts: (accounts: TestAccount[]) => void;
  /* 새로 만든 계획을 받습니다 (탐색·계획 생성 직후) */
  setPlan: (plan: WizardPlan, server: Plan) => void;
  /* 계획을 고친 뒤(PATCH) revision·review 를 바꿉니다 */
  updatePlan: (update: (plan: WizardPlan) => WizardPlan) => void;
  clearPlan: () => void;
  toggleTask: (taskId: string) => void;
  addCustomTask: (name: string) => void;
  removeCustomTask: (name: string) => void;
  setMemo: (memo: string) => void;
  setTargetDescription: (text: string) => void;
  setAges: (ages: AgeKey[]) => void;
  setSegmentCount: (index: number, count: number) => void;
  setSeedCount: (count: number) => void;
};

const initialInput = (projectId: string | null, siteUrl: string): NewTestState => ({
  projectId,
  siteUrl,
  variant: "problem",
  loginMode: "none",
  accounts: [],
  plan: null,
  taskIds: [],
  customTasks: [],
  memo: "",
  targetDescription: "",
  ages: ["any"],
  segmentCounts: evenSplit(panelSize("none", 0)),
  seedCount: SEED_DEFAULT,
});

/* 패널 인원이 바뀌었을 때만 세그먼트 인원을 새로 나눈 값을 돌려줍니다 */
function resplit(
  state: NewTestState,
  loginMode: NewTestState["loginMode"],
  accountCount: number,
): Partial<NewTestState> {
  const before = panelSize(state.loginMode, state.accounts.length);
  const after = panelSize(loginMode, accountCount);
  return before === after ? {} : { segmentCounts: evenSplit(after) };
}

export const useNewTestStore = create<NewTestState & NewTestActions>()((set) => ({
  ...initialInput(null, ""),
  reset: (projectId, siteUrl) => set(initialInput(projectId, siteUrl)),
  setSiteUrl: (siteUrl) =>
    set((state) => (state.siteUrl === siteUrl ? state : { siteUrl, plan: null })),
  setVariant: (variant) =>
    set((state) => (state.variant === variant ? state : { variant, plan: null })),
  /*
    로그인 없이로 돌아가면 입력한 테스트 계정(비밀번호 포함)을 메모리에서도 지웁니다.
    서버에 이미 저장된 계정(id 있음)은 목록을 남기고 비밀번호만 지웁니다 (저장이 기존 계정을 지우지 않게).
    패널 인원(계정 수 또는 10명)이 실제로 바뀔 때만 세그먼트 인원을 다시 고르게 나눕니다 (P05h).
    같은 인원이면 사용자가 조정한 비율을 그대로 둡니다.
  */
  setLoginMode: (loginMode) =>
    set((state) => {
      if (state.loginMode === loginMode) return state;
      const accounts =
        loginMode === "none"
          ? state.accounts
              .filter((account) => account.id)
              .map((account) => ({ ...account, password: "" }))
          : state.accounts;
      return { loginMode, accounts, ...resplit(state, loginMode, accounts.length) };
    }),
  setAccounts: (accounts) =>
    set((state) => ({ accounts, ...resplit(state, state.loginMode, accounts.length) })),
  /*
    다시 탐색해도 이전에 고른 과업 중 새 결과에 있는 것은 유지하고, 없으면 서버 계획의 기본 과업(추천)을 고릅니다.
    세그먼트 인원은 지금 값의 합계가 서버 범위(로그인 없이 4~20명, 테스트 계정이면 계정 수) 안이면 유지하고,
    아니면 서버 기본값으로 맞춥니다.
    시드는 고른 값을 유지하되 서버 범위(1~3회) 안으로 맞춥니다. 처음 값은 BE 기본값(1회)과 같고,
    만료·주소 변경으로 계획을 다시 만들어도 고른 값이 남습니다 (서버 값과 다르면 "다음"에서 저장).
  */
  setPlan: (plan, server) =>
    set((state) => {
      const kept = state.taskIds.filter((id) => plan.tasks.some((task) => task.id === id));
      const counts = server.segments.map((segment) => segment.count);
      return {
        plan,
        taskIds: kept.length > 0 ? kept : server.task_ids,
        segmentCounts:
          inRange(sum(state.segmentCounts), { min: plan.personaMin, max: plan.personaMax }) &&
          state.segmentCounts.length === counts.length
            ? state.segmentCounts
            : counts,
        seedCount: Math.min(Math.max(state.seedCount, plan.seedRange.min), plan.seedRange.max),
      };
    }),
  updatePlan: (update) => set((state) => (state.plan ? { plan: update(state.plan) } : state)),
  clearPlan: () => set({ plan: null }),
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
  setSegmentCount: (index, count) =>
    set((state) => ({
      segmentCounts: state.segmentCounts.map((value, i) =>
        i === index ? Math.max(1, count) : value,
      ),
    })),
  setSeedCount: (seedCount) => set({ seedCount }),
}));
