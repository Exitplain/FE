import type {
  ParticipantAnswer,
  ParticipantLink,
  PublicParticipantPage,
} from "@/types/calibration.type";

import axiosInstance from "./axiosInstance";

/*
  참여자 응답 링크 (PART-01~05).
  - 담당자: 목록·만들기·닫기 (로그인 + 프로젝트 소유자)
  - 참여자: 공개 페이지 조회·응답 제출 (로그인 없음). 닫힘·만료·상한 초과는 410
*/
export async function getParticipantLinks(projectId: string) {
  const { data } = await axiosInstance.get<{ items: ParticipantLink[] }>(
    `/api/v1/projects/${encodeURIComponent(projectId)}/participant-links`,
  );
  return data.items;
}

export async function createParticipantLink(
  projectId: string,
  body: {
    task_id: string;
    purpose: ParticipantLink["purpose"];
    days?: number;
    max_responses?: number;
  },
) {
  const { data } = await axiosInstance.post<ParticipantLink>(
    `/api/v1/projects/${encodeURIComponent(projectId)}/participant-links`,
    body,
  );
  return data;
}

export async function disableParticipantLink(linkId: number) {
  const { data } = await axiosInstance.post<ParticipantLink>(
    `/api/v1/participant-links/${linkId}/disable`,
  );
  return data;
}

export async function getPublicParticipant(token: string) {
  const { data } = await axiosInstance.get<PublicParticipantPage>(
    `/api/v1/participant-links/${encodeURIComponent(token)}`,
  );
  return data;
}

export async function submitParticipantAnswer(token: string, body: ParticipantAnswer) {
  const { data } = await axiosInstance.post<{ participant_code: string }>(
    `/api/v1/participant-links/${encodeURIComponent(token)}/responses`,
    body,
  );
  return data;
}
