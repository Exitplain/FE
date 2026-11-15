import type { Page } from "@/types/api.type";
import type { V1ProjectSummary } from "@/types/project.v1.type";

import axiosInstance from "./axiosInstance";

/* 샘플 프로젝트 목록. 로그인 없이 조회합니다 */
export async function getSampleProjects(): Promise<Page<V1ProjectSummary>> {
  const { data } = await axiosInstance.get<Page<V1ProjectSummary>>("/api/v1/sample/projects");
  return data;
}
