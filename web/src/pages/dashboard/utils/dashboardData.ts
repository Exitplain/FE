import { buildPath } from "@/constants/routes";
import type { RunsProject } from "@/hooks/useProjectRuns";
import { ACTIVE_RUN_STATUSES, type RunDetail, type RunItem } from "@/types/run.type";
import type { ProjectRecord } from "@/types/project.type";
import type { WorkspaceProject, WorkspaceSnapshot } from "@/types/workspace.type";

/*
  W01 대시보드 값. 프로젝트별 실행 목록(리포트 요약 포함)과 진행 중 실행 상태로 만듭니다.
  보정·실측은 BE 에 없어 값을 만들지 않고, 루프 위치는 실측 분석(4/7) 단계까지만 계산합니다.
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

/* 루프 위치 한 줄 — 프로젝트 화면 값에 다음 행동 주소를 더한 것 */
export type ProjectLoop = WorkspaceProject & { actionHref: string };

/*
  프로젝트별 루프 위치 (Figma W01 "사전 테스트 1~3 → 실측 분석 4~6 → 보정 7").
  프로젝트 목록 값은 실행이 끝나도 갱신되지 않아, 대시보드가 받고 있는 실행 목록(실행 중 polling)으로 계산합니다.
  C05 진단 루프와 같은 규칙: 끝난 사전 테스트가 있으면 실측 분석 단계, 진행 중이면 사전 테스트 단계.
  실측·보정은 BE 에 아직 없어 실측 분석(4/7) 다음으로는 넘어가지 않습니다.
*/
export function projectLoop(project: ProjectRecord, items: ProjectItem[]): ProjectLoop {
  /* C05 처럼 차수 최신순 */
  const pretests = items
    .filter((entry) => entry.project.id === project.id && entry.item.kind !== "cause_repro")
    .map((entry) => entry.item)
    .sort((a, b) => b.sequence_no - a.sequence_no);
  const latest = pretests[0];
  const loop = (
    stage: number,
    stageLabel: string,
    detail: string,
    action: string,
    actionHref: string,
  ): ProjectLoop => ({
    ...project,
    stage,
    stageLabel,
    stageDetail: `${stage} / 7 · ${detail}`,
    action,
    actionHref,
  });

  /*
    이 프로젝트의 실행 목록을 받지 못했으면(일부 실패) 프로젝트 목록의 마지막 사전 테스트로 대신합니다.
    실행 id 를 몰라 진행 중이면 테스트 목록으로 보냅니다
  */
  if (!latest && project.lastTestStatus) {
    const status = project.lastTestStatus;
    if (status === "completed")
      return loop(
        4,
        "실제 고객 데이터 분석",
        "실제 고객 데이터 연결 전",
        "실제 고객 데이터 연결하기",
        buildPath("analytics", { projectId: project.id }),
      );
    if (status === "failed")
      return loop(
        1,
        "사전 테스트",
        "테스트 실패",
        "다시 테스트",
        buildPath("newTest", { projectId: project.id }),
      );
    return loop(
      1,
      "사전 테스트",
      "테스트 실행 중",
      "테스트 목록 보기",
      buildPath("testList", { projectId: project.id }),
    );
  }
  if (latest && ACTIVE_RUN_STATUSES.includes(latest.status)) {
    return loop(
      1,
      "사전 테스트",
      "테스트 실행 중",
      "실시간 보기",
      buildPath("testRun", { projectId: project.id, runId: latest.id }),
    );
  }
  if (pretests.some((item) => ["completed", "partially_completed"].includes(item.status))) {
    return loop(
      4,
      "실제 고객 데이터 분석",
      "실제 고객 데이터 연결 전",
      "실제 고객 데이터 연결하기",
      buildPath("analytics", { projectId: project.id }),
    );
  }
  if (latest) {
    return loop(
      1,
      "사전 테스트",
      /* 직접 멈춘 실행은 실패와 구분합니다 */
      latest.status === "cancelled" ? "테스트 중지" : "테스트 실패",
      "다시 테스트",
      buildPath("newTest", { projectId: project.id }),
    );
  }
  return loop(
    0,
    "사전 테스트",
    "테스트 전",
    "첫 테스트 시작",
    buildPath("newTest", { projectId: project.id }),
  );
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
