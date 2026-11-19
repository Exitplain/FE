import type {
  AgeKey,
  Discovery,
  DiscoveryProgressEvent,
  Plan,
  PlanBlocking,
  SegmentProfile,
  PlanSnapshot,
  RevisionPersonas,
  SnapshotPersona,
  SnapshotSegment,
  TestAccounts,
} from "@/types/plan.type";
import type { AgeOption } from "@/types/persona.type";

import { SEGMENTS } from "./fixtures/personas";
import { confirm, discover, generatePanel, MockApiError } from "./personaMock";

/*
  제품 API 새 테스트 위저드 mock (P02~P07 + 실행 시작). BE backend/discoveries·plans·personas·testaccounts·runs 규칙.
  - 탐색 결과·과업은 개발 API mock(personaMock.discover)의 값을 씁니다
  - 실행 시작(POST /api/v1/runs)은 개발 API mock 실행(personaMock.confirm)을 만들어,
    아직 개발 API 를 쓰는 실행 화면(P08~P11)·리포트 mock 이 같은 실행 id(mock-run-N)로 이어지게 합니다.
    실행 화면을 제품 API 로 옮기면 이 연결을 지웁니다.
  오류는 MockPlanError(status, code, message, fields) 로 던지고 핸들러가 제품 API 오류 형태로 바꿉니다.
*/

