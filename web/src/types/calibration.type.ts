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

/* K03 보정 전·후 단계별 오차 — GET /api/v1/projects/{id}/calibration/compare?revision=n (CAL-15) */
export type CompareStage = {
  task_id: string;
  task_name: string;
  stage_id: string;
  stage_name: string;
  error: number | null;
  gap: boolean;
  before?: number | null;
  after: number | null;
  /* 차이 구간 해소 · 차이 구간 생김 · 개선 · 나빠짐 · 비슷 */
  change: string | null;
};

export type CalibrationCompare = {
  revision: number;
  /* waiting: 이 보정으로 돈 사전 테스트가 아직 없음 */
  status: "waiting" | "ready" | "unavailable";
  message?: string;
  before: { report_id: string; mean_error: number | null; gaps: number } | null;
  after: {
    report_id: string;
    run_sequence: number;
    mean_error: number | null;
    gaps: number;
  } | null;
  stages: CompareStage[];
};

/* K04 사람 관측 — GET·POST /api/v1/projects/{id}/human-observations (CAL-16~18) */
export type ObservationMatch = {
  outcome: boolean | null;
  stage: boolean | null;
  cause: boolean | null;
};

export type HumanObservation = {
  id: number;
  participant_code: string;
  task_id: string;
  task_name: string;
  outcome: "success" | "dropout";
  stage_id: string | null;
  stage_name: string | null;
  cause: string | null;
  cause_name: string | null;
  /* calibration: 보정용 · evaluation: 평가용 (조정안 계산에 쓰지 않음) */
  purpose: "calibration" | "evaluation";
  source: "manual" | "recorder";
  updated_at: string;
  match: ObservationMatch;
};

export type ObservationTask = {
  task_id: string;
  name: string;
  stages: { id: string; name: string }[];
  predicted: {
    outcome: "success" | "dropout";
    stage_id: string | null;
    stage_name: string | null;
    cause: string | null;
    cause_name: string | null;
  };
};

export type MatchCount = { matched: number; total: number };

export type HumanObservationList = {
  project_id: number;
  /* 비교 기준 리포트. 없으면 사전 테스트를 먼저 돌려야 함 */
  report_id: string | null;
  tasks: ObservationTask[];
  causes: { key: string; name: string }[];
  items: HumanObservation[];
  summary: { outcome: MatchCount; stage: MatchCount; cause: MatchCount };
  /* evaluation: 평가용 관측만으로 셈 · all: 평가용이 없어 전체로 셈 */
  summary_basis: "evaluation" | "all";
  replaced?: boolean;
};

export type ObservationInput = {
  participant_code: string;
  task_id: string;
  outcome: "success" | "dropout";
  stage_id?: string;
  cause?: string;
  purpose: "calibration" | "evaluation";
};

/* 참여자 응답 링크 (PART-01~05). 담당자가 만들고, 참여자는 로그인 없이 /r/{token} 에서 누르기만 해서 답합니다 */
export type ParticipantLink = {
  id: number;
  token: string;
  /* "/r/{token}" — 앱 주소 앞에 붙여 공유합니다 */
  path: string;
  task_id: string;
  task_name: string;
  purpose: "calibration" | "evaluation";
  state: "open" | "disabled" | "expired" | "full";
  responses: number;
  max_responses: number;
  expires_at: string;
  created_at: string;
};

/* GET /api/v1/participant-links/{token} — 공개. 예측 수치는 담지 않습니다 */
export type PublicParticipantPage = {
  project_name: string;
  site_url: string;
  task_name: string;
  screens: { id: string; name: string; screenshot_url: string | null }[];
  reasons: { key: string; label: string }[];
  expires_at: string;
};

export type ParticipantAnswer = {
  client_id: string;
  outcome: "success" | "dropout";
  pain_stage_id?: string;
  pain_cause?: string;
  discomfort?: number;
};
