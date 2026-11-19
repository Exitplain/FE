/*
  제품 API 실행(Run) 타입. 기준: BE backend/runs (services.run_item, report_link)
  필드 이름은 BE 응답 그대로 snake_case 입니다.
*/

export type RunStatus =
  | "queued"
  | "running"
  | "finalizing"
  | "completed"
  | "partially_completed"
  | "failed"
  | "cancelled";

export type RunKind = "pretest" | "cause_repro" | "retest";

/* 진행 중으로 보는 상태. 목록·상태 조회를 이 동안만 주기적으로 다시 받습니다 */
export const ACTIVE_RUN_STATUSES: readonly RunStatus[] = ["queued", "running", "finalizing"];

/* achievement_rate 는 0~1 비율(소수 4자리). 유효 세션이 없으면 null 입니다 */
export type RunGoalRate = {
  task_id: string;
  name: string;
  achievement_rate: number | null;
};

export type RunTopCause = { key: string; name: string; dropouts: number };

/* 실행 목록 항목의 최신 리포트 요약 (runs/report_link.py) */
export type RunReportBrief = {
  id: string;
  status: "final" | "partial";
  revision: number;
  goal_rates: RunGoalRate[];
  created_at?: string;
  achievement_rate?: number | null;
  success?: number;
  dropout?: number;
  technical?: number;
  incomplete?: number;
  top_causes?: RunTopCause[];
};

/* GET /api/v1/projects/{id}/runs 의 항목 */
export type RunItem = {
  id: string;
  sequence_no: number;
  /* BE 가 만든 이름 "4차·첫 주문 완료 외 1개". 비어 있으면 "{n}차" */
  name: string;
  kind: RunKind;
  status: RunStatus;
  change_note: string;
  parent_run_id: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  /* 리포트가 아직 없으면 null */
  report: RunReportBrief | null;
};

/* GET /api/v1/projects/{id}/runs 쿼리 (q·status·kind·period 는 아직 화면에서 쓰지 않음) */
export type RunListQuery = {
  q?: string;
  status?: RunStatus[];
  kind?: RunKind[];
  period?: "7d" | "30d" | "90d" | "all";
  limit?: number;
  cursor?: string;
};

/* GET /api/v1/runs/{id} — 실행 상태 (샘플은 로그인 없이, 그 밖에는 소유자만) */
export type RunDetail = RunItem & {
  project_id: number;
  phase: "preparing" | "running" | "analyzing" | "done" | "failed" | "cancelled";
  cancel_requested: boolean;
  error: { code: string; message: string } | null;
  progress: {
    expected_sessions: number;
    started_sessions: number;
    finished_sessions: number;
    sessions_by_status: Record<string, number>;
    task_runs: {
      total: number;
      queued: number;
      running: number;
      succeeded: number;
      failed: number;
      cancelled: number;
    };
  };
  /*
    과업 진행 순서 (계획 순서 = 실행 순서, 왼쪽 → 오른쪽). 서버가 이 순서대로 과업마다 시드 1부터 돌립니다.
    status 는 과업의 모든 시드를 합친 상태. 예전 서버 응답에는 없을 수 있습니다
  */
  tasks?: RunTaskProgress[];
};

export type RunTaskProgress = {
  task_id: string;
  name: string;
  /* 1부터 */
  position: number;
  status: "queued" | "running" | "done" | "failed" | "cancelled";
  seeds: number;
};

/* GET /api/v1/runs/{id}/sessions 의 세션 — 시작한 세션만 들어 있습니다 (대기 세션 없음) */
export type RunSessionStatus =
  | "running"
  | "success"
  | "simulated_dropout"
  | "agent_failure"
  | "site_failure"
  | "blocked_auth"
  | "budget_exceeded"
  | "cancelled";

export type RunSession = {
  id: number;
  session_key: string;
  persona: { code: string; segment_id: string; segment_name: string };
  task_id: string;
  seed: number;
  status: RunSessionStatus;
  reason: string | null;
  /* 왜 끝났는지 한 줄 (BE agent/explain.py). 진행 중인 방문은 null, 예전 서버는 없음 */
  explanation?: string | null;
  steps: number;
  duration_seconds: number | null;
  max_frustration: number | null;
  /* 퍼널 단계 키 (landing · browse · detail · cart · signup · payment · complete) */
  terminal_stage: string | null;
  stages_reached: string[];
  latest_observation: {
    id: number;
    step: number;
    url: string;
    screenshot_url: string | null;
  } | null;
  final_screenshot_url: string | null;
  started_at: string | null;
  finished_at: string | null;
};

/* GET /api/v1/runs/{id}/events — after 커서로 이어 받습니다 */
export type RunEvent = {
  id: number;
  type:
    | "session.started"
    | "observation.created"
    | "friction.detected"
    | "action.completed"
    | "session.finished"
    | string;
  sequence: number;
  session_id: number | null;
  session_key: string | null;
  occurred_at: string;
  payload: Record<string, unknown>;
};

export type RunEventPage = { items: RunEvent[]; next_after: number; has_more: boolean };
