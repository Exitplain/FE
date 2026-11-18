import { useQuery } from "@tanstack/react-query";

import { getMeasurement } from "@/apis/measurement.api";
import { queryKeys } from "@/apis/queryKeys";

/* 설치 확인: 이 간격으로 다시 받아 보고, 이 시간 동안 수집이 안 오면 실패(R04)로 봅니다 */
export const CHECK_POLL_MS = 2000;
export const CHECK_TIMEOUT_MS = 5 * 60 * 1000;

/* 실측 수집 설치 상태 (GET /projects/{id}/measurement). 설치 확인 중에만 짧게 다시 받습니다 */
export function useMeasurement(projectId: number, { enabled = true, polling = false } = {}) {
  return useQuery({
    queryKey: queryKeys.measurement(projectId),
    queryFn: () => getMeasurement(projectId),
    enabled,
    refetchInterval: polling ? CHECK_POLL_MS : false,
  });
}
