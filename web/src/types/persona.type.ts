/*
  페르소나 실행 API 타입 — BE docs/API_SPEC.md 4절 기준.
  필드 이름은 명세와 같게(snake_case) 유지합니다. 명세가 바뀌면 이 파일을 먼저 고칩니다.
  아래는 초기 세팅용 핵심 필드이며, 화면 담당자가 필요한 필드를 이어서 채웁니다.
*/

export type Variant = "fixed" | "problem";

export type AgeOption = "any" | "teens" | "20s" | "30s" | "40s" | "50s" | "60plus";

export type DiscoverRequest = { variant: Variant };

export type DiscoverResponse = {
  project: string;
  plan_id: string;
  variant: Variant;
  features: {
    id: string;
    name: string;
    evidence: { label: string; path: string };
    verification: string;
  }[];
  tasks: { id: string; name: string; goal: string; feature_id: string; suggested: boolean }[];
  age_options: Partial<Record<AgeOption, string>>;
  note: string;
};

/* 여섯 필드를 정확히 보냅니다. 누락·추가 필드는 400 */
export type ConfirmRequest = {
  plan_id: string;
  feature_ids: string[];
  task_ids: string[];
  ages: AgeOption[];
  context: string;
  additional_request: string;
};

export type RunStatus = "idle" | "running" | "completed";

export type SessionStatus =
  "queued" | "running" | "success" | "simulated_dropout" | "agent_failure" | "budget_exceeded";

export type PersonaSession = {
  id: string;
  profile_id: string;
  task_id: string;
  task_name: string;
  status: SessionStatus;
  steps: number;
  reason: string;
  artifact_id: string | null;
  viewer_url: string | null;
};

export type PersonaRun = {
  id: string;
  status: RunStatus;
  variant: Variant;
  policy: string;
  model_calls: number;
  profiles: { id: string; name: string; width: number; max_required_fields: number }[];
  sessions: PersonaSession[];
  audience: { ages: AgeOption[]; context: string };
};
