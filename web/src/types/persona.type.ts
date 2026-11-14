/*
  페르소나 실행 API 타입 — BE docs/API_SPEC.md 4~6절과 BE 코드(agent/persona_dashboard.py,
  agent/preflight.py, agent/session_explain.py)의 실제 응답 기준.
  필드 이름은 명세와 같게(snake_case) 유지합니다. 명세가 바뀌면 이 파일을 먼저 고칩니다.
*/

export type Variant = "fixed" | "problem";

export type AgeOption = "any" | "teens" | "20s" | "30s" | "40s" | "50s" | "60plus";

/* ─── 사전 탐색 (POST /api/personas/discover) ─────────────────────────────── */

/* 정확히 이 키 하나만 보냅니다. 다른 키가 있으면 400 */
export type DiscoverRequest = { variant: Variant };

export type DiscoverFeature = {
  id: string;
  name: string;
  /* 기능을 찾은 화면 근거 (예: { label: "이번 주 식탁 만나기", path: "/product" }) */
  evidence: { label: string; path: string };
  /* 링크가 보였다는 뜻일 뿐 기능이 정상 동작한다는 판정은 아님 */
  verification: "visible_entry_only";
};

export type DiscoverTask = {
  id: string;
  name: string;
  goal: string;
  case: string;
  success_path: string;
  /* 이 과업이 속한 기능. 근거 경로는 features 에서 찾습니다 */
  feature_id: string;
  /* 기본으로 선택해 두는 과업 */
  suggested: boolean;
  /* 임시: 이 과업 퍼널의 단계 수 (P05c "과업별 7단계"). 명세에 없음 */
  funnel_stages?: number;
};

export type DiscoverResponse = {
  project: string;
  /* 15분 뒤 만료. confirm 에 그대로 보냅니다 */
  plan_id: string;
  variant: Variant;
  features: DiscoverFeature[];
  tasks: DiscoverTask[];
  age_options: Partial<Record<AgeOption, string>>;
  note: string;
  /* 임시: 사이트 응답 시간(ms)·읽은 화면 수 (P03 "응답 0.8초 · 화면 12개 읽음"). 명세에 없음 */
  response_ms?: number;
  screens_read?: number;
};

/* ─── 확인 후 실행 (POST /api/personas/confirm) ───────────────────────────── */

/*
  여섯 필드를 정확히 보냅니다. 누락·추가 필드는 400.
  - feature_ids·task_ids·ages: 비어 있지 않고 중복 없이, 탐색 결과 안의 값
  - task_ids 는 고른 기능(feature_ids)에 속한 과업만
  - ages: "any" 는 단독으로만
  - context·additional_request: 500자 이하 (빈 문자열 가능)
  응답은 202 + 실행 상태(PersonaRun). 호출 즉시 실행이 시작됩니다.
*/
export type ConfirmRequest = {
  plan_id: string;
  feature_ids: string[];
  task_ids: string[];
  ages: AgeOption[];
  context: string;
  additional_request: string;
};

/* ─── 실행 상태 (GET /api/personas) ──────────────────────────────────────── */

export type RunStatus = "idle" | "running" | "completed";

export type SessionStatus =
  "queued" | "running" | "success" | "simulated_dropout" | "agent_failure" | "budget_exceeded";

/* 사이트 화면 단계 (BE agent/frustration.py STAGES) */
export type Stage =
  | "landing"
  | "product"
  | "cart"
  | "signup"
  | "checkout"
  | "complete"
  | "delivery"
  | "benefits"
  | "coupon"
  | "account"
  | "subscription"
  | "other";

export type PersonaProfile = {
  id: string;
  name: string;
  context: string;
  /* 허용 입력 칸 수 — 인내심에 해당. 좌절 임계치 = 이 값 × 16 */
  max_required_fields: number;
  /* 브라우저 너비 (390 = 모바일) */
  width: number;
  search_sensitivity: number;
  cost_sensitivity: number;
};

export type PersonaTask = {
  id: string;
  name: string;
  goal: string;
  case: string;
  success_path: string;
};

