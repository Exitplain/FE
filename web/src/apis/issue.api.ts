import type { WorkspaceIssue } from "@/types/workspace.type";

import axiosInstance from "./axiosInstance";

/*
  발견한 문제 (W03 전체 · C09 프로젝트). 기준: BE backend/reports/issues.py
  문제 1개 = 과업 × 이탈한 화면 × 주 원인. 리포트가 없는 프로젝트는 items 가 빈 배열입니다.
  로그인 + 프로젝트 소유자만 됩니다 (W03 은 내 프로젝트만, 샘플 프로젝트 C09 는 403).
*/
export type V1Issue = {
  /* "{task_id}:{stage_key}:{cause_key}" — 프로젝트 안에서만 고유합니다 */
  id: string;
  cause_key: string;
  cause: string;
  stage_key: string;
  stage: string;
  project_id: number;
  project_name: string;
  task_id: string;
  task: string;
  /* 시드별 이탈 세션 수 [최소, 최대] */
  impact: [number, number];
  dropouts: number;
  valid_sessions: number;
  verdict: WorkspaceIssue["verdict"];
  first_seen_at: string;
  /* "11월 3일" */
  first_seen: string;
  last_seen_at: string;
  run_id: string;
  report_id: string;
  evidence: string;
};

export type V1IssueList = { count: number; items: V1Issue[]; note: string };

export async function getIssues(): Promise<V1IssueList> {
  const { data } = await axiosInstance.get<V1IssueList>("/api/v1/issues");
  return data;
}

export async function getProjectIssues(projectId: number): Promise<V1IssueList> {
  const { data } = await axiosInstance.get<V1IssueList>(`/api/v1/projects/${projectId}/issues`);
  return data;
}

/*
  화면 값. 화면의 프로젝트 id 는 문자열이고, 문제 id 는 W03 에서 프로젝트끼리 겹치지 않게 프로젝트 id 를 붙입니다.
*/
export function toWorkspaceIssue(issue: V1Issue): WorkspaceIssue {
  const projectId = String(issue.project_id);
  return {
    id: `${projectId}:${issue.id}`,
    cause: issue.cause,
    stage: issue.stage,
    projectId,
    projectName: issue.project_name,
    task: issue.task,
    impact: issue.impact,
    firstSeen: issue.first_seen,
    verdict: issue.verdict,
    runId: issue.run_id,
    evidence: issue.evidence,
  };
}
