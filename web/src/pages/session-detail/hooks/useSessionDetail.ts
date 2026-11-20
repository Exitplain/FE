import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/apis/queryKeys";
import { getReportSession } from "@/apis/report.api";
import { useRunReport } from "@/pages/report/hooks/useRunReport";
import { ApiError } from "@/types/api.type";
import type { ReportSessionKey } from "@/types/report.type";

import { toPersonaSession } from "../utils/sessionAdapter";

/*
  세션 상세(P15·P16). 주소에는 실행 id 와 세션 키(과업·시드·페르소나)만 있어,
  실행의 최신 리포트(GET /api/v1/runs/{id}/reports)로 리포트 id 를 먼저 얻습니다.
  없음·로그인 필요·권한 없음·기록 없음(409)은 다시 물어도 같아서 바로 보여 줍니다.
*/
export function useSessionDetail(runId: string, key: ReportSessionKey) {
  const report = useRunReport(runId);
  const reportId = report.data?.report_id;
  const session = useQuery({
    queryKey: queryKeys.reports.session(reportId ?? "", key.taskId, key.seed, key.personaId),
    queryFn: () => getReportSession(reportId!, key),
    enabled: reportId != null,
    /* 리포트 revision 이 바뀌어도 새 세션을 받는 동안 이전 화면을 둡니다 (로딩 깜빡임 방지) */
    placeholderData: keepPreviousData,
    select: toPersonaSession,
    retry: (count, error) =>
      !(error instanceof ApiError && [401, 403, 404, 409].includes(error.status)) && count < 1,
  });
  /* 리포트를 못 받으면 세션도 볼 수 없어 리포트 오류를 그대로 씁니다 */
  const failed = report.isError ? report : session.isError ? session : null;
  return {
    data: session.data,
    isPending: !failed && !session.data,
    error: failed?.error ?? null,
    refetch: () => void (report.isError ? report.refetch() : session.refetch()),
  };
}