/* 행동 기록. description 은 규칙이 만든 짧은 설명이며 think-aloud 발화가 아닙니다 */
export type SessionEvent = { step: number; action: string; description: string };

/* 스텝별 좌절 점수 추이 */
export type TracePoint = {
  step: number;
  stage: Stage;
  score: number;
  previous_score: number;
  threshold: number;
  required_fields: number;
  crossed: boolean;
  url: string;
  artifact_id: string | null;
  model_version?: string;
  /* 이번 스텝에서 관측한 신호 (새 입력 칸, 되돌아감, 예상 밖 비용 등) */
  signals?: Record<string, number | boolean>;
  /* 점수 계산 항목별 값 */
  terms?: Record<string, number>;
};

export type SessionIssue = {
  category: "input_burden" | "navigation" | "cost";
  observed_fields: number;
  configured_limit: number;
  model_version: string;
};

export type PersonaSession = PersonaProfile & {
  /* 예: "quick_order" (프로필_과업) */
  id: string;
  profile_id: string;
  task_id: string;
  task_name: string;
  goal: string;
  status: SessionStatus;
  /* 지금 하는 일 또는 끝난 이유 (사람이 읽는 문장) */
  reason: string;
  steps: number;
  url?: string;
  events: SessionEvent[];
  trace: TracePoint[];
  terminal_stage: Stage | null;
  issue: SessionIssue | null;
  /* 마지막 화면 스크린샷. GET /api/artifacts/{id} */
  artifact_id: string | null;
  /* 실행 중에만 값이 있음 (개발 환경의 원격 브라우저 주소) */
  viewer_url: string | null;
  /* 질문한 뒤에만 생깁니다 (최근 20개) */
  answers?: ExplainAnswer[];
  /* 브라우저 정리에 실패했을 때만 */
  cleanup_warning?: string;
};

/*
  confirm 으로 시작한 실행만 값이 채워집니다.
  호환용 /api/personas/start 로 시작했거나 오래된 실행을 복원하면 빈 객체({})일 수 있어 모두 선택입니다.
*/
export type Audience = {
  ages?: AgeOption[];
  age_labels?: string[];
  context?: string;
  additional_request?: string;
  confirmed_features?: string[];
  plan_id?: string;
  confirmed_at?: string;
  /* 연령은 설명 문맥으로만 쓰고 행동 보정은 검증 전 */
  age_behavior_calibration?: "unverified";
};

/* 좌절 모형 설정 (BE agent/frustration.py PARAMETERS). 화면 설명용 */
export type FrustrationModel = {
  version: string;
  decay: number;
  input_weight: number;
  revisit_weight: number;
  progress_reward: number;
  search_weight: number;
  cost_weight: number;
  calibration: string;
  decision?: string;
  formula?: string;
};

export type PersonaRun = {
  status: RunStatus;
  /* 실행이 한 번도 없으면 null */
  id: string | null;
  policy: string;
  model_calls: number;
  target: string;
  profiles: PersonaProfile[];
  tasks: PersonaTask[];
  sessions: PersonaSession[];
  /* 아래는 실행을 시작한 뒤에만 있습니다 (idle 초기 상태에는 키가 없음) */
  variant?: Variant;
  /* 실행 시작 시각 (UTC ISO). 종료 시각은 없습니다 */
  created_at?: string;
  task_selection?: string;
  audience?: Audience;
  frustration_model?: FrustrationModel;
  /* 사람 관측(K04) 기록 */
  human_observations?: HumanObservation[];
  /* 사람 관측과 예측의 일치 요약 (K04) */
  alignment?: ReportAlignment;
};

/* ─── 실행 목록 (GET /api/personas/reports) ─────────────────────────────── */

/* 완료된 실행만, 최신순. 이름·차수·달성률 필드는 없습니다 */
export type PersonaReportSummary = {
  run_id: string;
  created_at: string | null;
  variant: Variant | null;
  /* 세션 개수 */
  sessions: number;
};

export type PersonaReportsResponse = { reports: PersonaReportSummary[] };

