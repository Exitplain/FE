import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { explainPersonaSession, getPersonaSession } from "@/apis/persona.api";
import { queryKeys } from "@/apis/queryKeys";
import { ApiError } from "@/types/api.type";
import type { PersonaSession } from "@/types/persona.type";

const MAX_ANSWERS = 20;

/* 세션 상세(P15·P16). 없는 세션(404)은 다시 시도하지 않고, 그 밖의 오류는 앱 기본값처럼 한 번만 */
export function useSessionDetail(runId: string, sessionId: string) {
  return useQuery({
    queryKey: queryKeys.personas.session(runId, sessionId),
    queryFn: () => getPersonaSession(runId, sessionId),
    retry: (count, error) => !(error instanceof ApiError && error.status === 404) && count < 1,
  });
}

/* P15d 질문 — 받은 답을 세션 answers 에 바로 붙여 질문 탭에 보여줍니다 */
export function useAskSession(runId: string, sessionId: string) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.personas.session(runId, sessionId);
  return useMutation({
    mutationFn: (question: string) =>
      explainPersonaSession({ run_id: runId, session_id: sessionId, question }),
    /* 질문 중에 늦게 도착한 조회가 방금 붙인 답을 덮어쓰지 않게 진행 중인 조회를 멈춥니다 */
    onMutate: () => queryClient.cancelQueries({ queryKey }),
    onSuccess: (answer) => {
      queryClient.setQueryData<PersonaSession>(queryKey, (session) => {
        if (!session || session.answers?.some((item) => item.id === answer.id)) return session;
        /* 서버처럼 최근 20개까지 */
        return { ...session, answers: [...(session.answers ?? []), answer].slice(-MAX_ANSWERS) };
      });
    },
  });
}
