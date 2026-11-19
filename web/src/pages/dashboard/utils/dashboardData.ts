import { buildPath } from "@/constants/routes";
import type { RunsProject } from "@/hooks/useProjectRuns";
import { ACTIVE_RUN_STATUSES, type RunDetail, type RunItem } from "@/types/run.type";
import type { ProjectRecord } from "@/types/project.type";
import type { WorkspaceProject, WorkspaceSnapshot } from "@/types/workspace.type";

/*
  W01 대시보드 값. 프로젝트별 실행 목록(리포트 요약 포함)과 진행 중 실행 상태로 만듭니다.
  루프 위치의 실측·보정 단계(4~7)는 프로젝트 목록 응답의 measurement·calibration 으로 나눕니다.
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

type LoopRow = {
  stage: number;
  stageLabel: string;
  detail: string;
  action: string;
  actionHref: string;
};

function loopRow(project: ProjectRecord, row: LoopRow): ProjectLoop {
  return {
    ...project,
    stage: row.stage,
    stageLabel: row.stageLabel,
    stageDetail: `${row.stage} / 7 · ${row.detail}`,
    action: row.action,
    actionHref: row.actionHref,
  };
}

/*
  끝낸 사전 테스트가 있을 때 실측 분석 4~6 · 보정 7 (프로젝트 목록의 measurement·calibration 으로).
  4 실측 연결 전(키 없음) → 5 수집 대기(키 발급, 수집 전) → 6 실측 연결됨 → 7 보정 적용.
  BE 가 아직 두 값을 주지 않으면 4단계 · 실측 연결 전으로 둡니다.
  보정이 적용돼 있으면 실측 상태와 관계없이 7단계입니다 (수집 키를 지워도 적용한 보정은 남아 있음).
*/
function analyticsLoop(project: ProjectRecord): ProjectLoop {
  const analytics = buildPath("analytics", { projectId: project.id });
  const calibration = buildPath("calibration", { projectId: project.id });
  if (project.calibrationRevision != null)
    return loopRow(project, {
      stage: 7,
      stageLabel: "예측 맞추기",
      detail: "예측 맞추기 적용됨",
      action: "예측 맞추기 보기",
      actionHref: calibration,
    });
  if (project.measurementStatus === "connected")
    return loopRow(project, {
      stage: 6,
      stageLabel: "실제 고객 데이터 분석",
      detail: "실제 고객 데이터 연결됨",
      action: "예측 맞추기 조정안 보기",
      actionHref: calibration,
    });
  if (project.measurementStatus === "waiting")
    return loopRow(project, {
      stage: 5,
      stageLabel: "실제 고객 데이터 분석",
      detail: "수집 대기",
      action: "설치 확인하기",
      actionHref: analytics,
    });
  return loopRow(project, {
    stage: 4,
    stageLabel: "실제 고객 데이터 분석",
    detail: "실제 고객 데이터 연결 전",
    action: "실제 고객 데이터 연결하기",
    actionHref: analytics,
  });
}

/*
  프로젝트별 루프 위치 (Figma W01 "사전 테스트 1~3 → 실측 분석 4~6 → 보정 7").
  프로젝트 목록 값은 실행이 끝나도 갱신되지 않아, 대시보드가 받고 있는 실행 목록(실행 중 polling)으로 계산합니다.
  C05 진단 루프와 같은 규칙: 끝난 사전 테스트가 있으면 실측 분석 단계, 진행 중이면 사전 테스트 단계.
  끝난 사전 테스트가 있으면 프로젝트 목록의 실측·보정 상태로 4~7 단계를 나눕니다.
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
  ) => loopRow(project, { stage, stageLabel, detail, action, actionHref });

  /*
    이 프로젝트의 실행 목록을 받지 못했으면(일부 실패) 프로젝트 목록의 마지막 사전 테스트로 대신합니다.
    실행 id 를 몰라 진행 중이면 테스트 목록으로 보냅니다
  */
  if (!latest && project.lastTestStatus) {
    const status = project.lastTestStatus;
    if (status === "completed") return analyticsLoop(project);
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
    return analyticsLoop(project);
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
