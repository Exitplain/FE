import { useMutation, useQueryClient } from "@tanstack/react-query";

import { confirmPersonaRun, discoverPersonaPlan } from "@/apis/persona.api";
import { queryKeys } from "@/apis/queryKeys";
import type { ApiError } from "@/types/api.type";
import type { PersonaReport, PersonaRun } from "@/types/persona.type";

/*
  P17 재테스트 시작 — 지난 실행과 같은 과업·기능·타겟으로 다시 실행합니다.
  계획(plan_id)은 15분 뒤 만료라 사이트 확인(discover)과 시작(confirm)을 한 번에 이어 부릅니다.
  임시: 재테스트는 "고친 뒤의 사이트"라 개선 버전(fixed)으로 실행합니다 (mock 은 이탈 확률을 낮춤).
  패널·시드를 지정하는 필드가 아직 없어 같은 패널·시드는 화면 표시로만 약속합니다.
*/
export function useStartRetest() {
  const queryClient = useQueryClient();
  return useMutation<PersonaRun, ApiError, PersonaReport>({
    mutationFn: async (base) => {
      const plan = await discoverPersonaPlan({ variant: "fixed" });
      const audience = base.audience;
      return confirmPersonaRun({
        plan_id: plan.plan_id,
        feature_ids: audience.confirmed_features ?? [],
        task_ids: base.tasks.map((task) => task.id),
        ages: audience.ages?.length ? audience.ages : ["any"],
        context: audience.context ?? "",
        additional_request: audience.additional_request ?? "",
      });
    },
    /* 새 테스트 시작(P07)과 같이 실행 화면이 빈 화면 없이 시작하게 현재 실행 캐시를 채웁니다 */
    onSuccess: (run) => {
      queryClient.setQueryData(queryKeys.personas.current(), run);
      void queryClient.invalidateQueries({ queryKey: queryKeys.personas.reports() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.runs.all });
    },
  });
}