/* ─── 세션 질문 (POST /api/personas/explain) ─────────────────────────────── */

/* run_id 는 현재 실행 ID 여야 합니다. step 은 선택(1 이상) */
export type ExplainRequest = {
  run_id: string;
  session_id: string;
  question: string;
  step?: number;
};

export type ExplainAnswer = {
  id: string;
  question: string;
  answer: string;
  kind:
    | "observations"
    | "not_observed"
    | "improvement_hypothesis"
    | "recorded_action"
    | "model_stop"
    | "recorded_outcome"
    | "execution_status";
  supported_by_record: boolean;
  sources: { step: number; stage: Stage; stage_name: string; artifact_id: string | null }[];
  recorded_at: string;
  method: "record_based_rules";
  model_calls: number;
};

/* ─── 사람 관측 (POST /api/personas/human) — 명세 5.2 ─────────────────────── */

/* 이탈 원인 7종 + 모름·없음. success 는 cause=none 이어야 합니다 */
export type DropCause =
  | "input_burden"
  | "navigation"
  | "cost"
  | "value"
  | "trust"
  | "technical"
  | "accessibility"
  | "unknown"
  | "none";

/* 사람 관측의 멈춘 단계. Stage 와 달리 "other" 가 없습니다 */
export type HumanStage = Exclude<Stage, "other">;

/*
  - persona_id 는 프로필 ID 가 아니라 비교할 세션 ID 입니다 (예: "quick_order")
  - participant_id: 영문·숫자·밑줄·하이픈 1~40자, source: 공백 제거 후 3~300자
  - success 는 stage=complete, cause=none
  - 현재 실행이 완료된 뒤에만 저장됩니다. 응답은 갱신된 실행 상태(PersonaRun)
*/
export type HumanObservationRequest = {
  run_id: string;
  persona_id: string;
  participant_id: string;
  outcome: "success" | "dropout";
  stage: HumanStage;
  cause: DropCause;
  source: string;
};

/* 저장된 관측. 명세에 모양이 없어 요청 필드 + 저장 시각으로 둡니다 (임시) */
export type HumanObservation = Omit<HumanObservationRequest, "run_id"> & { recorded_at: string };

/* ─── 리포트 (GET /api/personas/report?run_id=) — 명세 6.1 ──────────────── */
/*
  명세에는 필드 이름만 있고 안쪽 모양은 아직 없습니다.
  아래 모양은 화면을 만들기 위한 임시 정의이며, BE 명세가 나오면 이 절부터 고칩니다.
  예측 값(인원·비율)은 시드 반복 결과의 [최소, 최대] 범위로 받습니다.
*/

export type Range = [min: number, max: number];

export type ReportSummary = {
  sessions: number;
  success: number;
  /* 가상 이탈. 기술 실패(technical)는 여기에 넣지 않습니다 */
  simulated_dropout: number;
  technical: number;
  findings: number;
  /* 근거 화면이 없는 결과 수. 이미지를 만들어 채우지 않습니다 */
  missing_evidence: number;
};

/*
  과업별 퍼널 한 단계 (임시: 명세에 없음). Figma P12 "탐색 17~19명 · 이탈 1~3" 과 같은 의미입니다.
  - reached: 이 단계로 넘어온 인원. 첫 단계는 시작한 인원 전체(기술 실패 제외)
  - dropout: 직전 단계에서 이 단계로 넘어오지 못한 인원 (첫 단계는 0)
    → 가입 화면에서 떠난 세션은 가입 행의 이탈이고, 구간 이름은 "장바구니 → 가입"
*/
export type ReportFunnelStage = {
  stage: Stage;
  reached: Range;
  dropout: Range;
};

