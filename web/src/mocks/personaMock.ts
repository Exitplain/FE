import type {
  AgeOption,
  ConfirmRequest,
  DiscoverResponse,
  ExplainAnswer,
  PersonaReportSummary,
  PersonaRun,
  PersonaSession,
  SessionStatus,
  Stage,
  Variant,
} from "@/types/persona.type";

import {
  AGE_LABELS,
  DISCOVER_TASKS,
  FEATURES,
  idlePersonaRun,
  PROFILES,
  TASK_FEATURE,
  TASKS,
} from "./fixtures/personas";

/*
  BE 개발 API(페르소나 실행)를 흉내 내는 메모리 상태.
  `npm run dev:mock` 에서 탐색 → 확인 → 실행 진행 → 완료 → 목록 흐름을 끝까지 볼 수 있게 합니다.
  - GET /api/personas 를 부를 때마다 한 단계씩 진행합니다(BE 의 실제 시간 대신 조회 횟수 기준).
  - 동시 실행 3세션, 과업 × 프로필 3개 = 세션 수 (BE 와 같음)
  - 세션 결과는 정해 둔 예시입니다: 빠른 구매는 이탈, 여유 있는 탐색의 배송 지역 확인은 실행 오류, 나머지는 완료.
  검증 규칙은 BE agent/preflight.py confirm 과 같게 맞춥니다. 실제 결과처럼 보여주지 않습니다.
*/

const CONCURRENCY = 3;
const TICKS_PER_SESSION = 3;
const CONFIRM_FIELDS = [
  "plan_id",
  "feature_ids",
  "task_ids",
  "ages",
  "context",
  "additional_request",
];

/* 과업별로 지나가는 화면 단계 (마지막이 도착 화면) */
const TASK_PATHS: Record<string, Stage[]> = {
  order: ["landing", "product", "cart", "signup", "checkout", "complete"],
  coupon: ["landing", "benefits", "coupon", "cart", "checkout", "complete"],
  delivery: ["landing", "delivery", "complete"],
  subscription: ["landing", "account", "subscription", "complete"],
  cart: ["landing", "product", "cart"],
  benefit: ["landing", "benefits", "coupon"],
};

type Plan = { variant: Variant; createdAt: number };

type MockState = {
  plans: Map<string, Plan>;
  run: PersonaRun;
  ticks: Map<string, number>;
  history: PersonaRun[];
  sequence: number;
};

function initialState(): MockState {
  return {
    plans: new Map(),
    run: structuredClone(idlePersonaRun),
    ticks: new Map(),
    history: [],
    sequence: 0,
  };
}

let state = initialState();

/* 테스트마다 처음 상태로 돌립니다 (src/test/setup.ts) */
export function resetPersonaMock() {
  state = initialState();
}

function nextId(prefix: string) {
  state.sequence += 1;
  return `mock-${prefix}-${state.sequence}`;
}

export class MockApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/* ─── 탐색 ─── */

export function discover(body: unknown): DiscoverResponse {
  const keys = body && typeof body === "object" ? Object.keys(body) : [];
  const variant = (body as { variant?: unknown } | null)?.variant;
  if (keys.length !== 1 || !keys.includes("variant")) {
    throw new MockApiError(400, "반찬 데모 버전만 선택해주세요.");
  }
  if (variant !== "fixed" && variant !== "problem") {
    throw new MockApiError(400, "지원하는 반찬 데모 버전을 선택해주세요.");
  }

  const planId = nextId("plan");
  state.plans.set(planId, { variant, createdAt: Date.now() });
  return {
    project: "반찬로드",
    plan_id: planId,
    variant,
    features: structuredClone(FEATURES),
    tasks: structuredClone(DISCOVER_TASKS),
    age_options: { ...AGE_LABELS },
    note: "공개 시작 화면의 링크를 읽었습니다. 기능의 정상 작동을 판정한 것은 아닙니다.",
  };
}

/* ─── 확인 후 실행 ─── */

function isStringList(value: unknown, allowed: readonly string[]): value is string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= allowed.length &&
    value.every((item) => typeof item === "string" && allowed.includes(item)) &&
    new Set(value).size === value.length
  );
}

