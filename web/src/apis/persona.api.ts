import type {
  ConfirmRequest,
  DiscoverRequest,
  DiscoverResponse,
  ExplainAnswer,
  ExplainRequest,
  PersonaReportsResponse,
  PersonaRun,
} from "@/types/persona.type";

import axiosInstance from "./axiosInstance";

/* 현재 페르소나 실행 상태. 실행이 없으면 status 가 idle. 다른(과거) 실행은 조회할 수 없습니다 */
export async function getPersonaRun() {
  const { data } = await axiosInstance.get<PersonaRun>("/api/personas");
  return data;
}

/*
  모의 사이트 메뉴를 읽어 기능·과업 후보를 만든다. 계획은 15분 뒤 만료.
  503 = 서버 예외(탐색 실패 등). 503 은 confirm·explain 에서도 예기치 않은 예외면 납니다.
*/
export async function discoverPersonaPlan(body: DiscoverRequest) {
  const { data } = await axiosInstance.post<DiscoverResponse>("/api/personas/discover", body);
  return data;
}

/* 기능·과업·타겟 확인 후 실행. 400 = 입력 오류·계획 만료(사이트 확인부터 다시), 409 = 실행 중 */
export async function confirmPersonaRun(body: ConfirmRequest) {
  const { data } = await axiosInstance.post<PersonaRun>("/api/personas/confirm", body);
  return data;
}

/* 완료된 실행 목록 (최신순) — P01 사전 테스트 목록. 응답 { reports } 에서 목록만 꺼내 돌려줍니다 */
export async function getPersonaReports() {
  const { data } = await axiosInstance.get<PersonaReportsResponse>("/api/personas/reports");
  return data.reports;
}

/* 세션 기록에 근거한 질문 답변 (규칙 기반). run_id 가 현재 실행과 다르면 400 */
export async function explainPersonaSession(body: ExplainRequest) {
  const { data } = await axiosInstance.post<ExplainAnswer>("/api/personas/explain", body);
  return data;
}
