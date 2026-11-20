import { useQuery } from "@tanstack/react-query";

import { getPersonaReport } from "@/apis/persona.api";
import { queryKeys } from "@/apis/queryKeys";
import { ApiError } from "@/types/api.type";

/* 404(실행 없음)·409(아직 안 끝남)는 다시 불러도 같은 답이라 재시도하지 않습니다 */
const FINAL_STATUSES = [404, 409];

/* P12 리포트 — 완료된 실행만. 사람 관측(K04)을 저장하면 이 키를 무효화해 일치 요약을 다시 받습니다 */
export function usePersonaReport(runId: string) {
  return useQuery({
    queryKey: queryKeys.personas.report(runId),
    queryFn: () => getPersonaReport(runId),
    retry: (count, error) =>
      !(error instanceof ApiError && FINAL_STATUSES.includes(error.status)) && count < 1,
  });
}
