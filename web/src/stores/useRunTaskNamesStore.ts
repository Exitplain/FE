import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/* 오래된 실행부터 지워 브라우저 저장소가 계속 커지지 않게 합니다 */
export const RUN_TASK_NAMES_LIMIT = 30;

type NamedTask = { id: string; name?: string | null };

type RunTaskNamesState = {
  /* 실행 ID → 과업 id → 과업 이름. 넣은 순서(오래된 것 먼저)를 유지합니다 */
  byRunId: Record<string, Record<string, string>>;
  register: (runId: string, tasks: readonly NamedTask[]) => void;
};

/*
  임시: 실행·세션 응답(GET /api/v1/runs/{id}, /sessions)에는 과업 id 만 있어
  실행 화면이 탐색이 만든 id("get-first-order-coupon")를 그대로 보여 줍니다.
  실행을 시작하는 화면(새 테스트·재테스트)은 확정 계획의 과업 이름을 알고 있으니
  그 이름을 실행 ID 별로 이 브라우저(localStorage)에 남겨, 새로 고치거나 다른 탭에서 열어도 씁니다.
  BE 가 실행 응답에 과업 이름을 넣어 주면 지웁니다.
*/
export const useRunTaskNamesStore = create<RunTaskNamesState>()(
  persist(
    (set) => ({
      byRunId: {},
      register: (runId, tasks) => {
        const names: Record<string, string> = {};
        for (const task of tasks) {
          const name = task.name?.trim();
          if (name) names[task.id] = name;
        }
        if (Object.keys(names).length === 0) return;
        /*
          저장소에 쓰지 못하면(용량 초과·저장 차단) persist 가 예외를 던집니다.
          이름은 보조 정보라 이 탭 메모리에만 두고 넘어가, 실행 화면 이동을 막지 않습니다.
        */
        try {
          set((state) => {
            /* 같은 실행을 다시 넣으면 가장 최근으로 옮깁니다 */
            const others = Object.entries(state.byRunId).filter(([id]) => id !== runId);
            const kept = [...others, [runId, names] as const].slice(-RUN_TASK_NAMES_LIMIT);
            return { byRunId: Object.fromEntries(kept) };
          });
        } catch {
          /* 무시 */
        }
      },
    }),
    {
      name: "exitplain-run-task-names",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
