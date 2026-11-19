import type { ParticipantAnswer, PublicParticipantPage } from "@/types/calibration.type";

import axiosInstance from "./axiosInstance";

/*
  참여자 응답 페이지 (PART-03~05). 링크를 만드는 화면은 뺐고, 이미 나간 링크의 공개 페이지만 남깁니다.
  - 참여자: 공개 페이지 조회·응답 제출 (로그인 없음). 닫힘·만료·상한 초과는 410
*/
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
