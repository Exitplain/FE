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
  /* 사람 관측(K04) 기록. 화면에서 쓸 때 필드를 이어서 채웁니다 */
  human_observations?: unknown[];
  /* 사람 관측과 예측의 일치 요약 (K04). 화면에서 쓸 때 필드를 이어서 채웁니다 */
  alignment?: Record<string, unknown>;
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
