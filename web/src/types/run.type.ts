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
