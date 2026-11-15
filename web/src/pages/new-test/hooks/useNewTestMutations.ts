import { useMutation, useQueryClient } from "@tanstack/react-query";

import { confirmPersonaRun, discoverPersonaPlan, generatePersonaPanel } from "@/apis/persona.api";
import { queryKeys } from "@/apis/queryKeys";
import type { ApiError } from "@/types/api.type";
import type {
  ConfirmRequest,
  DiscoverRequest,
  DiscoverResponse,
  PersonaPanel,
  PersonaPanelRequest,
  PersonaRun,
} from "@/types/persona.type";

/* P06 페르소나 생성 — 끝나면 P07 에서 세그먼트 카드로 보여줍니다 (임시 v1 API) */
export function useGeneratePanel() {
  return useMutation<PersonaPanel, ApiError, PersonaPanelRequest>({
    mutationFn: generatePersonaPanel,
  });
}

/* P02 사이트 확인 — 503 이면 E08 */
export function useDiscoverPlan() {
  return useMutation<DiscoverResponse, ApiError, DiscoverRequest>({
    mutationFn: discoverPersonaPlan,
  });
}

/*
  P07 실행 시작. 성공 응답이 곧 실행 상태라 현재 실행 캐시를 바로 채워
  실행 화면이 빈 화면 없이 시작하게 합니다.
*/
export function useConfirmRun() {
  const queryClient = useQueryClient();
  return useMutation<PersonaRun, ApiError, ConfirmRequest>({
    mutationFn: confirmPersonaRun,
    onSuccess: (run) => {
      queryClient.setQueryData(queryKeys.personas.current(), run);
      void queryClient.invalidateQueries({ queryKey: queryKeys.personas.reports() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.runs.all });
    },
  });
}
