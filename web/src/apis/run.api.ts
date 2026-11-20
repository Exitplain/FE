import type { Page } from "@/types/api.type";
import type { RunDetail, RunEventPage, RunItem, RunListQuery, RunSession } from "@/types/run.type";

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

/*
  서버가 주는 이미지 경로(/api/v1/observations/{id}/screenshot 등)에 API 주소를 붙입니다.
  같은 출처(프록시)면 그대로, VITE_API_BASE_URL 을 쓰면 그 주소로 요청합니다.
*/
export function apiAssetUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  return `${(import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "")}${path}`;
}

/* 실행의 세션 목록 (P09·P11). 한 번에 최대 200개 */
export async function getRunSessions(
  runId: string,
  query: { limit?: number; cursor?: string } = {},
): Promise<Page<RunSession>> {
  const { data } = await axiosInstance.get<Page<RunSession>>(
    `/api/v1/runs/${encodeURIComponent(runId)}/sessions`,
    { params: query },
  );
  return data;
}

/* 실행 이벤트 (관찰·행동·종료). after 이후 것만 받습니다 */
export async function getRunEvents(
  runId: string,
  query: { after?: number; limit?: number } = {},
): Promise<RunEventPage> {
  const { data } = await axiosInstance.get<RunEventPage>(
    `/api/v1/runs/${encodeURIComponent(runId)}/events`,
    { params: query },
  );
  return data;
}

/* 실행 중지. 진행 중이 아니면 409 RUN_NOT_ACTIVE */
export async function cancelRun(runId: string): Promise<RunDetail> {
  const { data } = await axiosInstance.post<RunDetail>(
    `/api/v1/runs/${encodeURIComponent(runId)}/cancel`,
  );
  return data;
}
