/*
  실측 수집 (BE measurements, R01~R05).
  GET·POST /api/v1/projects/{id}/measurement — 설치 상태. POST 는 키 발급(이미 있으면 그대로)
  GET /api/v1/projects/{id}/measurement/steps?days=7 — 경로·단계별 고유 세션 수
*/
export type MeasurementStatus = {
  project_id: number;
  /* 실제 방문자가 오는 배포 주소가 있어야 true. 로컬·미리보기 주소만 있으면 false (reason NOT_DEPLOYED) */
  available: boolean;
  reason?: "NOT_DEPLOYED";
  message?: string;
  /* 이 출처에서 온 수집만 받습니다 */
  origins: string[];
  key: string | null;
  snippet: string | null;
  /* 최근 7일 안에 한 건이라도 받았으면 true */
  installed: boolean;
  last_received_at: string | null;
  last_origin: string | null;
  sessions_24h: number;
  events_24h: number;
  /* R05 매핑을 저장했으면 퍼널·비교 화면을 엽니다 */
  mapping_saved_at: string | null;
};

export type MeasurementStep = {
  /* 이름 붙인 단계(exitplain.step)면 그 이름, 아니면 경로 */
  step_id: string;
  path: string;
  step: string | null;
  sessions: number;
  events: number;
};

export type MeasurementSteps = {
  project_id: number;
  days: number;
  total_sessions: number;
  items: MeasurementStep[];
};

/* R05 단계 매핑. 실측 단계 ID 와 퍼널 단계 ID 는 모두 화면 경로(에이전트 실행 퍼널과 같은 규칙)입니다 */
export type MappingStage = {
  id: string;
  name: string;
  is_goal: boolean;
  /* 이 단계를 지나는 과업 이름 */
  tasks: string[];
};

export type MappingRowData = {
  step_id: string;
  sessions: number;
  events: number;
  /* 저장한 값, 없으면 자동 추천값 */
  stage_id: string | null;
  suggested_stage_id: string | null;
  /* exact: 경로가 같음 · similar: 이름 유사 · null: 후보 없음 */
  suggestion: "exact" | "similar" | null;
  saved: boolean;
};

export type MeasurementMapping = {
  project_id: number;
  days: number;
  /* 비교 기준이 되는 가장 최근 예측 리포트. 없으면 reason NO_PREDICTION */
  report_id: string | null;
  reason?: "NO_PREDICTION";
  message?: string;
  stages: MappingStage[];
  rows: MappingRowData[];
  mapped: number;
  saved_at: string | null;
};

/* R06·R08 실측 퍼널과 예측 비교 (GET /measurement/funnel?days&device). 비율은 모두 % (소수 첫째 자리) */
export type FunnelDevice = "all" | "mobile" | "desktop";
export type FunnelDays = "7" | "14" | "30";

export type FunnelStageCompare = {
  id: string;
  name: string;
  is_goal: boolean;
  /* 예측 도달률의 Wilson 95% 범위 (low~high), mid 는 중앙값 */
  predicted: {
    low: number | null;
    high: number | null;
    mid: number | null;
    reached: number;
    valid: number;
  };
  /* 매핑이 없는 단계는 null. rate = 이 단계 세션 ÷ 첫 단계 세션 */
  actual: { sessions: number; rate: number | null } | null;
  /* 실측 − 예측 중앙값 (%p) */
  error: number | null;
  /* 실측이 예측 범위 밖 */
  gap: boolean;
  /* 비교 대상 여부. 첫 단계(기준 100%)와 매핑 안 된 단계는 false */
  compared: boolean;
  short_sample: boolean;
};

export type FunnelDrop = { from: string; to: string; label: string };

export type FunnelTaskCompare = {
  task_id: string;
  name: string;
  base_sessions: number;
  /* 첫 단계 세션이 min_sample 보다 적음 */
  collecting: boolean;
  stages: FunnelStageCompare[];
  mapped_stages: number;
  /* 평균 오차에 들어간 단계 수 */
  compared_stages: number;
  mean_error: number | null;
  gaps: string[];
  max_drop: { predicted: FunnelDrop | null; actual: FunnelDrop | null; matched: boolean };
};

export type MeasurementFunnel = {
  project_id: number;
  days: number;
  device: FunnelDevice;
  since: string;
  until: string;
  min_sample: number;
  report: { report_id: string; created_at: string; run_sequence: number | null } | null;
  mapping_saved: boolean;
  reason?: "NO_PREDICTION";
  message?: string;
  tasks: FunnelTaskCompare[];
};
