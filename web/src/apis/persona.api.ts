import type {
  ConfirmRequest,
  DiscoverRequest,
  DiscoverResponse,
  ExplainAnswer,
  ExplainRequest,
  HumanObservationRequest,
  PersonaReport,
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

/* 완료된 실행의 리포트 (P12). 404 = 저장된 실행 없음, 409 = 아직 끝나지 않은 실행 */
export async function getPersonaReport(runId: string) {
  const { data } = await axiosInstance.get<PersonaReport>("/api/personas/report", {
    params: { run_id: runId },
  });
  return data;
}

/* 리포트 Markdown 내보내기 (P13) */
export async function getPersonaReportMarkdown(runId: string) {
  const { data } = await axiosInstance.get<string>("/api/personas/report.md", {
    params: { run_id: runId },
    responseType: "text",
  });
  return data;
}

/* 리포트 PDF 내보내기 (P13). 서버는 한 번에 1건만 만들어 생성 중 추가 요청은 429, 생성 실패는 503 */
export async function getPersonaReportPdf(runId: string) {
  const { data } = await axiosInstance.get<Blob>("/api/personas/report.pdf", {
    params: { run_id: runId },
    responseType: "blob",
  });
  return data;
}

/* 사람 관측 저장 (K04). 현재 실행이 완료된 뒤에만 저장되며 갱신된 실행 상태를 돌려줍니다 */
export async function saveHumanObservation(body: HumanObservationRequest) {
  const { data } = await axiosInstance.post<PersonaRun>("/api/personas/human", body);
  return data;
}

/*
  화면 근거 이미지 주소 (GET /api/artifacts/{id}, PNG). <img src> 로 바로 씁니다.
  ID 는 API 응답에서 받은 불투명 토큰이라 그대로 인코딩만 합니다. 없는 ID 는 404.
*/
export function artifactUrl(artifactId: string) {
  /* axiosInstance 의 baseURL 과 같은 값. 끝의 / 는 떼서 //api 가 되지 않게 합니다 */
  const base = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
  return `${base}/api/artifacts/${encodeURIComponent(artifactId)}`;
}
