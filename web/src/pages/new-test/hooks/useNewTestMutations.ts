import { useMutation, useQueryClient } from "@tanstack/react-query";

import { confirmPersonaRun, discoverPersonaPlan } from "@/apis/persona.api";
import { queryKeys } from "@/apis/queryKeys";
import type { ApiError } from "@/types/api.type";
import type {
  ConfirmRequest,
  DiscoverRequest,
  DiscoverResponse,
  PersonaRun,
} from "@/types/persona.type";

/* P02 사이트 확인 — 503 이면 E08 */
export function useDiscoverPlan() {
  return useMutation<DiscoverResponse, ApiError, DiscoverRequest>({
    mutationFn: discoverPersonaPlan,
  });
}

/*
  P05c 실행 시작. 성공 응답이 곧 실행 상태라 현재 실행 캐시를 바로 채워
  실행 화면이 빈 화면 없이 시작하게 합니다.
*/
export function useConfirmRun() {
  const queryClient = useQueryClient();
  return useMutation<PersonaRun, ApiError, ConfirmRequest>({
    mutationFn: confirmPersonaRun,
    onSuccess: (run) => {
      queryClient.setQueryData(queryKeys.personas.current(), run);
      void queryClient.invalidateQueries({ queryKey: queryKeys.personas.reports() });
    },
  });
}
