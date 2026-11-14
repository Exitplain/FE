import type {
  AgeOption,
  AlignmentMetric,
  ConfirmRequest,
  DiscoverResponse,
  DropCause,
  ExplainAnswer,
  HumanObservation,
  HumanStage,
  PersonaReport,
  PersonaReportSummary,
  PersonaRun,
  PersonaSession,
  Range,
  ReportActual,
  ReportAlignment,
  ReportEvidence,
  ReportFinding,
  ReportFunnelStage,
  ReportSegment,
  ReportTask,
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
    /* 실제 원격 브라우저가 없어 라이브 주소는 비워 둡니다 (화면은 마지막 화면 안내로 대체) */
    session.viewer_url = null;
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
  syncHistory();

  return structuredClone(answer);
}

/* 완료된 현재 실행을 바꾼 뒤(질문·사람 관측) 목록(history)에도 같은 내용이 남도록 맞춥니다 */
function syncHistory() {
  const index = state.history.findIndex((run) => run.id === state.run.id);
  if (index >= 0) state.history[index] = structuredClone(state.run);
}

/* ─── 리포트 ─── */
/*
  BE 는 리포트를 요청할 때 계산합니다. mock 도 완료된 실행 기록(history)에서 그때그때 만듭니다.
  - 가상 이탈과 기술 실패(실행 오류·한도 도달)를 나눠 세고, 퍼널 분모에서 기술 실패를 뺍니다.
  - mock 은 시드 반복이 없어 예측 범위가 [n, n] 입니다. 범위를 지어내지 않습니다.
  - mock 에는 화면 캡처가 없어 근거는 모두 evidence_status "missing" 입니다.
*/

const TECHNICAL: SessionStatus[] = ["agent_failure", "budget_exceeded"];

const CAUSE_TEXT: Partial<Record<DropCause, { title: string; recommendation: string }>> = {
  input_burden: {
    title: "필수 입력 칸이 허용치를 넘었어요",
    recommendation: "필수 입력 칸을 줄이거나 나중에 받도록 미뤄 보세요.",
  },
  navigation: {
    title: "다음 단계로 가는 길을 찾지 못했어요",
    recommendation: "다음 행동 버튼을 핵심 정보 가까이에 두세요.",
  },
  cost: {
    title: "예상 밖 비용을 늦게 알게 됐어요",
    recommendation: "배송비 같은 추가 비용을 앞 단계에서 미리 보여주세요.",
  },
};

/* run_id 를 생략하면 현재 실행을 씁니다. 현재 실행이 미완료이면 과거 결과로 대체하지 않습니다 */
function findRun(requested: string | null): PersonaRun {
  const runId = requested ?? state.run.id;
  const saved = state.history.find((run) => run.id === runId);
  if (saved) return saved;
  if (state.run.id === runId && state.run.status === "running") {
    throw new MockApiError(409, "아직 끝나지 않은 실행입니다.");
  }
  throw new MockApiError(404, "저장된 실행을 찾을 수 없습니다.");
}

/*
  세션이 퍼널에서 몇 번째 단계까지 넘어갔는지 (types ReportFunnelStage 의 정의).
  - 완료: 끝까지
  - 이탈: 멈춘 화면 직전 단계까지 (가입 화면에서 떠났으면 "장바구니 → 가입" 구간 이탈)
  - 첫 화면은 모두 들어온 것으로 셉니다 (경로 밖에서 멈춘 세션도 분모에 남게)
*/
function passedIndex(session: PersonaSession, path: Stage[]) {
  if (session.status === "success") return path.length - 1;
  const stopped = session.terminal_stage ? path.indexOf(session.terminal_stage) : -1;
  return Math.max(0, stopped - 1);
}

function buildFunnel(counted: PersonaSession[], path: Stage[]): ReportFunnelStage[] {
  const reached = path.map(
    (_, index) => counted.filter((s) => passedIndex(s, path) >= index).length,
  );
  return path.map((stage, index) => {
    const dropout = index === 0 ? 0 : reached[index - 1] - reached[index];
    return {
      stage,
      reached: [reached[index], reached[index]],
      dropout: [dropout, dropout],
    };
  });
}

