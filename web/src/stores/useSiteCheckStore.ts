import { create } from "zustand";

import type { WizardPlan } from "@/pages/new-test/utils/newTest";
import type { ApiError } from "@/types/api.type";
import type { Variant } from "@/types/persona.type";
import type { DiscoveryProgressEvent, Plan } from "@/types/plan.type";

/*
  새 테스트 사이트 확인(P02 → P03) 작업. 주소 확인 → 기능 탐색 → 계획 만들기가 1~2분 걸려,
  확인 중에 다른 화면에 갔다 와도 이어지도록 위저드 화면이 아니라 여기(프로젝트별)에 둡니다.
  - 확인 중이면 돌아왔을 때 진행 표시·지난 시간을 이어서 보여 줍니다
  - 끝났는데 위저드가 없었으면 결과를 남겨 두었다가 돌아왔을 때 넣습니다.
    StrictMode 처럼 위저드가 두 번 열려도 같은 결과가 되게 넣은 뒤에도 지우지 않고, 서버 계획이 만료되는 15분 안에만 넣습니다.
  - 비밀번호 같은 계정 입력은 두지 않습니다 (주소·버전·로그인 방식만). 새로고침하면 사라집니다.
*/

/* 사이트 확인 중 지금 하는 일 (P02b 상태 띠 문구) */
export type DiscoverPhase = "check" | "discover" | "plan";

/* 확인을 시작할 때의 사이트 입력 (돌아왔을 때 다시 채움) */
export type SiteCheckRequest = {
  siteUrl: string;
  variant: Variant;
  loginMode: "none" | "account";
};

/* BE 탐색 계획이 만료되는 시간 (끝난 결과는 이 안에서만 다시 넣습니다) */
export const RESULT_TTL_MS = 15 * 60 * 1000;

export type SiteCheckResult = { plan: WizardPlan; server: Plan };

export type SiteCheckJob = {
  request: SiteCheckRequest;
  status: "pending" | "success" | "error";
  phase: DiscoverPhase | null;
  /* 확인을 시작한 시각 (지난 시간 표시) */
  startedAt: number;
  /* 끝난 시각 (실패 안내의 시각 · 결과를 넣어도 되는 기한) */
  finishedAt: number | null;
  result: SiteCheckResult | null;
  error: ApiError | null;
  /* 기능 탐색 중 서버가 알려 준 진행 사건 (P02b 자세히 보기). 이전 BE 면 비어 있습니다 */
  progress?: DiscoveryProgressEvent[];
};

type SiteCheckState = {
  /* 위저드 프로젝트 id(주소의 :projectId) → 작업 */
  jobs: Record<string, SiteCheckJob>;
  setJob: (projectId: string, job: SiteCheckJob) => void;
  updateJob: (projectId: string, update: Partial<SiteCheckJob>) => void;
  clearJob: (projectId: string) => void;
};

export const useSiteCheckStore = create<SiteCheckState>()((set) => ({
  jobs: {},
  setJob: (projectId, job) => set((state) => ({ jobs: { ...state.jobs, [projectId]: job } })),
  updateJob: (projectId, update) =>
    set((state) => {
      const job = state.jobs[projectId];
      return job ? { jobs: { ...state.jobs, [projectId]: { ...job, ...update } } } : state;
    }),
  clearJob: (projectId) =>
    set((state) => {
      if (!(projectId in state.jobs)) return state;
      const jobs = { ...state.jobs };
      delete jobs[projectId];
      return { jobs };
    }),
}));
