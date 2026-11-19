import type {
  FunnelDays,
  FunnelDevice,
  MeasurementFunnel,
  MeasurementImport,
  MeasurementImportResult,
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

/*
  스크립트를 넣을 수 없는 사이트의 CSV 로그 올리기 (5MB·10만 줄까지).
  형식이 틀린 줄은 건너뛰고 결과에 줄 번호와 이유가 옵니다. 같은 파일을 다시 올리면 409 DUPLICATE_IMPORT.
*/
export async function uploadMeasurementCsv(
  projectId: number,
  file: File,
): Promise<MeasurementImportResult> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await axiosInstance.post<MeasurementImportResult>(
    `/api/v1/projects/${projectId}/measurement/imports`,
    form,
    /* 브라우저가 multipart 경계를 넣도록 Content-Type 은 비웁니다 (기본값이 JSON) */
    { headers: { "Content-Type": undefined } },
  );
  return data;
}

export async function getMeasurementImports(projectId: number): Promise<MeasurementImport[]> {
  const { data } = await axiosInstance.get<{ items: MeasurementImport[] }>(
    `/api/v1/projects/${projectId}/measurement/imports`,
  );
  return data.items;
}

/* 잘못 올린 파일을 그 파일로 넣은 줄과 함께 지웁니다 */
export async function deleteMeasurementImport(projectId: number, importId: number): Promise<void> {
  await axiosInstance.delete(`/api/v1/projects/${projectId}/measurement/imports/${importId}`);
}

/* 머리글과 예시 줄이 든 CSV (엑셀에서 한글이 깨지지 않게 BOM 포함) */
export async function getMeasurementCsvTemplate(projectId: number): Promise<Blob> {
  const { data } = await axiosInstance.get<Blob>(
    `/api/v1/projects/${projectId}/measurement/csv-template`,
    { responseType: "blob" },
  );
  return data;
}
