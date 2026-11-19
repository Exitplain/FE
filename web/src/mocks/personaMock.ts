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
  PanelSegment,
  PersonaPanel,
  PersonaReportSummary,
  PersonaRun,
  PersonaSession,
  PersonaTask,
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
import type { RunGoalRate, RunItem } from "@/types/run.type";

import { STAGE_LABELS } from "@/constants/persona";

import { CALIBRATIONS } from "./fixtures/calibration";

import {
  AGE_LABELS,
  DISCOVER_TASKS,
  DROPOUT_UTTERANCE,
  FEATURES,
  idlePersonaRun,
  type MockSegment,
  SEGMENTS,
  TASK_FEATURE,
  TASKS,
  UTTERANCES,
} from "./fixtures/personas";

/*
  BE 개발 API(페르소나 실행)를 흉내 내는 메모리 상태.
  `npm run dev:mock` 에서 탐색 → 확인 → 실행 진행 → 완료 → 목록 흐름을 끝까지 볼 수 있게 합니다.
  - GET /api/personas 를 부를 때마다 한 단계씩 진행합니다(BE 의 실제 시간 대신 조회 횟수 기준).
  - 임시: Figma 실행 화면에 맞춰 세그먼트 4개 × 인원(기본 5명) = 에이전트 20명(P-001~P-020) × 과업,
    시드 3회로 실행합니다. 개발 서버는 아직 고정 프로필 3개라 mock 모드에서만 이 모양입니다.
  - 단계: 준비(P08, 브라우저 준비) → 실행(P09, 시드 1~3) → 분석(P10) → 완료.
  - 세션 결과는 세그먼트 성향과 시드로 정한 예시입니다(빠른 구매형은 가입에서 자주 이탈 등).
    배송 지역 확인 과업은 항상 접속 실패(E05), 과업을 5개 이상 고르면 시드 2에서 비용 상한(E12)에 닿습니다.
  - Figma 는 동시 5세션이지만 데모가 빨리 끝나도록 mock 은 동시 20세션으로 돌립니다.
  검증 규칙은 BE agent/preflight.py confirm 과 같게 맞춥니다. 실제 결과처럼 보여주지 않습니다.
*/

const CONCURRENCY = 20;
const TICKS_PER_SESSION = 2;
const SEEDS = 3;
/* 준비 단계에서 브라우저를 모두 여는 데 걸리는 조회 수 */
const PREPARE_POLLS = 2;
/* 이 수 이상의 과업이면 시드 2 중간에 비용 상한에 닿습니다 (E12) */
const BUDGET_TASKS = 5;
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
  /* 마지막으로 만든 페르소나 패널 (P06·P07). 실행은 이 인원으로 에이전트를 만듭니다 */
  panel: PanelSegment[];
  /* 실행별 시드마다 끝난 세션 (리포트 범위 계산용) */
  seedRuns: Map<string, PersonaSession[][]>;
};

const codeOf = (n: number) => `P-${String(n).padStart(3, "0")}`;

/* 세그먼트별 인원으로 P 코드를 차례로 붙입니다 (0명 세그먼트는 뺍니다) */
function buildPanel(counts: number[]): PanelSegment[] {
  let next = 1;
  return SEGMENTS.flatMap((segment, index) => {
    const count = counts[index] ?? 0;
    if (count <= 0) return [];
    const first = next;
    next += count;
    return [
      {
        id: segment.id,
        name: segment.name,
        count,
        codes: [codeOf(first), codeOf(first + count - 1)] as [string, string],
        representative: codeOf(first),
        traits: { ...segment.traits },
      },
    ];
  });
}