export class MockPlanError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: Record<string, unknown>;

  constructor(status: number, code: string, message: string, fields: Record<string, unknown> = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

const TTL_MS = 15 * 60 * 1000;
/* BE plans.catalog — 로그인 없이 기본 10명(4~20명 선택), 테스트 계정이면 계정 수 */
const PERSONA_TOTAL = 10;
const PERSONA_MIN = 4;
const PERSONA_MAX = 20;
const ACCOUNT_MIN = 4;
/* 테스트 계정 보관 기간 (BE TEST_ACCOUNT_RETENTION_DAYS) */
const RETENTION_DAYS = 90;
const SEED_RANGE = { min: 1, max: 3 };
const SEGMENT_IDS = ["segment_1", "segment_2", "segment_3", "segment_4"];
const AGES: Record<AgeKey, string> = {
  any: "전체",
  "20s": "20대",
  "30s": "30대",
  "40s": "40대",
  "50plus": "50대 이상",
};
const FUNNEL = [
  ["landing", "랜딩"],
  ["browse", "탐색"],
  ["detail", "상세"],
  ["cart", "장바구니"],
  ["signup", "가입"],
  ["payment", "결제 정보"],
  ["complete", "완료"],
].map(([key, name], order) => ({ id: `stage_${key}`, name, order }));

type StoredDiscovery = Discovery & { devPlanId: string; personaTotal: number };
type StoredSnapshot = PlanSnapshot & { personas: RevisionPersonas; plan: Plan };

const state = {
  sequence: 0,
  checks: 0,
  discoveries: new Map<string, StoredDiscovery>(),
  plans: new Map<string, Plan>(),
  snapshots: new Map<string, StoredSnapshot>(),
  accounts: new Map<number, TestAccounts>(),
  runKeys: new Map<string, string>(),
  /* 비동기 탐색: 탐색 id → 지금까지 보여 준 진행 사건 수 */
  discoveryPolls: new Map<string, number>(),
};

export function resetPlanMock() {
  state.sequence = 0;
  state.checks = 0;
  state.discoveries.clear();
  state.discoveryPolls.clear();
  state.plans.clear();
  state.snapshots.clear();
  state.accounts.clear();
  state.runKeys.clear();
}

const nextId = (prefix: string) => `${prefix}-${++state.sequence}`;

export function checkSite(projectId: number) {
  state.checks += 1;
  return {
    project_id: projectId,
    check: {
      status: "ok" as const,
      http_status: 200,
      elapsed_ms: 800,
      checked_at: new Date().toISOString(),
      reason: null,
      message: null,
    },
  };
}

/* 비동기 탐색 mock 의 진행 사건 (BE agent/explore.py 문구 모양). 브라우저 mock 은 조회마다 한 줄씩 늘립니다 */
const DISCOVERY_SCRIPT: Omit<DiscoveryProgressEvent, "seq" | "t">[] = [
  { kind: "browser_started", message: "브라우저를 열었어요" },
  { kind: "page_opening", message: "/ 화면을 여는 중이에요 (1/10)", path: "/" },
  {
    kind: "page_read",
    message: "'오늘 저녁은, 가볍게' 화면을 읽었어요 · 같은 사이트 링크 6개, 새로 볼 화면 4개",
    path: "/",
  },
  {
    kind: "button_moved",
    message: "'이번 주 식탁 만나기' 버튼을 눌러 보니 /product 화면으로 가요",
    path: "/product",
  },
  {
    kind: "page_read",
    message: "'이번 주 식탁' 화면을 읽었어요 · 같은 사이트 링크 5개",
    path: "/product",
  },
  {
    kind: "write_blocked",
    message: "POST /api/cart 요청은 저장·결제가 일어날 수 있어 막았어요",
    path: "/api/cart",
  },
  {
    kind: "page_read",
    message: "'장바구니' 화면을 읽었어요 · 같은 사이트 링크 3개",
    path: "/cart",
  },
  {
    kind: "crawl_finished",
    message: "화면 4개를 둘러봤어요 · 쓰기 요청 1건, 다른 사이트 요청 0건을 막았어요",
  },
  { kind: "proposing", message: "둘러본 화면으로 기능과 과업 후보를 정리하는 중이에요" },
];
/* 테스트는 첫 조회에 끝냅니다 */
const SCRIPT_STEP = import.meta.env.MODE === "test" ? DISCOVERY_SCRIPT.length : 1;

function publicDiscovery(stored: StoredDiscovery): Discovery {
  const response: Partial<StoredDiscovery> = structuredClone(stored);
  delete response.devPlanId;
  delete response.personaTotal;
  return response as Discovery;
}

function progressOf(shown: number, done: boolean): DiscoveryProgressEvent[] {
  const lines = [
    { kind: "queued", message: "사이트 확인을 시작했어요" },
    ...DISCOVERY_SCRIPT.slice(0, shown),
    ...(done ? [{ kind: "succeeded", message: "사이트 확인을 마쳤어요" }] : []),
  ];
  return lines.map((line, index) => ({ ...line, seq: index + 1, t: index }));
}

/* POST …/discoveries + Prefer: respond-async — 검사는 동기와 같고, 결과 없이 running 으로 202 */
export function startDiscovery(projectId: number, body: Record<string, unknown>): Discovery {
  const done = createDiscovery(projectId, body);
  state.discoveryPolls.set(done.id, 0);
  return {
    ...done,
    status: "running",
    features: [],
    tasks: [],
    note: "",
    progress: progressOf(0, false),
  };
}

/* GET /api/v1/discoveries/{id} — 조회마다 사건이 늘고, 다 보이면 끝난 결과 */
export function getDiscovery(discoveryId: string): Discovery {
  const stored = state.discoveries.get(discoveryId);
  if (!stored) throw new MockPlanError(404, "NOT_FOUND", "탐색 결과를 찾을 수 없습니다.");
  const shown = Math.min(
    DISCOVERY_SCRIPT.length,
    (state.discoveryPolls.get(discoveryId) ?? DISCOVERY_SCRIPT.length) + SCRIPT_STEP,
  );
  state.discoveryPolls.set(discoveryId, shown);
  const done = shown >= DISCOVERY_SCRIPT.length;
  const discovery = publicDiscovery(stored);
  return done
    ? { ...discovery, status: "succeeded", progress: progressOf(shown, true) }
    : {
        ...discovery,
        status: "running",
        features: [],
        tasks: [],
        note: "",
        progress: progressOf(shown, false),
      };
}

export function createDiscovery(projectId: number, body: Record<string, unknown>): Discovery {
  const allowed = ["entry_url", "login_mode", "variant", "source_snapshot_id"];
  if (Object.keys(body).some((key) => !allowed.includes(key))) {
    throw new MockPlanError(422, "VALIDATION_ERROR", "허용하지 않는 필드입니다.");
  }
  const entryUrl =
    typeof body.entry_url === "string" ? body.entry_url : "https://banchanroad.example/";
  try {
    if (!/^https?:$/.test(new URL(entryUrl).protocol)) throw new Error("protocol");
  } catch {
    throw new MockPlanError(
      422,
      "VALIDATION_ERROR",
      "http(s)로 시작하는 올바른 URL을 입력해주세요.",
      {
        entry_url: ["올바른 URL이 아닙니다."],
      },
    );
  }
  const loginMode = body.login_mode === "test_account" ? "test_account" : "none";
  const variant = body.variant === "fixed" ? "fixed" : "problem";
  const accounts = state.accounts.get(projectId)?.count ?? 0;
  if (loginMode === "test_account" && accounts < ACCOUNT_MIN) {
    throw new MockPlanError(
      409,
      "TEST_ACCOUNTS_REQUIRED",
      `테스트 계정을 ${ACCOUNT_MIN}개 이상 등록해주세요 · 지금 ${accounts}개`,
      { accounts: [`지금 ${accounts}개`] },
    );
  }
  const dev = discover({ variant });
  const now = Date.now();
  const discovery: StoredDiscovery = {
    id: nextId("discovery"),
    project_id: projectId,
    entry_url: entryUrl,
    login_mode: loginMode,
    variant,
    features: dev.features,
    /* 개발 mock 의 퍼널 단계 수는 서버 탐색 응답에 없습니다 (계획의 task_funnels 에 있음) */
    tasks: dev.tasks.map((task) => {
      const copy = { ...task };
      delete copy.funnel_stages;
      return copy;
    }),
    note: dev.note,
    elapsed_seconds: 1.2,
    created_at: new Date(now).toISOString(),
    expires_at: new Date(now + TTL_MS).toISOString(),
    expired: false,
    devPlanId: dev.plan_id,
    personaTotal: loginMode === "test_account" ? accounts : PERSONA_TOTAL,
  };
  state.discoveries.set(discovery.id, discovery);
  const response: Partial<StoredDiscovery> = structuredClone(discovery);
  delete response.devPlanId;
  delete response.personaTotal;
  return response as Discovery;
}

/* 확정할 수 있는 인원 (BE plans.services.persona_range) */
function personaRange(plan: Plan) {
  const { persona_total, persona_min, persona_max } = plan.options.capabilities;
  return { low: persona_min ?? persona_total, high: persona_max ?? persona_total };
}

/* 인원을 세그먼트에 고르게 나눕니다 (BE plans.services 기본값 — 10명이면 3·3·2·2) */
function evenSplit(total: number) {
  return SEGMENT_IDS.map((id, index) => ({
    id,
    count: Math.floor(total / 4) + (index < total % 4 ? 1 : 0),
  }));
}

function review(plan: Plan, discovery: StoredDiscovery): Plan["review"] {
  const blocking: PlanBlocking[] = [];
  if (Date.parse(discovery.expires_at) <= Date.now()) {
    blocking.push({
      step: 1,
      code: "DISCOVERY_EXPIRED",
      message: "사이트 확인 결과가 만료됐습니다.",
    });
  }
  if (plan.task_ids.length === 0) {
    blocking.push({ step: 2, code: "NO_TASKS", message: "과업을 한 개 이상 골라주세요." });
  }
  if (!plan.audience.context.trim()) {
    blocking.push({ step: 2, code: "NO_AUDIENCE", message: "타겟 고객 설명을 입력해주세요." });
  }
  const total = plan.segments.reduce((sum, segment) => sum + segment.count, 0);
  const range = personaRange(plan);
  if (total < range.low || total > range.high) {
    blocking.push({ step: 3, code: "SEGMENT_TOTAL", message: "세그먼트 합계가 맞지 않습니다." });
  }
  const names = plan.options.tasks
    .filter((task) => plan.task_ids.includes(task.id))
    .map((task) => task.name);
  return {
    site: { entry_url: discovery.entry_url, login_mode: discovery.login_mode, edit_step: 1 },
    /* mock 서버는 직접 추가한 과업을 실행에 넣지 않습니다 (BE 기본값과 같음) */
    tasks: { names, custom_names: [], edit_step: 2 },
    audience: {
      context: plan.audience.context,
      age_labels: plan.audience.ages.map((age) => AGES[age]),
      edit_step: 2,
    },
    not_in_run: {
      custom_tasks: plan.custom_tasks.map((task) => task.text),
      additional_request: plan.additional_request,
    },
    funnels: {
      auto: true,
      stages_per_task: Object.fromEntries(plan.task_ids.map((id) => [id, FUNNEL.length])),
    },
    personas: { segments: SEGMENT_IDS.length, total, edit_step: 3 },
    limits: plan.limits,
    total_sessions: total * plan.task_ids.length * plan.limits.seed_count,
    blocking,
  };
}

function discoveryOf(plan: Plan) {
  return state.discoveries.get(plan.discovery_id)!;
}

export function createPlan(projectId: number, body: Record<string, unknown>): Plan {
  const discovery =
    typeof body.discovery_id === "string" ? state.discoveries.get(body.discovery_id) : undefined;
  if (!discovery || discovery.project_id !== projectId) {
    throw new MockPlanError(422, "VALIDATION_ERROR", "이 프로젝트의 탐색 결과가 아닙니다.", {
      discovery_id: ["이 프로젝트의 탐색 결과가 아닙니다."],
    });
  }
  if (Date.parse(discovery.expires_at) <= Date.now()) {
    throw new MockPlanError(
      409,
      "DISCOVERY_EXPIRED",
      "사이트 확인 결과가 만료됐습니다. 1단계에서 다시 확인해주세요.",
    );
  }
  const now = new Date().toISOString();
  const plan: Plan = {
    id: nextId("plan"),
    project_id: projectId,
    discovery_id: discovery.id,
    revision: 1,
    options: {
      features: discovery.features,
      tasks: discovery.tasks,
      capabilities: {
        ages: AGES,
        segment_ids: SEGMENT_IDS,
        persona_total: discovery.personaTotal,
        persona_min: discovery.login_mode === "test_account" ? discovery.personaTotal : PERSONA_MIN,
        persona_max: discovery.login_mode === "test_account" ? discovery.personaTotal : PERSONA_MAX,
        limits: {
          viewport_width: { min: 320, max: 1920 },
          concurrency: { min: 1, max: 5 },
          seed_count: SEED_RANGE,
        },
        custom_task_limit: 5,
      },
    },
    task_ids: discovery.tasks.filter((task) => task.suggested).map((task) => task.id),
    custom_tasks: [],
    additional_request: "",
    audience: { context: "", ages: [] },
    task_funnels: discovery.tasks.map((task) => ({ task_id: task.id, auto: true, stages: FUNNEL })),
    segments: evenSplit(discovery.personaTotal),
    segment_profiles: emptyProfiles(evenSplit(discovery.personaTotal)),
    segment_generator: null,
    limits: {
      viewport_width: 1280,
      concurrency: 5,
      request_interval_seconds: 1,
      seed_count: 1,
      max_steps: 40,
      timeout_seconds: 300,
      cost_cap: null,
    },
    review: undefined as unknown as Plan["review"],
    snapshots: [],
    created_at: now,
    updated_at: now,
  };
  plan.review = review(plan, discovery);
  state.plans.set(plan.id, plan);
  return structuredClone(plan);
}

function emptyProfiles(segments: Plan["segments"]): SegmentProfile[] {
  return segments.map((segment) => ({
    ...segment,
    name: null,
    situation: null,
    age_group: null,
    variables: null,
    basis: null,
    avatar: null,
  }));
}

/* 서버 segment-inferences 와 같은 모양: fixture 세그먼트 이름·상황·능력치를 붙입니다 */
export function inferSegments(planId: string, body: Record<string, unknown>): Plan {
  const plan = state.plans.get(planId);
  if (!plan) throw new MockPlanError(404, "NOT_FOUND", "계획을 찾을 수 없습니다.");
  if (body.revision !== plan.revision) throw conflict();
  if (!plan.audience.context.trim()) {
    throw invalid("audience.context", "타겟 고객 설명을 먼저 적어 주세요.");
  }
  const next = structuredClone(plan);
  next.segment_profiles = plan.segments.map((segment, index) => {
    const fixture = SEGMENTS[index];
    return {
      ...segment,
      name: fixture.name,
      situation: fixture.context,
      age_group: null,
      variables: {
        patience: fixture.traits.patience,
        digital_literacy: fixture.traits.digital,
        price_sensitivity: fixture.traits.price,
        trust_need: fixture.traits.trust,
      },
      basis: [],
      avatar: null,
    };
  });
  next.segment_generator = "fixture-figma-p07";
  next.revision = plan.revision + 1;
  next.updated_at = new Date().toISOString();
  state.plans.set(planId, next);
  return structuredClone(next);
}

export function getPlan(planId: string): Plan {
  const plan = state.plans.get(planId);
  if (!plan) throw new MockPlanError(404, "NOT_FOUND", "계획을 찾을 수 없습니다.");
  return structuredClone(plan);
}

function parseRevision(ifMatch: string | null) {
  if (ifMatch == null) {
    throw new MockPlanError(
      428,
      "PRECONDITION_REQUIRED",
      "If-Match 헤더에 현재 revision을 넣어주세요.",
    );
  }
  const match = /^(?:W\/)?"?(\d+)"?$/.exec(ifMatch.trim());
  if (!match)
    throw new MockPlanError(400, "INVALID_IF_MATCH", "If-Match 값은 revision 숫자여야 합니다.");
  return Number(match[1]);
}

const conflict = () =>
  new MockPlanError(
    409,
    "REVISION_CONFLICT",
    "다른 곳에서 계획이 바뀌었습니다. 최신 내용을 다시 불러와주세요.",
  );

const invalid = (field: string, message: string, fieldMessage = message) =>
  new MockPlanError(422, "VALIDATION_ERROR", message, { [field]: [fieldMessage] });

export function patchPlan(
  planId: string,
  ifMatch: string | null,
  body: Record<string, unknown>,
): Plan {
  const plan = state.plans.get(planId);
  if (!plan) throw new MockPlanError(404, "NOT_FOUND", "계획을 찾을 수 없습니다.");
  if (parseRevision(ifMatch) !== plan.revision) throw conflict();
  const allowed = [
    "task_ids",
    "custom_tasks",
    "additional_request",
    "audience",
    "segments",
    "limits",
  ];
  const keys = Object.keys(body);
  if (keys.length === 0) throw invalid("non_field_errors", "바꿀 필드를 한 개 이상 보내주세요.");
  if (keys.some((key) => !allowed.includes(key)))
    throw invalid(keys[0], "허용하지 않는 필드입니다.");

  const next = structuredClone(plan);
  if ("task_ids" in body) {
    const ids = body.task_ids as string[];
    if (!Array.isArray(ids) || ids.length === 0)
      throw invalid("task_ids", "과업을 한 개 이상 골라주세요.");
    const unknown = ids.filter((id) => !plan.options.tasks.some((task) => task.id === id));
    if (unknown.length)
      throw invalid("task_ids", `선택할 수 없는 과업입니다: ${unknown.join(", ")}`);
    next.task_ids = ids;
  }
  if ("custom_tasks" in body) {
    const texts = body.custom_tasks as string[];
    if (texts.length > 5)
      throw invalid("custom_tasks", "Ensure this field has no more than 5 elements.");
    next.custom_tasks = texts.map((text, index) => ({
      id: `custom_${index + 1}`,
      text,
      state: "draft",
    }));
  }
  if ("additional_request" in body) next.additional_request = String(body.additional_request);
  if ("audience" in body) {
    const audience = body.audience as { context?: string; ages?: AgeKey[] };
    if (!audience.context?.trim()) {
      throw invalid("audience.context", "타겟 고객 설명을 입력해주세요.");
    }
    const ages = audience.ages ?? [];
    if (ages.includes("any") && ages.length > 1) {
      throw invalid("audience.ages", "전체와 특정 연령대를 함께 선택할 수 없습니다.");
    }
    const changed =
      audience.context !== plan.audience.context ||
      JSON.stringify(ages) !== JSON.stringify(plan.audience.ages);
    next.audience = { context: audience.context, ages };
    if (changed) {
      next.segment_profiles = emptyProfiles(next.segments);
      next.segment_generator = null;
    }
  }
  if ("segments" in body) {
    const segments = body.segments as { id: string; count: number }[];
    if (
      segments.length !== 4 ||
      segments.some((segment, index) => segment.id !== SEGMENT_IDS[index])
    ) {
      throw invalid("segments", "세그먼트 4개를 순서대로 보내주세요.");
    }
    const low = segments.findIndex((segment) => segment.count < 1);
    if (low >= 0) throw invalid(`segments.${low}.count`, "세그먼트마다 1명 이상 넣어주세요.");
    const total = segments.reduce((sum, segment) => sum + segment.count, 0);
    const range = personaRange(plan);
    if (total < range.low || total > range.high) {
      throw invalid(
        "segments",
        range.low === range.high
          ? `합계가 ${range.low}명이 되도록 맞춰주세요 · 지금 ${total}명`
          : `합계를 ${range.low}~${range.high}명 사이로 맞춰주세요 · 지금 ${total}명`,
        `지금 ${total}명`,
      );
    }
    next.segments = segments;
    next.segment_profiles = (next.segment_profiles ?? emptyProfiles(segments)).map(
      (profile, index) => ({ ...profile, count: segments[index].count }),
    );
  }
  if ("limits" in body) {
    const limits = body.limits as Partial<Plan["limits"]>;
    const seed = limits.seed_count;
    /* BE LimitsSerializer: 정수만, catalog.LIMIT_RANGES 범위 */
    if (
      seed !== undefined &&
      !(Number.isInteger(seed) && seed >= SEED_RANGE.min && seed <= SEED_RANGE.max)
    ) {
      throw invalid(
        "limits.seed_count",
        `${SEED_RANGE.min}~${SEED_RANGE.max} 사이 값을 입력해주세요.`,
      );
    }
    next.limits = { ...plan.limits, ...limits };
  }
  next.revision = plan.revision + 1;
  next.updated_at = new Date().toISOString();
  next.review = review(next, discoveryOf(next));
  state.plans.set(planId, next);
  return structuredClone(next);
}

export function confirmPlan(planId: string, body: Record<string, unknown>): PlanSnapshot {
  const plan = state.plans.get(planId);
  if (!plan) throw new MockPlanError(404, "NOT_FOUND", "계획을 찾을 수 없습니다.");
  if (body.revision !== plan.revision) throw conflict();
  const existing = [...state.snapshots.values()].find(
    (snapshot) => snapshot.plan_id === planId && snapshot.plan_revision === plan.revision,
  );
  if (existing) {
    throw new MockPlanError(409, "ALREADY_CONFIRMED", "이 revision은 이미 확정했습니다.", {
      plan_revision_id: [existing.plan_revision_id],
    });
  }
  const current = review(plan, discoveryOf(plan));
  if (current.blocking.length > 0) {
    const [first] = current.blocking;
    throw new MockPlanError(409, first.code, first.message, {
      blocking: current.blocking.map((item) => item.code),
    });
  }

  let code = 0;
  const segments: SnapshotSegment[] = plan.segments.map((segment, index) => {
    const fixture = SEGMENTS[index];
    return {
      id: segment.id,
      name: fixture.name,
      count: segment.count,
      variables: {
        patience: fixture.traits.patience,
        digital_literacy: fixture.traits.digital,
        price_sensitivity: fixture.traits.price,
        trust_need: fixture.traits.trust,
      },
      basis: [],
      representative: `P-${String(code + 1).padStart(3, "0")}`,
    };
  });
  const items: SnapshotPersona[] = segments.flatMap((segment) =>
    Array.from({ length: segment.count }, (_, index) => {
      code += 1;
      return {
        persona_snapshot_id: `persona-${code}`,
        code: `P-${String(code).padStart(3, "0")}`,
        segment_id: segment.id,
        segment_name: segment.name,
        is_representative: index === 0,
        variables: segment.variables,
        context: `${segment.name} · 타겟: ${plan.audience.context}`,
      };
    }),
  );
  /* 대표는 세그먼트의 첫 페르소나 */
  segments.forEach((segment) => {
    segment.representative = items.find((item) => item.segment_id === segment.id)?.code ?? "";
  });

  const snapshot: StoredSnapshot = {
    plan_revision_id: nextId("plan-revision"),
    plan_id: planId,
    plan_revision: plan.revision,
    confirmed_at: new Date().toISOString(),
    persona_generator: "rules-v1",
    personas: {
      segments,
      items,
      generator: "rules-v1",
      total_sessions: current.total_sessions,
    },
    plan: structuredClone(plan),
  };
  state.snapshots.set(snapshot.plan_revision_id, snapshot);
  plan.snapshots.unshift({
    plan_revision_id: snapshot.plan_revision_id,
    plan_revision: plan.revision,
    confirmed_at: snapshot.confirmed_at,
  });
  return {
    plan_revision_id: snapshot.plan_revision_id,
    plan_id: snapshot.plan_id,
    plan_revision: snapshot.plan_revision,
    confirmed_at: snapshot.confirmed_at,
    persona_generator: snapshot.persona_generator,
  };
}

export function revisionPersonas(planRevisionId: string): RevisionPersonas {
  const snapshot = state.snapshots.get(planRevisionId);
  if (!snapshot) throw new MockPlanError(404, "NOT_FOUND", "확정된 계획을 찾을 수 없습니다.");
  return structuredClone(snapshot.personas);
}

export function getTestAccounts(projectId: number): TestAccounts {
  return structuredClone(
    state.accounts.get(projectId) ?? {
      project_id: projectId,
      login_url: "",
      count: 0,
      min: ACCOUNT_MIN,
      max: 20,
      ready: false,
      retention_days: RETENTION_DAYS,
      items: [],
    },
  );
}

export function putTestAccounts(projectId: number, body: Record<string, unknown>): TestAccounts {
  const accounts = (body.accounts ?? []) as { id?: string; username: string; password?: string }[];
  if (accounts.length > 20)
    throw invalid("accounts", "테스트 계정은 최대 20개까지 넣을 수 있어요.");
  const previous = state.accounts.get(projectId)?.items ?? [];
  const missing = accounts.findIndex(
    (account) => !account.password && !previous.some((item) => item.id === account.id),
  );
  if (missing >= 0) throw invalid(`accounts.${missing}.password`, "비밀번호를 입력해주세요.");
  const saved: TestAccounts = {
    project_id: projectId,
    login_url: typeof body.login_url === "string" ? body.login_url : "",
    count: accounts.length,
    min: ACCOUNT_MIN,
    max: 20,
    ready: accounts.length >= ACCOUNT_MIN,
    retention_days: RETENTION_DAYS,
    items: accounts.map((account, index) => ({
      id: account.id ?? nextId("account"),
      position: index + 1,
      username: account.username,
      has_password: true,
      status: "unchecked",
      status_message: "",
      checked_at: null,
      last_used_at: null,
      /* 마지막으로 바뀐 뒤 보관 기간이 지나면 자동 삭제 */
      expires_at: new Date(Date.now() + RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    })),
  };
  state.accounts.set(projectId, saved);
  return structuredClone(saved);
}

/* 서버 연령 → 개발 API mock 연령 ("50대 이상" = 50s + 60plus) */
function devAges(ages: AgeKey[]): AgeOption[] {
  if (ages.length === 0 || ages.includes("any")) return ["any"];
  return ages.flatMap((age): AgeOption[] => (age === "50plus" ? ["50s", "60plus"] : [age]));
}

/*
  POST /api/v1/runs — 확정본으로 개발 API mock 실행을 만듭니다.
  같은 Idempotency-Key 면 앞서 만든 실행을 돌려줍니다. 진행 중인 실행이 있으면 409 RUN_IN_PROGRESS.
*/
export function createRun(body: Record<string, unknown>, idempotencyKey: string | null) {
  const snapshot =
    typeof body.plan_revision_id === "string"
      ? state.snapshots.get(body.plan_revision_id)
      : undefined;
  if (!snapshot) throw new MockPlanError(404, "NOT_FOUND", "확정된 계획을 찾을 수 없습니다.");
  if (idempotencyKey && state.runKeys.has(idempotencyKey)) {
    return { run_id: state.runKeys.get(idempotencyKey)!, replayed: true };
  }
  const { plan } = snapshot;
  const discovery = discoveryOf(plan);
  const tasks = plan.options.tasks.filter((task) => plan.task_ids.includes(task.id));
  generatePanel({
    context: plan.audience.context,
    segments: plan.segments.map((segment) => segment.count),
  });
  let run;
  try {
    /* 개발 mock 의 탐색 계획(15분)을 새로 받아 씁니다 */
    const dev = discover({ variant: discovery.variant });
    run = confirm({
      plan_id: dev.plan_id,
      feature_ids: [...new Set(tasks.map((task) => task.feature_id))],
      task_ids: tasks.map((task) => task.id),
      ages: devAges(plan.audience.ages),
      context: plan.audience.context,
      additional_request: plan.additional_request,
    });
  } catch (error) {
    if (error instanceof MockApiError && error.status === 409) {
      throw new MockPlanError(
        409,
        "RUN_IN_PROGRESS",
        "이미 진행 중인 실행이 있어요. 끝난 뒤에 다시 시작해주세요.",
      );
    }
    throw error;
  }
  if (idempotencyKey) state.runKeys.set(idempotencyKey, run.id!);
  return { run_id: run.id!, replayed: false };
}
