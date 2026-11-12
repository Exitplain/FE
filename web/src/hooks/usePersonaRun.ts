import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { getPersonaRun } from "@/apis/persona.api";
import { queryKeys } from "@/apis/queryKeys";

const POLLING_INTERVAL_MS = 2000;

/*
  현재 페르소나 실행 상태. 실행 중(running)일 때만 주기 조회합니다. BE 에 SSE·WebSocket 은 없습니다.
  실행이 running → completed 로 바뀌면 완료 목록(reports)을 다시 받아 P01 등 목록이 바로 맞춰지게 합니다.
  enabled=false 면 조회하지 않습니다 (없는 프로젝트 화면 등).
*/
export function usePersonaRun({ enabled = true }: { enabled?: boolean } = {}) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.personas.current(),
    queryFn: getPersonaRun,
    enabled,
    refetchInterval: (query) =>
      query.state.data?.status === "running" ? POLLING_INTERVAL_MS : false,
  });

  const previousStatus = useRef(query.data?.status);
  useEffect(() => {
    const status = query.data?.status;
    if (previousStatus.current === "running" && status === "completed") {
      void queryClient.invalidateQueries({ queryKey: queryKeys.personas.reports() });
    }
    previousStatus.current = status;
  }, [query.data?.status, queryClient]);

  return query;
}