function buildTask(run: PersonaRun, taskId: string): ReportTask {
  const sessions = run.sessions.filter((s) => s.task_id === taskId);
  const counted = sessions.filter((s) => !TECHNICAL.includes(s.status));
  /* 경로를 모르는 과업은 퍼널을 비워 두지 않고 아예 빼서 화면이 퍼널을 숨기게 합니다 */
  const path = TASK_PATHS[taskId];
  const task = run.tasks.find((t) => t.id === taskId) ?? TASKS.find((t) => t.id === taskId);

  return {
    id: taskId,
    name: task?.name ?? sessions[0]?.task_name ?? taskId,
    total: sessions.length,
    success: sessions.filter((s) => s.status === "success").length,
    dropout: sessions.filter((s) => s.status === "simulated_dropout").length,
    technical: sessions.length - counted.length,
    funnel: path ? buildFunnel(counted, path) : undefined,
    median_duration: medianDuration(counted),
    segments: path ? buildSegments(counted, path) : undefined,
    actual: path ? mockActual(buildFunnel(counted, path)) : undefined,
  };
}

/*
  mock 세션에는 시간 기록이 없어 스텝 수 × 15초를 소요 시간으로 둡니다 (예시값).
  완료 세션이 없으면 없음.
*/
const MOCK_SECONDS_PER_STEP = 15;

function medianDuration(counted: PersonaSession[]): Range | undefined {
  const seconds = counted
    .filter((s) => s.status === "success")
    .map((s) => s.steps * MOCK_SECONDS_PER_STEP)
    .sort((a, b) => a - b);
  if (seconds.length === 0) return undefined;
  const median = seconds[Math.floor(seconds.length / 2)];
  return [median, median];
}

/* 세그먼트(프로필)별로 퍼널 구간마다 몇 명이 떠났는지 — 퍼널과 같은 규칙(passedIndex)으로 셉니다 */
function buildSegments(counted: PersonaSession[], path: Stage[]): ReportSegment[] {
  const profiles = [...new Map(counted.map((s) => [s.profile_id, s.name])).entries()];
  return profiles.map(([id, name]) => {
    const sessions = counted.filter((s) => s.profile_id === id);
    const dropouts = path.slice(1).map((_, index): Range => {
      const lost = sessions.filter(
        (s) => s.status === "simulated_dropout" && passedIndex(s, path) === index,
      ).length;
      return [lost, lost];
    });
    return { id, name, dropouts };
  });
}

/*
  실측 비교 예시값. 실측 분석(R) API 가 없어 화면 확인용으로 "비교 가능" 상태를 돌려줍니다.
  예측 최대 이탈 구간은 첫 과업 퍼널에서 계산하고, 실측 쪽 수치는 고정 예시입니다.
*/
function mockActual(funnel: ReportFunnelStage[]): ReportActual {
  /* 화면의 "최대 이탈 구간"과 같은 규칙: 이탈 상한이 가장 큰 단계, 이탈이 없으면 null */
  let worst = -1;
  funnel.forEach((stage, index) => {
    if (
      index > 0 &&
      stage.dropout[1] > 0 &&
      (worst < 0 || stage.dropout[1] > funnel[worst].dropout[1])
    ) {
      worst = index;
    }
  });
  const predicted: [Stage, Stage] | null =
    worst > 0 ? [funnel[worst - 1].stage, funnel[worst].stage] : null;
  return {
    status: "comparable",
    mean_error_pp: 4.5,
    gap_stages: ["cart"],
    max_drop: { predicted, actual: ["product", "cart"] },
  };
}

/* mock 세션 issue 의 관측값(입력 칸 수)은 입력 부담일 때만 문제 설명이 됩니다 */
function inputBurden(session: PersonaSession) {
  return session.issue?.category === "input_burden" ? session.issue : null;
}

function buildEvidence(session: PersonaSession): ReportEvidence {
  const last = session.trace.at(-1);
  const burden = inputBurden(session);
  return {
    session_id: session.id,
    artifact_id: last?.artifact_id ?? null,
    evidence_status: last?.artifact_id ? "captured" : "missing",
    path: session.url ?? "",
    annotation: burden
      ? `필수 입력 ${burden.observed_fields}칸 · 허용 ${burden.configured_limit}칸 초과`
      : null,
    observations: [session.reason],
    steps_before: session.steps,
    score: last?.score ?? 0,
    threshold: last?.threshold ?? session.max_required_fields * 16,
  };
}

