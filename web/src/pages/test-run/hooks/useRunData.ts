import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/apis/queryKeys";
import { cancelRun, getRunEvents, getRunSessions } from "@/apis/run.api";
import { POLLING_INTERVAL_MS } from "@/constants/polling";
import type { ApiError } from "@/types/api.type";
import type { RunDetail } from "@/types/run.type";

import { reduceEvents, type RunTrails } from "../utils/runAdapter";

/* 한 번에 받는 세션 수 (BE 최대 200). 넘치면 처음 200개만 보여 주고 전체 수를 함께 알립니다 */
const SESSION_LIMIT = 200;
/* 이벤트 한 번에 받는 수 (BE 최대 500). 한 번 조회에 이어 받는 최대 페이지 (끝난 큰 실행도 끝까지 받게 넉넉히) */
const EVENT_LIMIT = 500;
const EVENT_PAGES = 40;

/* P09·P11 세션 목록 (GET /api/v1/runs/{id}/sessions). 진행 중이면 주기적으로 다시 받습니다 */
export function useRunSessions(runId: string, active: boolean) {
  return useQuery({
    queryKey: queryKeys.runs.sessions(runId),
    queryFn: () => getRunSessions(runId, { limit: SESSION_LIMIT }),
    refetchInterval: active ? POLLING_INTERVAL_MS : false,
  });
}

/*
  P09~P11 관찰·행동 이벤트 (GET /api/v1/runs/{id}/events?after=). 받은 것 뒤만 이어 받아 세션별로 쌓습니다.
  진행 중이면 주기적으로 다시 받고, 끝나면 남은 이벤트를 한 번 더 받은 뒤 멈춥니다.
*/
export function useRunEvents(runId: string, active: boolean) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.runs.events(runId);
  return useQuery({
    queryKey,
    /*
      이미 받은 것은 캐시에 있어 그 커서(after)부터 이어 받습니다. 화면을 다시 열어도 처음부터 받지 않고,
      남은 이벤트가 있으면(has_more) 끝까지 이어 받습니다.
    */
    queryFn: async () => {
      let trails = queryClient.getQueryData<RunTrails>(queryKey) ?? { after: 0, bySession: {} };
      for (let page = 0; page < EVENT_PAGES; page += 1) {
        const result = await getRunEvents(runId, { after: trails.after, limit: EVENT_LIMIT });
        trails = reduceEvents(trails, result.items, result.next_after);
        if (!result.has_more) break;
      }
      return trails;
    },
    refetchInterval: active ? POLLING_INTERVAL_MS : false,
  });
}

/*
  실행 중지 (POST /api/v1/runs/{id}/cancel). 대기 중이면 바로 중지되고, 진행 중이면 중지를 요청한 뒤
  서버가 세션을 멈춥니다. 이미 끝났으면 409 RUN_NOT_ACTIVE 라 상태만 다시 받습니다.
*/
export function useCancelRun(runId: string) {
  const queryClient = useQueryClient();
  return useMutation<RunDetail, ApiError>({
    mutationFn: () => cancelRun(runId),
    onSuccess: (detail) => queryClient.setQueryData(queryKeys.runs.detail(runId), detail),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: queryKeys.runs.all }),
  });
}
