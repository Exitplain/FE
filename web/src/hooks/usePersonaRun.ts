import { useQuery } from "@tanstack/react-query";

import { getPersonaRun } from "@/apis/persona.api";
import { queryKeys } from "@/apis/queryKeys";

const POLLING_INTERVAL_MS = 2000;

/* 실행 중(running)일 때만 주기 조회합니다. BE 에 SSE·WebSocket 은 없습니다. */
export function usePersonaRun() {
  return useQuery({
    queryKey: queryKeys.personas.current(),
    queryFn: getPersonaRun,
    refetchInterval: (query) =>
      query.state.data?.status === "running" ? POLLING_INTERVAL_MS : false,
  });
}
