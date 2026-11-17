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

/*
  실행 퍼널 (BE reports/journey.py). 단계를 미리 정하지 않고 페르소나들이 실제로 지나간 화면으로 과업마다 만든다.
  - id·path: 정규화한 화면 경로 ('/products/12' → '/products/:id')
  - name: 화면 역할 이름 ('상품 상세'). name_source = model(모델이 붙임) | title(화면 제목) | path(경로 그대로)
  - 아무도 지나가지 않은 단계는 없다 (0명 단계 없음). 드물게 들른 화면은 other 로 묶인다
*/
export type JourneyStage = {
  id: string;
  path: string;
  name: string;
  name_source?: "model" | "title" | "path";
  title?: string;
  order: number;
  reached: number;
  reached_range: MinMax;
  rate_of_valid: number | null;
  rate_of_previous: number | null;
  dropouts_here: number;
  is_goal: boolean;
};

export type JourneyFunnel = {
  basis: "observed_screens";
  valid_sessions: number;
  stages: JourneyStage[];
  other: { screens: number; dropouts: number };
  /* stages 는 단계 id(경로) 목록, 마지막이 'other' 일 수 있다 */
  heatmap: { stages: string[]; rows: { segment_id: string; name: string; dropouts: number[] }[] };
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
  /* 실행 퍼널. 있으면 화면은 7단계 funnel 대신 이것을 쓴다 (예전 리포트에는 없다) */
  journey_funnel?: JourneyFunnel;
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
