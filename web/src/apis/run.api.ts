import type { Page } from "@/types/api.type";
import type { RunDetail, RunItem, RunListQuery } from "@/types/run.type";

import axiosInstance from "./axiosInstance";

/* 프로젝트 실행 목록 (P01). 진행 중인 실행도 함께, 번호 최신순입니다. 샘플 프로젝트는 로그인 없이 조회합니다 */
export async function getRuns(projectId: number, query: RunListQuery = {}): Promise<Page<RunItem>> {
  const { status, kind, ...rest } = query;
  const { data } = await axiosInstance.get<Page<RunItem>>(`/api/v1/projects/${projectId}/runs`, {
    params: {
      ...rest,
      /* 여러 값은 쉼표로 잇습니다 (?status=running,completed) */
      status: status?.length ? status.join(",") : undefined,
      kind: kind?.length ? kind.join(",") : undefined,
    },
  });
  return data;
}

/* 실행 상태 (P09 진행·P12 리포트 대기 판단) */
export async function getRunDetail(runId: string): Promise<RunDetail> {
  const { data } = await axiosInstance.get<RunDetail>(`/api/v1/runs/${encodeURIComponent(runId)}`);
  return data;
}