function validateConfirm(body: unknown): ConfirmRequest & { variant: Variant } {
  const record = (body ?? {}) as Record<string, unknown>;
  const keys = Object.keys(record).filter((key) => record[key] !== undefined);
  if (keys.length !== CONFIRM_FIELDS.length || !CONFIRM_FIELDS.every((f) => keys.includes(f))) {
    throw new MockApiError(400, "확인한 기능·과업·타겟을 전달해주세요.");
  }

  const plan = typeof record.plan_id === "string" ? state.plans.get(record.plan_id) : undefined;
  if (!plan || Date.now() - plan.createdAt >= 15 * 60 * 1000) {
    throw new MockApiError(400, "탐색 결과가 만료됐습니다. 다시 확인해주세요.");
  }

  const { feature_ids, task_ids, ages } = record;
  if (
    !isStringList(
      feature_ids,
      FEATURES.map((f) => f.id),
    ) ||
    !isStringList(
      task_ids,
      TASKS.map((t) => t.id),
    ) ||
    !isStringList(ages, Object.keys(AGE_LABELS))
  ) {
    throw new MockApiError(400, "기능·과업·연령을 한 개 이상 선택해주세요.");
  }
  if (task_ids.some((task) => !feature_ids.includes(TASK_FEATURE[task]))) {
    throw new MockApiError(400, "확인한 기능에 해당하는 과업만 실행할 수 있습니다.");
  }
  if (ages.includes("any") && ages.length > 1) {
    throw new MockApiError(400, "전체 연령과 특정 연령을 함께 선택할 수 없습니다.");
  }
  for (const key of ["context", "additional_request"] as const) {
    if (typeof record[key] !== "string" || (record[key] as string).length > 500) {
      throw new MockApiError(400, "추가 설명은 500자 이하로 입력해주세요.");
    }
  }

  return { ...(record as ConfirmRequest), variant: plan.variant };
}

export function confirm(body: unknown): PersonaRun {
  const request = validateConfirm(body);
  if (state.run.status === "running") {
    throw new MockApiError(409, "이미 페르소나 점검이 실행 중입니다.");
  }

  const ages = request.ages as AgeOption[];
  const ageLabels = ages.map((age) => AGE_LABELS[age]);
  const chosen = TASKS.filter((task) => request.task_ids.includes(task.id));

  state.ticks = new Map();
  state.run = {
    ...structuredClone(idlePersonaRun),
    status: "running",
    id: nextId("run"),
    variant: request.variant,
    created_at: new Date().toISOString(),
    task_selection: "all",
    audience: {
      ages,
      age_labels: ageLabels,
      context: request.context,
      additional_request: request.additional_request,
      confirmed_features: request.feature_ids,
      plan_id: request.plan_id,
      confirmed_at: new Date().toISOString(),
    },
    sessions: chosen.flatMap((task) =>
      PROFILES.map((profile): PersonaSession => ({
        ...structuredClone(profile),
        id: `${profile.id}_${task.id}`,
        context: `${profile.context} · 타겟 ${ageLabels.join(", ")}${request.context ? ` · ${request.context}` : ""}`,
        profile_id: profile.id,
        task_id: task.id,
        task_name: task.name,
        goal: task.goal,
        status: "queued",
        reason: "브라우저 준비 대기",
        steps: 0,
        events: [],
        trace: [],
        terminal_stage: null,
        issue: null,
        artifact_id: null,
        viewer_url: null,
      })),
    ),
  };

  return structuredClone(state.run);
}

/* ─── 실행 진행 ─── */

function outcome(session: PersonaSession): SessionStatus {
  if (session.profile_id === "quick") return "simulated_dropout";
  if (session.profile_id === "patient" && session.task_id === "delivery") return "agent_failure";
  return "success";
}

function advanceSession(session: PersonaSession, tick: number) {
  const path = TASK_PATHS[session.task_id] ?? ["landing", "other"];
  const result = outcome(session);
  const isLast = tick >= TICKS_PER_SESSION;
  /* 이탈은 가운데쯤 단계에서, 완료는 마지막 단계에서 멈춥니다 */
  const stopIndex = result === "simulated_dropout" ? Math.floor(path.length / 2) : path.length - 1;
  const stage = path[Math.min(stopIndex, Math.round((stopIndex * tick) / TICKS_PER_SESSION))];
  const threshold = session.max_required_fields * 16;
  const score =
    result === "simulated_dropout" && isLast ? threshold + 6 : Math.round((threshold * tick) / 5);
  const step = session.steps + 4;

  session.steps = step;
  session.terminal_stage = stage;
  session.url = `/mock/${stage}`;
  session.events.push({ step, action: "click", description: `${stage} 화면으로 이동했습니다.` });
  session.trace.push({
    step,
    stage,
    score,
    previous_score: session.trace.at(-1)?.score ?? 0,
    threshold,
    required_fields: result === "simulated_dropout" && isLast ? session.max_required_fields + 1 : 1,
    crossed: score > threshold,
    url: session.url,
    artifact_id: null,
  });

  if (!isLast) {
    session.reason = `${stage} 화면을 살펴보고 있습니다.`;
    return;
  }

  session.status = result;
  session.viewer_url = null;
  if (result === "simulated_dropout") {
    session.reason = `좌절 점수 ${score}이 초기 가설 임계치 ${threshold}을 초과했습니다.`;
    session.issue = {
      category: "input_burden",
      observed_fields: session.max_required_fields + 1,
      configured_limit: session.max_required_fields,
      model_version: "frustration-v2",
    };
  } else if (result === "agent_failure") {
    session.reason = "브라우저 실행 오류 (mock)";
  } else {
    session.reason = `${session.task_name} 과업 완료 화면에 도달했습니다.`;
  }
}

