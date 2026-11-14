import type { CalibrationList } from "@/types/calibration.type";

import axiosInstance from "./axiosInstance";

/* 보정 이력 (K03b) — 최신순. 제품 API 미구현이라 mock 으로 동작합니다 */
export async function getCalibrations(projectId: string) {
  const { data } = await axiosInstance.get<CalibrationList>(
    `/api/v1/projects/${encodeURIComponent(projectId)}/calibrations`,
  );
  return data.items;
}
