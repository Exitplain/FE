import type { Page } from "@/types/api.type";
import type {
  V1ProjectCreateRequest,
  V1ProjectDetail,
  V1ProjectSummary,
} from "@/types/project.v1.type";

import axiosInstance from "./axiosInstance";

/* 샘플 프로젝트 목록. 로그인 없이 조회합니다 */
export async function getSampleProjects(): Promise<Page<V1ProjectSummary>> {
  const { data } = await axiosInstance.get<Page<V1ProjectSummary>>("/api/v1/sample/projects");
  return data;
}

/* 내 프로젝트 목록 (수정일 최신순). 로그인하지 않으면 401 AUTH_REQUIRED */
export async function getMyProjects(limit = 100): Promise<Page<V1ProjectSummary>> {
  const { data } = await axiosInstance.get<Page<V1ProjectSummary>>("/api/v1/projects", {
    params: { limit },
  });
  return data;
}

/* 프로젝트 상세. 샘플은 로그인 없이, 그 밖에는 소유자만 (401·403·404) */
export async function getProjectDetail(projectId: number): Promise<V1ProjectDetail> {
  const { data } = await axiosInstance.get<V1ProjectDetail>(`/api/v1/projects/${projectId}`);
  return data;
}

/* 프로젝트 만들기. 422 VALIDATION_ERROR(fields) · 409 DUPLICATE_PROJECT(fields.entry_url) */
export async function createProjectV1(body: V1ProjectCreateRequest): Promise<V1ProjectDetail> {
  const { data } = await axiosInstance.post<V1ProjectDetail>("/api/v1/projects", body);
  return data;
}

/* 보관 삭제. 이미 삭제됐어도 204, 실행 중 409 RUN_IN_PROGRESS, 샘플·타인 프로젝트 403. */
export async function deleteProjectV1(projectId: number): Promise<void> {
  await axiosInstance.delete(`/api/v1/projects/${projectId}`);
}