function advance() {
  const run = state.run;
  if (run.status !== "running") return;

  for (const session of run.sessions.filter((s) => s.status === "running")) {
    const tick = (state.ticks.get(session.id) ?? 0) + 1;
    state.ticks.set(session.id, tick);
    advanceSession(session, tick);
  }

  let slots = CONCURRENCY - run.sessions.filter((s) => s.status === "running").length;
  for (const session of run.sessions) {
    if (slots <= 0) break;
    if (session.status !== "queued") continue;
    session.status = "running";
    session.reason = "실제 브라우저를 열고 있습니다.";
    session.viewer_url = `/mock/live/${session.id}`;
    slots -= 1;
  }

  if (run.sessions.every((s) => s.status !== "queued" && s.status !== "running")) {
    run.status = "completed";
    state.history.unshift(structuredClone(run));
  }
}

export function snapshot(): PersonaRun {
  advance();
  return structuredClone(state.run);
}

/* ─── 목록 · 질문 ─── */

export function reports(): PersonaReportSummary[] {
  return state.history.map((run) => ({
    run_id: run.id!,
    created_at: run.created_at ?? null,
    variant: run.variant ?? null,
    sessions: run.sessions.length,
  }));
}

const EXPLAIN_KEYS = ["run_id", "session_id", "question", "step"];
const MAX_ANSWERS = 20;

/*
  BE console.py·session_explain.py 와 같은 검증:
  키는 run_id·session_id·question(+ 선택 step), question 은 다듬은 뒤 1~500자, step 은 1 이상 정수,
  run_id 는 현재 실행이어야 합니다. 답은 세션 answers 에 최근 20개까지 쌓입니다.
  답 문장은 BE 규칙 엔진 대신 세션의 마지막 기록(reason)을 그대로 씁니다.
*/
export function explain(body: unknown): ExplainAnswer {
  const record = (body ?? {}) as Record<string, unknown>;
  const keys = Object.keys(record);
  const question = typeof record.question === "string" ? record.question.trim() : "";
  const step = record.step;
  const session = state.run.sessions.find((s) => s.id === record.session_id);

  if (
    !keys.every((key) => EXPLAIN_KEYS.includes(key)) ||
    !["run_id", "session_id", "question"].every((key) => keys.includes(key)) ||
    question.length < 1 ||
    question.length > 500 ||
    (step !== undefined && (!Number.isInteger(step) || (step as number) < 1)) ||
    record.run_id !== state.run.id ||
    !session
  ) {
    throw new MockApiError(400, "질문할 세션과 내용을 확인해주세요.");
  }

  const finished = session.status !== "queued" && session.status !== "running";
  const last = session.trace.at(-1);
  const answer: ExplainAnswer = {
    id: nextId("answer"),
    question,
    answer: finished ? session.reason : "아직 실행 중이라 기록이 끝나지 않았습니다.",
    kind: finished ? "recorded_outcome" : "execution_status",
    supported_by_record: finished,
    sources:
      finished && last
        ? [{ step: last.step, stage: last.stage, stage_name: last.stage, artifact_id: null }]
        : [],
    recorded_at: new Date().toISOString(),
    method: "record_based_rules",
    model_calls: 0,
  };

  session.answers = [...(session.answers ?? []), answer].slice(-MAX_ANSWERS);
  /* 완료된 실행은 목록(history)에도 같은 답이 남도록 맞춥니다 */
  const saved = state.history.find((run) => run.id === state.run.id);
  if (saved) saved.sessions = structuredClone(state.run.sessions);

  return structuredClone(answer);
}