/* 이탈 세션을 과업 × 단계 × 원인으로 묶어 발견한 문제를 만듭니다 */
function buildFindings(run: PersonaRun): ReportFinding[] {
  type Group = { taskId: string; stage: Stage; cause: DropCause; sessions: PersonaSession[] };
  const groups = new Map<string, Group>();
  for (const session of run.sessions) {
    if (session.status !== "simulated_dropout" || !session.terminal_stage) continue;
    const cause: DropCause = session.issue?.category ?? "unknown";
    const key = JSON.stringify([session.task_id, session.terminal_stage, cause]);
    const group = groups.get(key) ?? {
      taskId: session.task_id,
      stage: session.terminal_stage,
      cause,
      sessions: [],
    };
    group.sessions.push(session);
    groups.set(key, group);
  }

  return [...groups.values()]
    .map(({ taskId, stage, cause, sessions }, index): ReportFinding => {
      const text = CAUSE_TEXT[cause];
      const issue = inputBurden(sessions[0]);
      return {
        id: `finding-${index + 1}`,
        task_id: taskId,
        stage,
        category: cause,
        title: text?.title ?? "이탈 원인을 특정하지 못했어요",
        affected_sessions: sessions.length,
        task_sessions: run.sessions.filter(
          (s) => s.task_id === taskId && !TECHNICAL.includes(s.status),
        ).length,
        evidence: sessions.map(buildEvidence),
        interpretation: issue
          ? `입력 칸 ${issue.observed_fields}개가 허용치 ${issue.configured_limit}개를 넘어 좌절 점수가 임계치를 넘었습니다.`
          : sessions[0].reason,
        recommendation: text?.recommendation ?? "세션 기록을 직접 확인해 보세요.",
        mockup: null,
      };
    })
    .sort((a, b) => b.affected_sessions - a.affected_sessions);
}

export function report(runId: string | null): PersonaReport {
  const run = findRun(runId);
  const findings = buildFindings(run);
  const evidence = findings.flatMap((finding) => finding.evidence);
  const count = (status: SessionStatus[]) =>
    run.sessions.filter((s) => status.includes(s.status)).length;
  const tasks = [...new Set(run.sessions.map((s) => s.task_id))].map((id) => buildTask(run, id));

  return structuredClone({
    schema_version: "mock-1",
    run_id: run.id!,
    created_at: run.created_at ?? new Date().toISOString(),
    target: run.target,
    variant: run.variant ?? "fixed",
    audience: run.audience ?? {},
    policy: run.policy,
    model_calls: run.model_calls,
    summary: {
      sessions: run.sessions.length,
      success: count(["success"]),
      simulated_dropout: count(["simulated_dropout"]),
      technical: count(TECHNICAL),
      findings: findings.length,
      missing_evidence: evidence.filter((e) => e.evidence_status === "missing").length,
    },
    tasks,
    findings,
    evidence,
    technical_failures: run.sessions
      .filter((s) => TECHNICAL.includes(s.status))
      .map((s) => ({
        session_id: s.id,
        persona_name: s.name,
        task_name: s.task_name,
        status: s.status,
        reason: s.reason,
      })),
    alignment: buildAlignment(run, run.human_observations ?? []),
    limitations: [
      "모의 실행(mock) 결과입니다. 실제 사용자 이탈률이 아닙니다.",
      "연령은 설명 문맥으로만 쓰고 행동 보정은 검증 전입니다.",
    ],
    /* mock 은 시드 반복과 보정이 없습니다 */
    conditions: {
      panel_size: Math.max(0, ...tasks.map((task) => task.total)),
      seeds: 1,
      calibrated_at: null,
    },
  });
}

export function reportMarkdown(runId: string | null): string {
  const data = report(runId);
  const lines = [
    `# 사전 테스트 리포트 (${data.run_id})`,
    "",
    `- 세션 ${data.summary.sessions}개 · 완료 ${data.summary.success} · 가상 이탈 ${data.summary.simulated_dropout} · 기술 실패 ${data.summary.technical}`,
    "",
    "## 발견한 문제",
    ...data.findings.map(
      (f) => `- ${f.title} (${f.stage}, ${f.affected_sessions}/${f.task_sessions}명)`,
    ),
    "",
    "## 해석의 한계",
    ...data.limitations.map((text) => `- ${text}`),
  ];
  return lines.join("\n");
}

/* ─── 사람 관측 ─── */

const HUMAN_KEYS = [
  "run_id",
  "persona_id",
  "participant_id",
  "outcome",
  "stage",
  "cause",
  "source",
];
const HUMAN_STAGES: HumanStage[] = [
  "landing",
  "product",
  "cart",
  "signup",
  "checkout",
  "complete",
  "delivery",
  "benefits",
  "coupon",
  "account",
  "subscription",
];
const CAUSES: DropCause[] = [
  "input_burden",
  "navigation",
  "cost",
  "value",
  "trust",
  "technical",
  "accessibility",
  "unknown",
  "none",
];

function metric(observations: HumanObservation[], matches: (o: HumanObservation) => boolean) {
  return {
    matched: observations.filter(matches).length,
    total: observations.length,
  } satisfies AlignmentMetric;
}

