import type {
  CalibrationList,
  CalibrationProposal,
  CalibrationRecord,
} from "@/types/calibration.type";

import axiosInstance from "./axiosInstance";

/*
  보정 (K01~K03b). 로그인 + 프로젝트 소유자만.
  적용·되돌리기는 expected_revision(지금 보정 번호)을 같이 보내 다른 적용과 겹치지 않게 합니다 (409 REVISION_CONFLICT).
*/

/* 보정 이력 (K03b) — 최신순 */
export async function getCalibrations(projectId: string) {
  const { data } = await axiosInstance.get<CalibrationList>(
    `/api/v1/projects/${encodeURIComponent(projectId)}/calibrations`,
  );
  return data.items;
}

/* 조정안 (K01). 적용할 수 없으면 available=false 와 reason */
export async function getCalibrationProposal(projectId: string, days = 7) {
  const { data } = await axiosInstance.get<CalibrationProposal>(
    `/api/v1/projects/${encodeURIComponent(projectId)}/calibration/proposal`,
    { params: { days } },
  );
  return data;
}

/* 적용 (K02). 숫자는 서버가 조정안을 다시 계산해 쓰고, 여기서는 고른 행의 key 만 보냅니다 */
export async function applyCalibration(
  projectId: string,
  body: { expected_revision: number; keys: string[]; days?: number },
) {
  const { data } = await axiosInstance.post<CalibrationRecord>(
    `/api/v1/projects/${encodeURIComponent(projectId)}/calibrations`,
    body,
  );
  return data;
}

/* 되돌리기 — 그 기록의 값을 복사한 새 보정 (기록은 지우지 않음) */
export async function restoreCalibration(revisionId: number, expectedRevision: number) {
  const { data } = await axiosInstance.post<CalibrationRecord>(
    `/api/v1/calibrations/${revisionId}/restore`,
    { expected_revision: expectedRevision },
  );
  return data;
}

/* 기본 모형으로 되돌리기 */
export async function resetCalibration(projectId: string, expectedRevision: number) {
  const { data } = await axiosInstance.post<CalibrationRecord>(
    `/api/v1/projects/${encodeURIComponent(projectId)}/calibrations/reset`,
    { expected_revision: expectedRevision },
  );
  return data;
}
