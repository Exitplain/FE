import { useQuery } from "@tanstack/react-query";

import { getPersonaReports } from "@/apis/persona.api";
import { queryKeys } from "@/apis/queryKeys";

/* 완료된 페르소나 실행 목록 (최신순). P01 목록과 이후 리포트 실행 선택에서 함께 씁니다 */
export function usePersonaReports({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.personas.reports(),
    queryFn: getPersonaReports,
    enabled,
  });
}
