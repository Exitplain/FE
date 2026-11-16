import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/apis/queryKeys";
import { getRunReport } from "@/apis/report.api";
import { getRunDetail } from "@/apis/run.api";
import { POLLING_INTERVAL_MS } from "@/hooks/usePersonaRun";
import { ApiError } from "@/types/api.type";
import { ACTIVE_RUN_STATUSES } from "@/types/run.type";

/* 없음·로그인 필요·권한 없음은 다시 물어도 같아서 바로 보여 줍니다 (그 밖은 한 번 더) */
function retryUnlessFinal(count: number, error: Error) {
  return !(error instanceof ApiError && [401, 403, 404].includes(error.status)) && count < 1;
}

/* P12 리포트 — GET /api/v1/runs/{id}/reports (최신 revision) */
export function useRunReport(runId: string) {
  return useQuery({
    queryKey: queryKeys.reports.byRun(runId),
    queryFn: () => getRunReport(runId),
    retry: retryUnlessFinal,
  });
}

/*
  실행 상태 — GET /api/v1/runs/{id}. 차수·이름과, 리포트가 없을 때(404) 진행 중인지 판단하는 데 씁니다.
  진행 중이면 2초마다 다시 받아 끝나는 순간을 알아챕니다. (BE 에 SSE·WebSocket 은 없음)
*/
export function useRunDetail(runId: string) {
  return useQuery({
    queryKey: queryKeys.runs.detail(runId),
    queryFn: () => getRunDetail(runId),
    retry: retryUnlessFinal,
    refetchInterval: (query) =>
      query.state.data && ACTIVE_RUN_STATUSES.includes(query.state.data.status)
        ? POLLING_INTERVAL_MS
        : false,
  });
}
