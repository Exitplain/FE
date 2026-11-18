/*
  보정 API 타입 — BE calibrations (docs/실측_보정_요구사항.md CAL-05~14).
  보정은 실측 숫자가 아니라 배율(임계치·원인별 가중치)만 바꾸고, 적용 뒤 새 사전 테스트부터 반영됩니다.
*/

/* 조정안 한 행 (K01). current·proposed 는 배율 (1.00 = 기본 모형) */
export type ProposalItem = {
  key: string;
  segment_id: string;
  /* "*" 는 "전체" */
  segment_name: string;
  kind: "threshold" | "weight";
  cause: string | null;
  label: string;
  current: number;
  proposed: number;
  reason: string;
};

export type ProposalGap = {
  task_id: string;
  task_name: string;
  stage_id: string;
  stage_name: string;
  error: number;
  actual: number;
  low: number;
  high: number;
};

export type ProposalReason =
  | "NOT_CONNECTED"
  | "NOT_MAPPED"
  | "NO_PREDICTION"
  | "INSUFFICIENT_SAMPLE"
  | "NO_GAP"
  | "WAITING_NEXT_RUN";

/* GET /api/v1/projects/{id}/calibration/proposal?days=7 */
export type CalibrationProposal = {
  project_id: number;
  available: boolean;
  reason?: ProposalReason;
  message?: string;
  base_revision: number;
  days: number;
  basis: {
    report_id: string;
    run_sequence: number | null;
    days: number;
    device: string;
    mean_error: number | null;
    gaps: ProposalGap[];
  } | null;
  items: ProposalItem[];
  /* 보정 후 오차는 다음 사전 테스트가 끝난 뒤에만 실제로 보여 줍니다 (CAL-10) */
  after_error: null;
  after_note: string;
  unchanged_segments?: { segment_id: string; segment_name: string }[];
};

/* K03b 보정 이력 한 줄 — GET /api/v1/projects/{id}/calibrations (최신순) */
export type CalibrationRecord = {
  id: number;
  revision: number;
  applied_at: string;
  applied_by: string;
  params: Record<string, unknown>;
  changes: ProposalItem[];
  /* "빠른 구매형 인내심 임계치 1.00→0.80 · …" 또는 "r1 값으로 되돌림" */
  changes_summary: string;
  /* "3차 vs 실측 최근 7일". 되돌리기는 null */
  base_comparison: string | null;
  error_before_pp: number | null;
  /* 보정 후 첫 사전 테스트가 끝나기 전에는 null */
  error_after_pp: number | null;
  /* 되돌리기로 만든 기록이면 원래 번호 (0 = 기본 모형으로 되돌림) */
  restored_from: number | null;
};

/* 목록 응답 공통 형태 */
export type CalibrationList = { items: CalibrationRecord[]; next_cursor: string | null };
