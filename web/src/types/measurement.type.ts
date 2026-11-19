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
  /* CSV 로 올린 로그 (스크립트를 넣을 수 없는 사이트). 예전 서버 응답에는 없을 수 있습니다 */
  imports?: { count: number; sessions: number; last_at: string | null };
};

/*
  실측 CSV 올리기 (BE measurements/csv_import.py)
  POST   /api/v1/projects/{id}/measurement/imports  (multipart file) → 201 MeasurementImportResult
  GET    /api/v1/projects/{id}/measurement/imports  → { items }
  DELETE /api/v1/projects/{id}/measurement/imports/{import_id} → 204 (그 파일로 넣은 줄도 함께)
  GET    /api/v1/projects/{id}/measurement/csv-template → 예시 CSV
*/
export type MeasurementImport = {
  id: number;
  filename: string;
  rows_total: number;
  rows_imported: number;
  sessions: number;
  /* 넣은 줄 중 가장 이른·늦은 시각 */
  first_at: string | null;
  last_at: string | null;
  created_at: string;
};

export type MeasurementImportResult = MeasurementImport & {
  /* 형식이 틀린 줄 · 최근 30일 밖이거나 미래 시각인 줄 · 같은 줄 반복 */
  skipped: { invalid: number; outside_window: number; duplicate: number };
  /* 형식이 틀린 줄 앞 20개 (line 은 머리글을 1로 센 줄 번호) */
  errors: { line: number; message: string }[];
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
  report: {
    report_id: string;
    created_at: string;
    run_sequence: number | null;
    /* 원인 재현(R09)이 쓰는 값. 실행 없이 만든 리포트면 run_id 가 null 이라 재현할 수 없습니다 */
    run_id: string | null;
    plan_revision_id: string;
    segments: { id: string; name: string; count: number }[];
  } | null;
  mapping_saved: boolean;
  reason?: "NO_PREDICTION";
  message?: string;
  tasks: FunnelTaskCompare[];
};
