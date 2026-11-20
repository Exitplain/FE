import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type RetestInfo = {
  /* 무엇과 비교할지 (재테스트 전 실행) */
  baseRunId: string;
  name: string;
  note: string;
  /* 끝나면 P18 전후 비교로 바로 이동 */
  autoCompare: boolean;
};

type RetestState = {
  /* 재테스트 실행 ID → 정보 */
  byRunId: Record<string, RetestInfo>;
  register: (runId: string, info: RetestInfo) => void;
  /* 자동 비교 이동을 한 번 쓰고 나면 다시 이동하지 않게 끕니다 */
  consumeAutoCompare: (runId: string) => void;
};

/*
  임시: P17 재테스트의 이름·고친 내용·비교 대상은 실행 시작(confirm) 요청에 넣을 필드가 없어
  브라우저(sessionStorage)에만 둡니다. 실행 중 새로 고쳐도 자동 비교가 이어지게 탭 단위로 유지합니다.
  서버 명세가 나오면 실행 정보로 옮깁니다.
*/
export const useRetestStore = create<RetestState>()(
  persist(
    (set) => ({
      byRunId: {},
      register: (runId, info) => set((state) => ({ byRunId: { ...state.byRunId, [runId]: info } })),
      consumeAutoCompare: (runId) =>
        set((state) => {
          const info = state.byRunId[runId];
          if (!info) return state;
          return { byRunId: { ...state.byRunId, [runId]: { ...info, autoCompare: false } } };
        }),
    }),
    {
      name: "exitplain-retest",
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
