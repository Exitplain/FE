import type { DiscoverFeature, DiscoverTask } from "./persona.type";

/*
  제품 API 새 테스트 위저드 타입 (P02~P07). 기준: BE backend/projects·discoveries·plans·personas·testaccounts·runs
  모든 요청은 로그인 + 프로젝트 소유자만 됩니다 (샘플 프로젝트도 403).
*/

/* BE plans.catalog AGE_CHOICES — "any" 는 단독으로만 */
export type AgeKey = "any" | "20s" | "30s" | "40s" | "50plus";

/* POST /api/v1/projects/{id}/check — 접속하지 못해도 200 */
export type SiteCheck = {
  status: "ok" | "failed";
  http_status: number | null;
  elapsed_ms: number | null;
  checked_at: string;
  reason: string | null;
  message: string | null;
};

export type SiteCheckResponse = { project_id: number; check: SiteCheck };

export type DiscoveryRequest = {
  entry_url?: string;
  login_mode?: "none" | "test_account";
  variant?: "fixed" | "problem";
};

/* POST /api/v1/projects/{id}/discoveries (동기, 수 초) — 15분 뒤 만료 */
export type Discovery = {
  id: string;
  project_id: number;
  entry_url: string;
  login_mode: "none" | "test_account";
  variant: "fixed" | "problem";
  features: DiscoverFeature[];
  tasks: Omit<DiscoverTask, "funnel_stages">[];
  note: string;
  elapsed_seconds: number;
  created_at: string;
  expires_at: string;
  expired: boolean;
};

export type PlanBlocking = { step: number; code: string; message: string };

export type PlanReview = {
  site: { entry_url: string; login_mode: "none" | "test_account"; edit_step: number };
  tasks: { names: string[]; edit_step: number };
  audience: { context: string; age_labels: string[]; edit_step: number };
  not_in_run: { custom_tasks: string[]; additional_request: string };
  funnels: { auto: boolean; stages_per_task: Record<string, number> };
  personas: { segments: number; total: number; edit_step: number };
  limits: PlanLimits;
  total_sessions: number;
  blocking: PlanBlocking[];
};

export type PlanLimits = {
  viewport_width: number;
  concurrency: number;
  request_interval_seconds: number;
  seed_count: number;
  max_steps: number;
  timeout_seconds: number;
  cost_cap: number | null;
};

/* GET·PATCH /api/v1/plans/{id} — 응답 헤더 ETag: "{revision}" */
export type Plan = {
  id: string;
  project_id: number;
  discovery_id: string;
  revision: number;
  options: {
    features: DiscoverFeature[];
    tasks: Omit<DiscoverTask, "funnel_stages">[];
    capabilities: {
      ages: Partial<Record<AgeKey, string>>;
      segment_ids: string[];
      persona_total: number;
      limits: Record<string, { min: number; max: number }>;
      custom_task_limit: number;
    };
  };
  task_ids: string[];
  custom_tasks: { id: string; text: string; state: string }[];
  additional_request: string;
  audience: { context: string; ages: AgeKey[] };
  task_funnels: {
    task_id: string;
    auto: boolean;
    stages: { id: string; name: string; order: number }[];
  }[];
  segments: { id: string; count: number }[];
  limits: PlanLimits;
  review: PlanReview;
  snapshots: { plan_revision_id: string; plan_revision: number; confirmed_at: string }[];
  created_at: string;
  updated_at: string;
};

/* PATCH 본문 — 보낸 최상위 필드만 바꿉니다 (하나 이상) */
export type PlanPatch = Partial<{
  task_ids: string[];
  custom_tasks: string[];
  additional_request: string;
  audience: { context: string; ages: AgeKey[] };
  segments: { id: string; count: number }[];
}>;

export type SnapshotSegment = {
  id: string;
  name: string;
  count: number;
  variables: Record<"patience" | "digital_literacy" | "price_sensitivity" | "trust_need", number>;
  basis: string[];
  representative: string;
};

export type SnapshotPersona = {
  persona_snapshot_id: string;
  code: string;
  segment_id: string;
  segment_name: string;
  is_representative: boolean;
  variables: SnapshotSegment["variables"];
  context: string;
};

/* POST /api/v1/plans/{id}/confirmations — 확정한 계획 (plan revision snapshot) */
export type PlanSnapshot = {
  plan_revision_id: string;
  plan_id: string;
  plan_revision: number;
  confirmed_at: string;
  persona_generator: string;
};

/* GET /api/v1/plan-revisions/{id}/personas */
export type RevisionPersonas = {
  segments: SnapshotSegment[];
  items: SnapshotPersona[];
  generator: string;
  total_sessions: number;
};

/* GET·PUT /api/v1/projects/{id}/test-accounts — 비밀번호는 응답에 없습니다 */
export type TestAccountItem = {
  id: string;
  position: number;
  username: string;
  has_password: boolean;
  status: "unchecked" | "ok" | "failed";
};

export type TestAccounts = {
  project_id: number;
  login_url: string;
  count: number;
  min: number;
  max: number;
  ready: boolean;
  items: TestAccountItem[];
};

export type TestAccountsRequest = {
  login_url?: string;
  accounts: { id?: string; username: string; password?: string }[];
};

/* POST /api/v1/runs — 202 */
export type RunCreateRequest = {
  plan_revision_id: string;
  base_run_id?: string | null;
  change_note?: string;
};

export type RunCreated = { run_id: string; status: "queued"; status_url: string };