function initialState(): MockState {
  return {
    plans: new Map(),
    run: structuredClone(idlePersonaRun),
    ticks: new Map(),
    history: [],
    sequence: 0,
    panel: buildPanel([5, 5, 5, 5]),
    seedRuns: new Map(),
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

/* 같은 입력이면 같은 값 (0~1). 세션·시드마다 결과를 정해 두려고 씁니다 */
function rand(key: string) {
  let hash = 2166136261;
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296;
}

function pick<T>(items: readonly T[], key: string): T {
  return items[Math.floor(rand(key) * items.length) % items.length];
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
    tasks: DISCOVER_TASKS.map((task) => ({
      ...structuredClone(task),
      funnel_stages: TASK_PATHS[task.id]?.length,
    })),
    age_options: { ...AGE_LABELS },
    note: "공개 시작 화면의 링크를 읽었습니다. 기능의 정상 작동을 판정한 것은 아닙니다.",
    /* 임시 필드 예시값 (명세에 없음) */
    response_ms: 800,
    screens_read: 12,
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

/* ─── 페르소나 패널 (임시 v1: POST /api/v1/persona-panels) ─── */

/* 세그먼트 4개의 인원으로 패널을 만듭니다. 합계 1~20명, 음수·소수 불가 */
export function generatePanel(body: unknown): PersonaPanel {
  const record = (body ?? {}) as Record<string, unknown>;
  const counts = record.segments;
  if (
    typeof record.context !== "string" ||
    !Array.isArray(counts) ||
    counts.length !== SEGMENTS.length ||
    !counts.every((count) => Number.isInteger(count) && (count as number) >= 0)
  ) {
    throw new MockApiError(400, "세그먼트 인원을 확인해주세요.");
  }
  const total = (counts as number[]).reduce((sum, count) => sum + count, 0);
  if (total < 1 || total > 20) throw new MockApiError(400, "AI 고객은 1~20명이어야 합니다.");

  state.panel = buildPanel(counts as number[]);
  return { segments: structuredClone(state.panel) };
}

/* ─── 확인 후 실행 ─── */

/* 패널 × 과업으로 이번 시드의 세션을 만듭니다. 세션 ID 는 "P-001_order" (시드가 바뀌어도 같음) */
function seedSessions(run: PersonaRun, tasks: PersonaTask[], seed: number): PersonaSession[] {
  const ageLabels = run.audience?.age_labels ?? [];
  const context = run.audience?.context ?? "";
  return tasks.flatMap((task) =>
    (run.panel ?? []).flatMap((segment) => {
      const source = SEGMENTS.find((item) => item.id === segment.id)!;
      const start = Number(segment.codes[0].slice(2));
      return Array.from({ length: segment.count }, (_, index): PersonaSession => {
        const code = codeOf(start + index);
        return {
          id: `${code}_${task.id}`,
          name: segment.name,
          context: `${source.context} · 타겟 ${ageLabels.join(", ")}${context ? ` · ${context}` : ""}`,
          ...source.profile,
          profile_id: segment.id,
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
          code,
          segment_id: segment.id,
          segment_name: segment.name,
          seed,
          utterances: [],
          elapsed_ms: 0,
          tokens: 0,
          cost_usd: 0,
        };
      });
    }),
  );
}

export function confirm(body: unknown): PersonaRun {
  const request = validateConfirm(body);
  if (state.run.status === "running") {
    throw new MockApiError(409, "이미 페르소나 점검이 실행 중입니다.");
  }

  const ages = request.ages as AgeOption[];
  const ageLabels = ages.map((age) => AGE_LABELS[age]);
  const chosen = TASKS.filter((task) => request.task_ids.includes(task.id));
  const panel = structuredClone(state.panel);
  const agents = panel.reduce((sum, segment) => sum + segment.count, 0);

  state.ticks = new Map();
  const run: PersonaRun = {
    ...structuredClone(idlePersonaRun),
    status: "running",
    id: nextId("run"),
    variant: request.variant,
    created_at: new Date().toISOString(),
    task_selection: "all",
    profiles: panel.map((segment) => {
      const source = SEGMENTS.find((item) => item.id === segment.id)!;
      return { id: segment.id, name: segment.name, context: source.context, ...source.profile };
    }),
    tasks: chosen,
    audience: {
      ages,
      age_labels: ageLabels,
      context: request.context,
      additional_request: request.additional_request,
      confirmed_features: request.feature_ids,
      plan_id: request.plan_id,
      confirmed_at: new Date().toISOString(),
    },
    sessions: [],
    stage: "preparing",
    prepare: { browsers_ready: 0, browsers_total: agents },
    seeds: { current: 1, total: SEEDS },
    panel,
  };
  run.sessions = seedSessions(run, chosen, 1);
  state.run = run;
  state.seedRuns.set(run.id!, []);

  return structuredClone(state.run);
}

/* ─── 실행 진행 ─── */

const TECHNICAL: SessionStatus[] = ["agent_failure", "budget_exceeded"];

type Outcome = {
  status: SessionStatus;
  /* 경로에서 멈추는 위치 (완료는 마지막) */
  stopIndex: number;
  cause: MockSegment["dropout"]["cause"] | null;
};

/*
  세션 결과 — 세그먼트 성향 × 시드로 정합니다.
  - 배송 지역 확인은 항상 접속 실패 (E05 예시)
  - 그 밖에는 3% 기술 실패, 세그먼트 이탈 확률만큼 그 세그먼트의 이탈 단계에서 떠남
    (과업 경로에 그 단계가 없으면 경로 가운데에서)
*/
/*
  임시: 개선 버전(fixed)은 "수정 후 재테스트"(P17)로 고친 사이트를 흉내 냅니다.
  같은 세션·시드라도 이탈 확률을 낮춰 P18 전후 비교에 차이가 보이게 합니다.
  입력 부담(필수 입력 줄이기 같은 수정)은 많이, 그 밖의 원인은 조금 줄입니다. BE 명세가 나오면 맞춥니다.
*/
const FIXED_DROPOUT_SCALE: Partial<Record<DropCause, number>> = { input_burden: 0.3 };
const FIXED_DROPOUT_DEFAULT = 0.8;

function outcomeOf(session: PersonaSession): Outcome {
  const path = TASK_PATHS[session.task_id] ?? ["landing", "other"];
  const key = `${session.id}:${session.seed ?? 1}`;
  if (session.task_id === "delivery" || rand(`${key}:tech`) < 0.03) {
    return { status: "agent_failure", stopIndex: 1, cause: null };
  }
  const segment = SEGMENTS.find((item) => item.id === session.segment_id);
  const scale =
    state.run.variant === "fixed"
      ? (FIXED_DROPOUT_SCALE[segment?.dropout.cause ?? "none"] ?? FIXED_DROPOUT_DEFAULT)
      : 1;
  if (segment && rand(`${key}:drop`) < segment.dropout.chance * scale) {
    const index = path.indexOf(segment.dropout.stage);
    return {
      status: "simulated_dropout",
      stopIndex: index > 0 ? index : Math.max(1, Math.floor(path.length / 2)),
      cause: index > 0 ? segment.dropout.cause : "navigation",
    };
  }
  return { status: "success", stopIndex: path.length - 1, cause: null };
}

/* 행동 기록 문장 (Figma P11 행동 로그: 클릭 · 입력 · 스크롤 · 뒤로) */
const ACTIONS: { action: string; describe: (stage: string) => string }[] = [
  { action: "click", describe: (stage) => `‘${stage}’ 화면으로 이동` },
  { action: "scroll", describe: (stage) => `${stage} 화면 아래로` },
  { action: "input", describe: () => "배송지 · 테스트 주소" },
  { action: "back", describe: () => "이전 화면으로" },
];

/* 한 틱(조회 1번)에 기록하는 스텝 수. 세션은 TICKS_PER_SESSION 틱 동안 이만큼씩 진행합니다 */
const STEPS_PER_TICK = 6;
const TOTAL_STEPS = STEPS_PER_TICK * TICKS_PER_SESSION;

/*
  스텝별 좌절 점수 (임계치 대비 비율). 세션 상세(P15·P16) 차트가 흐름을 보이도록
  이탈 세션은 점점 올라 마지막 스텝에서 임계치를 넘고, 그 밖의 세션은 0.6배쯤에서 다시 내려갑니다.
*/
function scoreRatio(dropout: boolean, step: number, jitter: number) {
  const progress = step / TOTAL_STEPS;
  const base = dropout
    ? 0.08 + 0.8 * progress
    : progress <= 0.8
      ? 0.08 + 0.65 * progress
      : 0.6 - 0.5 * (progress - 0.8);
  return base + (jitter - 0.5) * 0.06;
}

function advanceSession(session: PersonaSession, tick: number) {
  const path = TASK_PATHS[session.task_id] ?? ["landing", "other"];
  const result = outcomeOf(session);
  const key = `${session.id}:${session.seed ?? 1}:${tick}`;
  const isLast = tick >= TICKS_PER_SESSION;
  const threshold = session.max_required_fields * 16;
  const willDrop = result.status === "simulated_dropout";
  let score = 0;
  let label = "";

  /* 스텝마다 trace · 행동 · 발화를 하나씩 남깁니다 (step 번호는 세 배열이 같습니다) */
  for (let i = 1; i <= STEPS_PER_TICK; i += 1) {
    const step = session.steps + 1;
    const stepKey = `${key}:${step}`;
    const stage = path[Math.round((result.stopIndex * (step - 1)) / (TOTAL_STEPS - 1))] ?? path[0];
    const dropping = willDrop && isLast && i === STEPS_PER_TICK;
    score = dropping
      ? threshold + 6 + Math.floor(rand(`${stepKey}:score`) * 8)
      : Math.max(1, Math.round(threshold * scoreRatio(willDrop, step, rand(`${stepKey}:jitter`))));
    label = STAGE_LABELS[stage];
    const act = step === 1 ? ACTIONS[0] : pick(ACTIONS, `${stepKey}:act`);

    session.steps = step;
    session.terminal_stage = stage;
    session.url = `/mock/${stage}`;
    session.events.push({ step, action: act.action, description: act.describe(label) });
    session.trace.push({
      step,
      stage,
      score,
      previous_score: session.trace.at(-1)?.score ?? 0,
      threshold,
      required_fields: dropping ? session.max_required_fields + 1 : 1,
      crossed: score > threshold,
      url: session.url,
      artifact_id: null,
    });
    session.utterances = [
      ...(session.utterances ?? []),
      {
        step,
        stage,
        text:
          dropping && result.cause
            ? DROPOUT_UTTERANCE[result.cause]
            : pick(UTTERANCES[stage] ?? ["화면을 살펴보고 있어요."], `${stepKey}:say`),
        at: new Date().toISOString(),
      },
    ];
  }
  session.tokens = (session.tokens ?? 0) + 1100 + Math.floor(rand(`${key}:tok`) * 500);
  session.cost_usd = Math.round(session.tokens * 0.0000025 * 100) / 100;
  session.elapsed_ms = (session.elapsed_ms ?? 0) + 30000 + Math.floor(rand(`${key}:ms`) * 30000);

  if (!isLast) {
    session.reason = `${label} 화면을 살펴보고 있습니다.`;
    return;
  }

  session.status = result.status;
  session.viewer_url = null;
  if (result.status === "simulated_dropout") {
    session.reason = `좌절 점수 ${score}이 초기 가설 임계치 ${threshold}을 초과했습니다.`;
    session.issue = {
      category: result.cause ?? "navigation",
      observed_fields: result.cause === "input_burden" ? session.max_required_fields + 1 : 0,
      configured_limit: session.max_required_fields,
      model_version: "frustration-v2",
    };
  } else if (result.status === "agent_failure") {
    session.reason = "접속 불가 · 응답 시간 초과 3회";
  } else {
    session.reason = `${session.task_name} 과업 완료 화면에 도달했습니다.`;
  }
}

const finished = (session: PersonaSession) =>
  session.status !== "queued" && session.status !== "running";

/*
  끝나면 세션 목록을 첫 시드(대표 시드)로 돌려 둡니다.
  리포트 인원·문제 수, 세션 상세(P15), 사람 관측 대응이 모두 같은 세션을 보게 하려는 것입니다.
*/
function finishRun(run: PersonaRun) {
  const first = state.seedRuns.get(run.id!)?.[0];
  if (first) run.sessions = structuredClone(first);
  run.status = "completed";
  run.stage = "completed";
  state.history.unshift(structuredClone(run));
}

/* 비용 상한(E12): 남은 세션을 한도 도달로 닫고 부분 결과로 끝냅니다 */
function stopForBudget(run: PersonaRun) {
  for (const session of run.sessions) {
    if (finished(session)) continue;
    session.status = "budget_exceeded";
    session.reason = "실행당 비용 상한에 닿아 멈췄습니다.";
    session.viewer_url = null;
  }
  /*
    끝나지 않은 시드는 범위 계산(seedRuns)에 넣지 않습니다. 반쯤 끝난 시드를 넣으면
    도달 인원 하한이 절반쯤으로 떨어져 범위가 틀어집니다. 멈춘 시점 집계에만 씁니다.
  */
  const all = [...state.seedRuns.get(run.id!)!.flat(), ...run.sessions];
  run.stopped = {
    reason: "budget",
    seed: run.seeds?.current ?? 1,
    finished: all.filter((s) => s.status !== "budget_exceeded").length,
    total: run.sessions.length * SEEDS,
    cost_ratio: 1,
    tokens: all.reduce((sum, s) => sum + (s.tokens ?? 0), 0),
  };
  finishRun(run);
}

function advance() {
  const run = state.run;
  if (run.status !== "running") return;

  /* P08 준비: 브라우저를 조회마다 나눠 엽니다 */
  if (run.stage === "preparing" && run.prepare) {
    const { browsers_total: total } = run.prepare;
    run.prepare.browsers_ready = Math.min(
      total,
      run.prepare.browsers_ready + Math.ceil(total / PREPARE_POLLS),
    );
    if (run.prepare.browsers_ready >= total) run.stage = "running";
    return;
  }

  /* P10 분석: 조회마다 한 단계 (세션 종료 → 원인 분류 → 리포트 생성) */
  if (run.stage === "analyzing") {
    const step = run.analysis?.step ?? 1;
    if (step < 3) run.analysis = { step: (step + 1) as 2 | 3 };
    else finishRun(run);
    return;
  }

  for (const session of run.sessions.filter((s) => s.status === "running")) {
    const tick = (state.ticks.get(`${session.id}:${session.seed}`) ?? 0) + 1;
    state.ticks.set(`${session.id}:${session.seed}`, tick);
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

  const seed = run.seeds?.current ?? 1;
  const done = run.sessions.filter(finished).length;
  if (
    !run.stopped &&
    (run.tasks?.length ?? 0) >= BUDGET_TASKS &&
    seed === 2 &&
    done >= run.sessions.length / 2
  ) {
    stopForBudget(run);
    return;
  }

  if (done < run.sessions.length) return;

  const seeds = state.seedRuns.get(run.id!)!;
  seeds.push(structuredClone(run.sessions));
  /* E05: 한 시드의 모든 세션이 기술 실패면 더 돌리지 않고 끝냅니다 */
  if (run.sessions.every((s) => TECHNICAL.includes(s.status))) {
    finishRun(run);
    return;
  }
  if (seed < SEEDS) {
    run.seeds = { current: seed + 1, total: SEEDS };
    run.sessions = seedSessions(run, run.tasks, seed + 1);
    return;
  }
  run.stage = "analyzing";
  run.analysis = { step: 1 };
}

export function snapshot(): PersonaRun {
  advance();
  return structuredClone(state.run);
}

/* 테스트용: 진행 중인 실행을 끝까지 돌립니다 (조회 수 기준 진행을 기다리지 않게) */
export function finishPersonaMock() {
  for (let i = 0; i < 1000 && state.run.status === "running"; i += 1) advance();
  return structuredClone(state.run);
}

/* ─── 목록 · 질문 ─── */

export function reports(): PersonaReportSummary[] {
  return state.history.map((run) => {
    const failed =
      run.sessions.length > 0 && run.sessions.every((s) => TECHNICAL.includes(s.status));
    return {
      run_id: run.id!,
      created_at: run.created_at ?? null,
      variant: run.variant ?? null,
      sessions: run.sessions.length,
      tasks: run.tasks.map((task) => task.name),
      outcome: run.stopped ? "stopped" : failed ? "failed" : "completed",
      completion: failed ? [] : completionOf(run.id!),
    };
  });
}

/*
  제품 API 실행 목록(GET /api/v1/projects/{id}/runs) 흉내. 개발 API 의 같은 실행(history + 현재 실행)으로
  만들어, 다른 화면이 아직 개발 API 를 써도 mock 에서 같은 id 로 이어지게 합니다.
  P01 이 목록만 polling 해도 실행이 진행되도록 조회마다 한 단계 진행합니다 (GET /api/personas 와 같음).
  다음 페이지 요청은 진행하지 않습니다(progress=false). 페이지 수만큼 빨라지지 않게 하려는 것입니다.
  차수(sequence_no)는 오래된 실행이 1차입니다. 리포트·재테스트 화면의 차수 계산과 같습니다.
*/
export function runList({ progress = true }: { progress?: boolean } = {}): RunItem[] {
  if (progress) advance();
  const current = state.run;
  const inProgress =
    current.id && current.status === "running" && !state.history.some((r) => r.id === current.id)
      ? [current]
      : [];
  const runs = [...inProgress, ...state.history];
  return runs.map((run, index) => runItemOf(run, runs.length - index));
}

function runItemOf(run: PersonaRun, sequenceNo: number): RunItem {
  const tasks = run.tasks.map((task) => task.name);
  const name =
    tasks.length === 0
      ? `${sequenceNo}차`
      : `${sequenceNo}차·${tasks[0]}${tasks.length > 1 ? ` 외 ${tasks.length - 1}개` : ""}`;
  const base = {
    id: run.id!,
    sequence_no: sequenceNo,
    name,
    kind: "pretest" as const,
    change_note: "",
    parent_run_id: null,
    created_at: run.created_at ?? new Date().toISOString(),
    started_at: null,
    finished_at: null,
  };

  if (run.status === "running") {
    const status =
      run.stage === "analyzing" ? "finalizing" : run.stage === "preparing" ? "queued" : "running";
    return { ...base, status, report: null };
  }

  const failed = run.sessions.length > 0 && run.sessions.every((s) => TECHNICAL.includes(s.status));
  return {
    ...base,
    status: run.stopped ? "partially_completed" : failed ? "failed" : "completed",
    report: {
      id: `report-${run.id}`,
      status: run.stopped ? "partial" : "final",
      revision: 1,
      goal_rates: goalRatesOf(run.id!, failed),
    },
  };
}

/* 과업별 달성률(0~1): 완료 도달 범위의 가운데 ÷ 첫 단계 인원. 기술 실패만 있으면 null */
function goalRatesOf(runId: string, failed: boolean): RunGoalRate[] {
  return report(runId).tasks.map((task) => {
    const base = task.funnel?.[0]?.reached[1] ?? 0;
    const last = task.funnel?.[task.funnel.length - 1]?.reached;
    const rate =
      failed || !last || base === 0
        ? null
        : Math.round(((last[0] + last[1]) / 2 / base) * 10000) / 10000;
    return { task_id: task.id, name: task.name, achievement_rate: rate };
  });
}

/* 임시 P01 목표 달성률: 과업 퍼널의 완료 도달 범위 ÷ 첫 단계 인원 (기술 실패만 있는 과업은 뺌) */
function completionOf(runId: string): Range[] {
  return report(runId).tasks.flatMap((task) => {
    const funnel = task.funnel;
    const base = funnel?.[0]?.reached[1] ?? 0;
    if (!funnel || base === 0) return [];
    const [low, high] = funnel[funnel.length - 1].reached;
    return [[Math.round((low / base) * 100), Math.round((high / base) * 100)] as Range];
  });
}

const EXPLAIN_KEYS = ["run_id", "session_id", "question", "step"];
const MAX_ANSWERS = 20;

/*
  BE console.py·session_explain.py 와 같은 검증:
  키는 run_id·session_id·question(+ 선택 step), question 은 다듬은 뒤 1~500자, step 은 1 이상 정수,
  답은 세션 answers 에 최근 20개까지 쌓입니다.
  답 문장은 BE 규칙 엔진 대신 세션의 마지막 기록(reason)과 마지막 두 스텝으로 만듭니다.
  임시: BE 는 run_id 가 현재 실행이어야 하지만, 세션 상세(P15d)를 리포트에서 열어도 질문할 수 있게
  mock 은 끝난 실행(history)도 받습니다. 서버 명세가 나오면 맞춥니다.
*/
export function explain(body: unknown): ExplainAnswer {
  const record = (body ?? {}) as Record<string, unknown>;
  const keys = Object.keys(record);
  const question = typeof record.question === "string" ? record.question.trim() : "";
  const step = record.step;
  const run =
    record.run_id === state.run.id
      ? state.run
      : state.history.find((item) => item.id === record.run_id);
  const session = run?.sessions.find((s) => s.id === record.session_id);

  if (
    !keys.every((key) => EXPLAIN_KEYS.includes(key)) ||
    !["run_id", "session_id", "question"].every((key) => keys.includes(key)) ||
    question.length < 1 ||
    question.length > 500 ||
    (step !== undefined && (!Number.isInteger(step) || (step as number) < 1)) ||
    !run ||
    !session
  ) {
    throw new MockApiError(400, "질문할 방문과 내용을 확인해주세요.");
  }

  const finished = session.status !== "queued" && session.status !== "running";
  const recent = session.trace.slice(-2);
  const answer: ExplainAnswer = {
    id: nextId("answer"),
    question,
    answer: finished ? answerText(session) : "아직 실행 중이라 기록이 끝나지 않았습니다.",
    kind: finished ? "recorded_outcome" : "execution_status",
    supported_by_record: finished,
    sources: finished
      ? recent.map((point) => ({
          step: point.step,
          stage: point.stage,
          stage_name: STAGE_LABELS[point.stage],
          artifact_id: point.artifact_id,
        }))
      : [],
    recorded_at: new Date().toISOString(),
    method: "record_based_rules",
    model_calls: 0,
  };

  session.answers = [...(session.answers ?? []), answer].slice(-MAX_ANSWERS);
  /* 현재 실행이면 목록(history)에도 맞추고, 과거 실행이면 history 의 세션을 바로 고쳤습니다 */
  if (run === state.run) syncHistory();

  return structuredClone(answer);
}

/* 마지막 두 스텝의 점수 변화로 답 문장을 만듭니다 (예: 스텝 11에서 74, 스텝 12에서 임계치 70 초과) */
function answerText(session: PersonaSession) {
  const [before, last] =
    session.trace.length > 1 ? session.trace.slice(-2) : [null, session.trace[0]];
  if (!last) return session.reason;
  const lead = before
    ? `스텝 ${before.step}(${STAGE_LABELS[before.stage]})에서 좌절 점수가 ${before.score}였고, `
    : "";
  if (session.status === "simulated_dropout") {
    return `${lead}스텝 ${last.step}에서 ${last.score}로 올라 임계치 ${last.threshold}을 넘어 멈췄어요.`;
  }
  return `${lead}${session.reason}`;
}

/*
  임시: 세션 상세(P15·P16) 조회. BE 명세에는 아직 세션 단건 조회가 없어 mock 에만 둡니다.
  끝난 실행(history, 대표 시드 1)만 줍니다. 진행 중에는 같은 세션 id 의 내용이 시드마다 바뀌어 404 로 둡니다.
*/
export function session(runId: string | null, sessionId: string | null): PersonaSession {
  const run = state.history.find((item) => item.id === runId);
  const found = run?.sessions.find((item) => item.id === sessionId);
  if (!found) throw new MockApiError(404, "방문을 찾을 수 없습니다.");
  return structuredClone(found);
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

/* 시드마다의 [n, n] 을 [최소, 최대] 범위로 합칩니다 */
function spread(values: Range[]): Range {
  return [Math.min(...values.map((v) => v[0])), Math.max(...values.map((v) => v[1]))];
}

/*
  과업 리포트 — 시드 3회 결과를 합쳐 예측을 범위로 만듭니다.
  인원·문제 수는 첫 시드 기준, 퍼널·세그먼트·소요 시간은 시드별 값의 [최소, 최대] 입니다.
*/
function buildTask(run: PersonaRun, taskId: string, seeds: PersonaSession[][]): ReportTask {
  const perSeed = seeds.map((sessions) => sessions.filter((s) => s.task_id === taskId));
  const sessions = perSeed[0] ?? [];
  const countedOf = (list: PersonaSession[]) => list.filter((s) => !TECHNICAL.includes(s.status));
  /* 경로를 모르는 과업은 퍼널을 비워 두지 않고 아예 빼서 화면이 퍼널을 숨기게 합니다 */
  const path = TASK_PATHS[taskId];
  const task = run.tasks.find((t) => t.id === taskId) ?? TASKS.find((t) => t.id === taskId);
  const funnel = path
    ? combineFunnels(perSeed.map((list) => buildFunnel(countedOf(list), path)))
    : undefined;

  return {
    id: taskId,
    name: task?.name ?? sessions[0]?.task_name ?? taskId,
    total: sessions.length,
    success: sessions.filter((s) => s.status === "success").length,
    dropout: sessions.filter((s) => s.status === "simulated_dropout").length,
    technical: sessions.length - countedOf(sessions).length,
    funnel,
    median_duration: medianDuration(perSeed.map(countedOf)),
    segments: path
      ? combineSegments(perSeed.map((list) => buildSegments(countedOf(list), path)))
      : undefined,
    actual: funnel ? mockActual(funnel) : undefined,
  };
}

function combineFunnels(funnels: ReportFunnelStage[][]): ReportFunnelStage[] {
  return funnels[0].map((stage, index) => ({
    stage: stage.stage,
    reached: spread(funnels.map((funnel) => funnel[index].reached)),
    dropout: spread(funnels.map((funnel) => funnel[index].dropout)),
  }));
}

function combineSegments(lists: ReportSegment[][]): ReportSegment[] {
  return lists[0].map((segment) => ({
    ...segment,
    dropouts: segment.dropouts.map((_, index) =>
      spread(
        lists.flatMap((list) =>
          list.filter((item) => item.id === segment.id).map((item) => item.dropouts[index]),
        ),
      ),
    ),
  }));
}

/* 완료 세션 소요 시간(초)의 시드별 중앙값을 범위로. 완료 세션이 없으면 없음 */
function medianDuration(perSeed: PersonaSession[][]): Range | undefined {
  const medians = perSeed.flatMap((list) => {
    const seconds = list
      .filter((s) => s.status === "success")
      .map((s) => Math.round((s.elapsed_ms ?? 0) / 1000))
      .sort((a, b) => a - b);
    return seconds.length > 0 ? [seconds[Math.floor(seconds.length / 2)]] : [];
  });
  return medians.length > 0 ? [Math.min(...medians), Math.max(...medians)] : undefined;
}

/* 세그먼트별로 퍼널 구간마다 몇 명이 떠났는지 — 퍼널과 같은 규칙(passedIndex)으로 셉니다 */
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
        recommendation: text?.recommendation ?? "방문 기록을 직접 확인해 보세요.",
        mockup: null,
      };
    })
    .sort((a, b) => b.affected_sessions - a.affected_sessions);
}

export function report(runId: string | null): PersonaReport {
  const found = findRun(runId);
  /* 시드마다 끝난 세션 (없으면 지금 세션 하나). 문제·인원은 첫 시드 기준 */
  const seeds = state.seedRuns.get(found.id!) ?? [found.sessions];
  const run = { ...found, sessions: seeds[0] ?? found.sessions };
  const findings = buildFindings(run);
  const evidence = findings.flatMap((finding) => finding.evidence);
  const count = (status: SessionStatus[]) =>
    run.sessions.filter((s) => status.includes(s.status)).length;
  const tasks = [...new Set(run.sessions.map((s) => s.task_id))].map((id) =>
    buildTask(run, id, seeds),
  );
  const latestCalibration = CALIBRATIONS["1"]?.[0]?.applied_at ?? null;

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
        persona_name: s.code ?? s.name,
        task_name: s.task_name,
        status: s.status,
        reason: s.reason,
      })),
    alignment: buildAlignment(found, found.human_observations ?? []),
    limitations: [
      "모의 실행(mock) 결과입니다. 실제 사용자 이탈률이 아닙니다.",
      "연령은 설명 문맥으로만 쓰고 행동 예측을 맞추는 것은 검증 전입니다.",
      ...(found.stopped
        ? [`비용 상한으로 반복 ${found.stopped.seed} / ${SEEDS}에서 멈춘 부분 결과예요.`]
        : []),
    ],
    /* 보정은 프로젝트 보정 이력 mock 의 최근 적용일 (개발 API 에는 프로젝트가 없어 반찬로드 기준) */
    conditions: {
      panel_size:
        (found.panel ?? []).reduce((sum, segment) => sum + segment.count, 0) ||
        Math.max(0, ...tasks.map((task) => task.total)),
      seeds: seeds.length,
      calibrated_at: latestCalibration,
    },
  });
}