export type ReportTask = {
  id: string;
  name: string;
  total: number;
  success: number;
  dropout: number;
  technical: number;
  /* 임시: 명세에 없음. 없으면 화면에서 예측 퍼널을 숨깁니다 */
  funnel?: ReportFunnelStage[];
  /* 임시: 완료 세션의 중앙 소요 시간(초) 범위 (P12 요약 "완료자 중앙 소요 시간") */
  median_duration?: Range;
  /*
    임시: 세그먼트 × 이탈 구간 (P12 히트맵). dropouts[i] 는 funnel 의 (i) → (i+1) 구간 이탈 인원,
    길이는 funnel 길이 - 1 입니다.
  */
  segments?: ReportSegment[];
  /* 임시: 이 과업 퍼널의 실측 비교 (실측 퍼널은 과업마다 따로라 과업에 둡니다) */
  actual?: ReportActual;
};

export type ReportSegment = { id: string; name: string; dropouts: Range[] };

/* 임시: 실행 조건 (P12 설명 줄 "20명 × 시드 3회 · 보정 11월 5일") */
export type ReportConditions = {
  /* 과업별 패널 인원 */
  panel_size: number;
  seeds: number;
  /* 적용된 보정 시각. 보정 전이면 null */
  calibrated_at: string | null;
};

/*
  임시: 실측 비교 (P12 실측 비교 요약 · P14 상태). 원래는 실측 분석(R08) 비교 API 의 결과입니다.
  - unconnected: 스크립트 미설치 · collecting: 표본 모으는 중 · stale: 수집 중단 · comparable: 비교 가능
*/
export type ReportActual =
  | { status: "unconnected" }
  | { status: "collecting"; stages_ready: number; stages_total: number }
  | { status: "stale"; last_event_at: string }
  | {
      status: "comparable";
      /* 단계별 오차 절댓값 평균 (%p) */
      mean_error_pp: number;
      /* 실측이 예측 범위를 벗어난 단계 */
      gap_stages: Stage[];
      /* 최대 이탈 구간 [직전 단계, 이탈 단계]. 예측에 이탈이 없으면 predicted 는 null */
      max_drop: { predicted: [Stage, Stage] | null; actual: [Stage, Stage] };
    };

export type ReportEvidence = {
  session_id: string;
  /* GET /api/artifacts/{id}. 근거 화면이 없으면 null */
  artifact_id: string | null;
  evidence_status: "captured" | "missing";
  /* 화면 경로 (예: "/signup") */
  path: string;
  /* 문제 요소 설명 */
  annotation: string | null;
  observations: string[];
  /* 이 근거 화면까지 지나온 스텝 수 */
  steps_before: number;
  score: number;
  threshold: number;
};

export type ReportFinding = {
  id: string;
  task_id: string;
  stage: Stage;
  category: DropCause;
  title: string;
  /* 이 문제를 겪은 세션 수 / 이 과업의 세션 수 */
  affected_sessions: number;
  task_sessions: number;
  evidence: ReportEvidence[];
  interpretation: string;
  recommendation: string;
  /* 개선 목업 (AI 생성 예시, 근거 아님). 없으면 null */
  mockup: { artifact_id: string | null; note: string } | null;
};

export type TechnicalFailure = {
  session_id: string;
  persona_name: string;
  task_name: string;
  status: SessionStatus;
  reason: string;
};

export type AlignmentMetric = { matched: number; total: number };

/*
  사람 관측과 예측 비교 (임시 모양). 관측이 없어도 객체로 오고 status 가 unverified 입니다.
  metrics 는 기술 실패 세션에 대응한 관측을 뺀 비교 결과입니다.
*/
export type ReportAlignment = {
  participants: number;
  observations: number;
  metrics: { outcome: AlignmentMetric; stage: AlignmentMetric; cause: AlignmentMetric };
  status: "unverified" | "partial" | "verified";
};

export type PersonaReport = {
  schema_version: string;
  run_id: string;
  created_at: string;
  target: string;
  variant: Variant;
  audience: Audience;
  policy: string;
  model_calls: number;
  summary: ReportSummary;
  tasks: ReportTask[];
  findings: ReportFinding[];
  evidence: ReportEvidence[];
  technical_failures: TechnicalFailure[];
  alignment: ReportAlignment;
  /* 화면에 그대로 보여줄 결과 해석의 한계 */
  limitations: string[];
  /* 임시: 명세에 없음 (위 타입 설명 참고) */
  conditions?: ReportConditions;
};
