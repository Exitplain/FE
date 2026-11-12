import type {
  ConfirmRequest,
  DiscoverRequest,
  DiscoverResponse,
  PersonaRun,
} from "@/types/persona.type";

import axiosInstance from "./axiosInstance";

/* 현재 페르소나 실행 상태. 실행이 없으면 status 가 idle */
export async function getPersonaRun() {
  const { data } = await axiosInstance.get<PersonaRun>("/api/personas");
  return data;
}

/* 모의 사이트 메뉴를 읽어 기능·과업 후보를 만든다. 계획은 15분 뒤 만료 */
export async function discoverPersonaPlan(body: DiscoverRequest) {
  const { data } = await axiosInstance.post<DiscoverResponse>("/api/personas/discover", body);
  return data;
}

/* 기능·과업·타겟 확인 후 실행. 400 = 계획 만료(사이트 확인부터 다시), 409 = 실행 중 */
export async function confirmPersonaRun(body: ConfirmRequest) {
  const { data } = await axiosInstance.post<PersonaRun>("/api/personas/confirm", body);
  return data;
}