export function reportMarkdown(runId: string | null): string {
  const data = report(runId);
  const lines = [
    `# 사전 테스트 리포트 (${data.run_id})`,
    "",
    `- 방문 ${data.summary.sessions}개 · 완료 ${data.summary.success} · 가상 이탈 ${data.summary.simulated_dropout} · 기술 실패 ${data.summary.technical}`,
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
  if (!session) throw new MockApiError(400, "비교할 방문을 찾을 수 없습니다.");
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
    throw new MockApiError(400, "이 참여자의 같은 과업 관측이 다른 방문에 이미 있습니다.");
  }

  const observations = [...existing.filter((o) => !sameTask.includes(o)), observation];
  run.human_observations = observations;
  run.alignment = buildAlignment(run, observations);
  syncHistory();

  return structuredClone(run);
}

/*
  제품 API 리포트(report-2) mock 의 재료: 끝난 실행과 시드별 세션, 과업 경로.
  진행 중이면 409, 없으면 404 (MockApiError). mocks/reportV1Mock.ts 가 report-2 로 집계합니다.
*/
export function reportSource(runId: string) {
  const run = findRun(runId);
  const seeds = state.seedRuns.get(run.id!) ?? [];
  return {
    run,
    seeds: seeds.length > 0 ? seeds : [run.sessions],
    paths: TASK_PATHS,
    technical: TECHNICAL,
  };
}

/* 제품 API 실행 mock(mocks/runV1Mock.ts)의 재료: 현재 실행 또는 끝난 실행 (없으면 undefined) */
export function findMockRun(runId: string): PersonaRun | undefined {
  if (state.run.id === runId) return structuredClone(state.run);
  const saved = state.history.find((run) => run.id === runId);
  return saved ? structuredClone(saved) : undefined;
}