/*
  사람 관측과 예측 비교. 기술 실패 세션(실행 오류·한도 도달)은 예측 결과가 없으므로 비교에서 뺍니다.
  (가상 이탈로 셈하면 사람이 이탈을 기록했을 때 일치로 잡혀 일치율이 부풀려집니다)
  관측이 없거나 비교할 관측이 없으면 unverified 입니다.
*/
function buildAlignment(run: PersonaRun, saved: HumanObservation[]): ReportAlignment {
  const sessionOf = (o: HumanObservation) => run.sessions.find((s) => s.id === o.persona_id);
  const observations = saved.filter((o) => {
    const session = sessionOf(o);
    return session !== undefined && !TECHNICAL.includes(session.status);
  });
  const predictedOutcome = (o: HumanObservation) =>
    sessionOf(o)?.status === "success" ? "success" : "dropout";
  const predictedStage = (o: HumanObservation) => {
    const session = sessionOf(o);
    return session?.status === "success" ? "complete" : session?.terminal_stage;
  };
  const predictedCause = (o: HumanObservation) => {
    const session = sessionOf(o);
    return session?.status === "success" ? "none" : (session?.issue?.category ?? "unknown");
  };

  const metrics = {
    outcome: metric(observations, (o) => predictedOutcome(o) === o.outcome),
    stage: metric(observations, (o) => predictedStage(o) === o.stage),
    cause: metric(observations, (o) => predictedCause(o) === o.cause),
  };
  const all = Object.values(metrics);
  return {
    participants: new Set(saved.map((o) => o.participant_id)).size,
    observations: saved.length,
    metrics,
    status:
      observations.length === 0
        ? "unverified"
        : all.every((m) => m.matched === m.total)
          ? "verified"
          : "partial",
  };
}

/*
  BE 명세 5.2 와 같은 검증. 같은 참여자 × 과업 × 세션은 갱신하고,
  같은 참여자 × 과업을 다른 세션에 대응하면 400 입니다.
*/
export function human(body: unknown): PersonaRun {
  const record = (body ?? {}) as Record<string, unknown>;
  const keys = Object.keys(record);
  const source = typeof record.source === "string" ? record.source.trim() : "";
  const run = state.run;
  const session = run.sessions.find((s) => s.id === record.persona_id);

  if (keys.length !== HUMAN_KEYS.length || !HUMAN_KEYS.every((key) => keys.includes(key))) {
    throw new MockApiError(400, "관측 항목을 모두 입력해주세요.");
  }
  if (run.status !== "completed" || record.run_id !== run.id) {
    throw new MockApiError(400, "완료된 현재 실행에만 관측을 저장할 수 있습니다.");
  }
  if (!session) throw new MockApiError(400, "비교할 세션을 찾을 수 없습니다.");
  if (
    typeof record.participant_id !== "string" ||
    !/^[A-Za-z0-9_-]{1,40}$/.test(record.participant_id)
  ) {
    throw new MockApiError(400, "참여자 코드는 영문·숫자·밑줄·하이픈 1~40자로 입력해주세요.");
  }
  if (source.length < 3 || source.length > 300) {
    throw new MockApiError(400, "관측 근거는 3~300자로 입력해주세요.");
  }
  if (
    (record.outcome !== "success" && record.outcome !== "dropout") ||
    !HUMAN_STAGES.includes(record.stage as HumanStage) ||
    !CAUSES.includes(record.cause as DropCause) ||
    (record.outcome === "success" && (record.stage !== "complete" || record.cause !== "none"))
  ) {
    throw new MockApiError(400, "결과·단계·원인을 확인해주세요.");
  }

  const observation: HumanObservation = {
    persona_id: session.id,
    participant_id: record.participant_id,
    outcome: record.outcome,
    stage: record.stage as HumanStage,
    cause: record.cause as DropCause,
    source,
    recorded_at: new Date().toISOString(),
  };
  const taskOf = (o: HumanObservation) => run.sessions.find((s) => s.id === o.persona_id)?.task_id;
  const existing = run.human_observations ?? [];
  const sameTask = existing.filter(
    (o) => o.participant_id === observation.participant_id && taskOf(o) === session.task_id,
  );
  if (sameTask.some((o) => o.persona_id !== session.id)) {
    throw new MockApiError(400, "이 참여자의 같은 과업 관측이 다른 세션에 이미 있습니다.");
  }

  const observations = [...existing.filter((o) => !sameTask.includes(o)), observation];
  run.human_observations = observations;
  run.alignment = buildAlignment(run, observations);
  syncHistory();

  return structuredClone(run);
}
