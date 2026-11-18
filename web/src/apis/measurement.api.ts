import type {
  FunnelDays,
  FunnelDevice,
  MeasurementFunnel,
  MeasurementMapping,
  MeasurementStatus,
  MeasurementSteps,
} from "@/types/measurement.type";

import axiosInstance from "./axiosInstance";

/*
  실측 수집 (R01~R05). 로그인 + 프로젝트 소유자만 됩니다.
  고객 사이트가 부르는 /api/v1/e.js · /api/v1/collect 는 FE 가 부르지 않습니다.
*/

export async function getMeasurement(projectId: number): Promise<MeasurementStatus> {
  const { data } = await axiosInstance.get<MeasurementStatus>(
    `/api/v1/projects/${projectId}/measurement`,
  );
  return data;
}

/* 수집 키 발급. 이미 있으면 같은 키를 돌려줍니다. 배포 주소가 없으면 409 NOT_DEPLOYED */
export async function issueMeasurement(projectId: number): Promise<MeasurementStatus> {
  const { data } = await axiosInstance.post<MeasurementStatus>(
    `/api/v1/projects/${projectId}/measurement`,
    {},
  );
  return data;
}

export async function getMeasurementSteps(projectId: number, days = 7): Promise<MeasurementSteps> {
  const { data } = await axiosInstance.get<MeasurementSteps>(
    `/api/v1/projects/${projectId}/measurement/steps`,
    { params: { days } },
  );
  return data;
}

export async function getMeasurementMapping(projectId: number): Promise<MeasurementMapping> {
  const { data } = await axiosInstance.get<MeasurementMapping>(
    `/api/v1/projects/${projectId}/measurement/mapping`,
  );
  return data;
}

/* 매핑을 통째로 바꿉니다. null 은 "매핑 안 함" */
export async function saveMeasurementMapping(
  projectId: number,
  mapping: Record<string, string | null>,
): Promise<MeasurementMapping> {
  const { data } = await axiosInstance.put<MeasurementMapping>(
    `/api/v1/projects/${projectId}/measurement/mapping`,
    { mapping },
  );
  return data;
}

/* R06·R08 과업별 실측 퍼널과 예측 범위 비교 */
export async function getMeasurementFunnel(
  projectId: number,
  days: FunnelDays,
  device: FunnelDevice,
): Promise<MeasurementFunnel> {
  const { data } = await axiosInstance.get<MeasurementFunnel>(
    `/api/v1/projects/${projectId}/measurement/funnel`,
    { params: { days, device } },
  );
  return data;
}
