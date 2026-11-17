import type { RunsProject } from "@/hooks/useProjectRuns";
import { ACTIVE_RUN_STATUSES, type RunDetail, type RunItem } from "@/types/run.type";
import type { WorkspaceSnapshot } from "@/types/workspace.type";

/*
  W01 대시보드 값. 프로젝트별 실행 목록(리포트 요약 포함)과 진행 중 실행 상태로 만듭니다.
  보정·실측은 BE 에 없어 다루지 않습니다.
*/

type ProjectItem = { project: RunsProject; item: RunItem };

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const newestFirst = (a: ProjectItem, b: ProjectItem) =>
  Date.parse(b.item.created_at) - Date.parse(a.item.created_at);

/* 이번 주(최근 7일) 끝난 실행 중 완료·실패 수 (중지한 실행은 세지 않음) */
export function weekCounts(items: ProjectItem[], now = Date.now()) {
  const recent = items
    .map(({ item }) => item)
    .filter((item) => item.finished_at && now - Date.parse(item.finished_at) <= WEEK_MS);
  return {
    completed: recent.filter((item) => ["completed", "partially_completed"].includes(item.status))
      .length,
    failed: recent.filter((item) => item.status === "failed").length,
  };
}

/* 지금 실행 중인 것 하나 (가장 최근에 시작한 것) */
export function activeItemOf(items: ProjectItem[]) {
  return [...items].sort(newestFirst).find(({ item }) => ACTIVE_RUN_STATUSES.includes(item.status));
}

const TECHNICAL = ["agent_failure", "site_failure", "blocked_auth", "budget_exceeded", "cancelled"];

/* 지금 실행 중 카드 — 실행 상태(GET /api/v1/runs/{id})의 세션 상태별 수 */
export function runningCard(
  project: RunsProject,
  detail: RunDetail,
): WorkspaceSnapshot["activeRun"] {
  const count = (status: string) => detail.progress.sessions_by_status[status] ?? 0;
  return {
    id: detail.id,
    projectId: project.id,
    name: `${project.name} ${detail.sequence_no}차`,
    seed: "",
    total: detail.progress.expected_sessions,
    running: count("running"),
    /* 아직 시작하지 않은 세션은 sessions_by_status 에 없어 예상 수에서 뺍니다 */
    queued: Math.max(0, detail.progress.expected_sessions - detail.progress.started_sessions),
    completed: count("success"),
    exited: count("simulated_dropout"),
    errors: TECHNICAL.reduce((sum, status) => sum + count(status), 0),
  };
}

/* 실행 상태를 받기 전(또는 받지 못했을 때) 목록 값으로 먼저 그리는 카드. 세션 수는 비워 둡니다 */
export function waitingCard(project: RunsProject, item: RunItem): WorkspaceSnapshot["activeRun"] {
  return {
    id: item.id,
    projectId: project.id,
    name: `${project.name} ${item.sequence_no}차`,
    seed: "",
    total: 0,
    running: 0,
    queued: 0,
    completed: 0,
    exited: 0,
    errors: 0,
  };
}
