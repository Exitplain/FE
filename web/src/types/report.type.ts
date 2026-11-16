/*
  제품 API 리포트 (report-2). 기준: BE backend/reports (services.report_dict · aggregate.build_report_data)
  - 비율은 0~1 소수(4자리)이고, 분모가 0이면 null 입니다
  - 인원 합계(reached·success 등)는 모든 시드를 더한 값, *_range 는 시드별 결과의 최솟값~최댓값입니다
  - 기술 실패·결과 없음은 퍼널·달성률·원인 분모에서 뺍니다
*/

export type MinMax = { min: number | null; max: number | null };

/* agent/funnel.py FUNNEL — 과업마다 같은 7단계 */
export type FunnelKey =
  "landing" | "browse" | "detail" | "cart" | "signup" | "payment" | "complete";

export type ReportFunnelStageV1 = {
  stage_id: string;
  key: FunnelKey;
  name: string;
  order: number;
  /* 이 단계에 처음 도달한 세션 수 (모든 시드 합) */
  reached: number;
  reached_range: MinMax;
  rate_of_valid: number | null;
  /* 앞에서 지나간 단계 대비 (지나가지 않은 단계는 건너뜀) */
  rate_of_previous: number | null;
  /* 이 단계를 마지막으로 보고 떠난 세션 수 */
  dropouts_here: number;
};

/* agent/behavior.py CAUSES 7종 + unknown */
export type ReportCauseV1 = {
  key: string;
  name: string;
  /* 주 원인이 이것인 가상 이탈 수 */
  dropouts: number;
  share: number | null;
  sessions_with_cause: number;
};

export type ReportSegmentV1 = {
  segment_id: string;
  name: string;
  success: number;
  dropout: number;
  technical: number;
  achievement_rate: number | null;
};

export type ReportCounts = {
  expected_sessions: number;
  recorded_sessions: number;
  success: number;
  dropout: number;
  technical: number;
  incomplete: number;
  valid_sessions: number;
  achievement_rate: number | null;
};

export type ReportTaskV1 = ReportCounts & {
  task_id: string;
  name: string;
  seed_ranges: { success: MinMax; dropout: MinMax; achievement_rate: MinMax };
  kpis: { median_duration_seconds: number | null; median_steps: number | null };
  funnel: ReportFunnelStageV1[];
  causes: ReportCauseV1[];
  top_causes: ReportCauseV1[];
  /* 세그먼트 × 이탈 단계 (stages 순서와 dropouts 가 맞물림) */
  heatmap: {
    stages: FunnelKey[];
    rows: { segment_id: string; name: string; dropouts: number[] }[];
  };
  segments: ReportSegmentV1[];
  data_quality: { unknown_stages: number };
};

export type ReportSessionKind = "success" | "dropout" | "technical" | "incomplete";

export type ReportSessionRow = {
  task_id: string;
  seed: number;
  persona_id: string;
  segment_id: string;
  segment_name: string;
  status: string;
  kind: ReportSessionKind;
  terminal_stage: string | null;
  primary_cause: string | null;
  steps: number;
  duration_seconds: number | null;
};

export type ReportTechnicalFailure = {
  task_id: string;
  seed: number;
  persona_id: string;
  status: string;
  reason: string | null;
};

export type ReportData = {
  schema_version: "report-2";
  status: "final" | "partial";
  summary: ReportCounts;
  tasks: ReportTaskV1[];
  technical_failures: ReportTechnicalFailure[];
  sessions: ReportSessionRow[];
  ignored_records: number;
  persona_generator: unknown;
  /* 결과 해석의 한계 (고정 문구 3개) */
  notes: string[];
};

/* GET /api/v1/reports/{id} */
export type ReportSnapshot = {
  report_id: string;
  run_ref: string;
  revision: number;
  status: "final" | "partial";
  source: string;
  kind: "prediction";
  plan_revision_id: string;
  created_at: string;
  data: ReportData;
};

/* GET /api/v1/runs/{run_ref}/reports — 최신 revision + 이전 revision 목록 */
export type RunReport = ReportSnapshot & {
  revisions: { report_id: string; revision: number; status: string; created_at: string }[];
};

/* GET /api/v1/shared/{token} — 로그인 없이 보는 공유 리포트 */
export type SharedReport = ReportSnapshot & {
  shared: true;
  expires_at: string;
  project: { name: string };
  run: { name: string };
};

/* POST·GET /api/v1/reports/{id}/share-links */
export type ShareLink = {
  id: string;
  report_id: string;
  token: string;
  /* 서버 API 경로(/api/v1/shared/{token}). 화면 주소는 /share/{token} 로 만듭니다 */
  path: string;
  state: "active" | "expired" | "revoked";
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
};
