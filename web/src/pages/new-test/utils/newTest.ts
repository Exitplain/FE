import { ApiError } from "@/types/api.type";
import type { DiscoverFeature, DiscoverTask, PanelSegment } from "@/types/persona.type";
import type {
  AgeKey,
  Discovery,
  Plan,
  PlanReview,
  RevisionPersonas,
  SegmentProfile,
  SiteCheck,
} from "@/types/plan.type";

/* 새 테스트 단계 (?step= 값) — Figma Stepper 순서 */
export const STEPS = ["site", "task", "persona", "confirm"] as const;
export type StepKey = (typeof STEPS)[number];
export const STEP_LABELS: Record<StepKey, string> = {
  site: "사이트",
  task: "과업 · 타겟",
  persona: "페르소나",
  confirm: "시작 전 확인",
};

/* 시작 전 확인 다음의 P06 생성 중 · P07 페르소나 확인 (Stepper 에 없는 단계) */
export const REVIEW_STEP = "personas";

export function parseStep(value: string | null): StepKey {
  return (STEPS as readonly string[]).includes(value ?? "") ? (value as StepKey) : "site";
}

/*
  지금 입력으로 들어갈 수 있는 가장 앞 단계.
  주소로 바로 들어오거나(새로고침·북마크) 브라우저 뒤로가기로 앞 단계 검증을 건너뛰지 못하게 합니다.
  세그먼트 인원 합계가 패널과 맞지 않으면(P05e) 페르소나 단계에 머뭅니다.
*/
export function furthestAllowedStep(input: {
  hasPlan: boolean;
  taskCount: number;
  targetDescription: string;
  segmentsValid?: boolean;
}): StepKey {
  if (!input.hasPlan) return "site";
  if (input.taskCount === 0 || !input.targetDescription.trim()) return "task";
  if (input.segmentsValid === false) return "persona";
  return "confirm";
}

/* 요청한 단계와 갈 수 있는 단계 중 앞쪽 */
export function clampStep(requested: StepKey, allowed: StepKey): StepKey {
  return STEPS.indexOf(requested) <= STEPS.indexOf(allowed) ? requested : allowed;
}

/* 탐색 결과 만료 (BE 409 DISCOVERY_EXPIRED · 확정 blocking DISCOVERY_EXPIRED) */
export function isDiscoveryExpiredError(error: unknown) {
  return (
    error instanceof ApiError &&
    (error.code === "DISCOVERY_EXPIRED" ||
      (Array.isArray(error.fields?.blocking) &&
        error.fields.blocking.includes("DISCOVERY_EXPIRED")))
  );
}

/*
  확정(409)을 다시 시도해도 같은 이유로 막히는 오류는 고칠 단계로 보냅니다.
  - 테스트 계정이 4개보다 적음 · 확정 직전 서버의 계정 수가 바뀜 → 1단계(사이트 · 테스트 계정)
    계획을 만든 뒤 계정 수가 바뀌면 화면의 인원 기준도 옛 값이라, 계정을 다시 받고 다시 확인해야 합니다.
  - 과업·타겟이 비었음 → 2단계, 세그먼트 합계 → 3단계
  code 나 fields.blocking 에 있는 코드로 찾고, 없으면 null(다시 시도)입니다.
*/
const CONFIRM_FIX_STEP: Record<string, StepKey> = {
  TEST_ACCOUNT_COUNT_MISMATCH: "site",
  TEST_ACCOUNTS_REQUIRED: "site",
  NO_TASKS: "task",
  NO_AUDIENCE: "task",
  SEGMENT_TOTAL: "persona",
};

export function confirmFixStep(error: unknown): StepKey | null {
  if (!(error instanceof ApiError) || error.status !== 409) return null;
  const blocking = Array.isArray(error.fields?.blocking) ? error.fields.blocking : [];
  const codes = [error.code, ...blocking].filter((code): code is string => Boolean(code));
  const steps = codes.map((code) => CONFIRM_FIX_STEP[code]).filter(Boolean);
  /* 여러 이유가 있으면 앞 단계부터 고칩니다 */
  return steps.sort((a, b) => STEPS.indexOf(a) - STEPS.indexOf(b))[0] ?? null;
}

/* 탐색 결과의 만료 시각(expires_at, 15분)이 지났는지 */
export function isPlanExpired(expiresAt: number, now = Date.now()) {
  return now >= expiresAt;
}

/*
  위저드가 쓰는 계획 — 탐색 결과(features·tasks)와 서버 계획(id·revision·review)을 합친 화면용 값.
  - tasks[].funnel_stages: 계획의 과업별 퍼널 단계 수 (P05c "과업별 7단계")
  - age_options: 서버가 받는 연령과 이름 (전체 · 20대 … 50대 이상)
  - check: 사이트 주소 확인 결과 (실패해도 탐색은 진행합니다)
*/
export type WizardPlan = {
  planId: string;
  revision: number;
  discoveryId: string;
  expiresAt: number;
  loginMode: "none" | "test_account";
  features: DiscoverFeature[];
  tasks: DiscoverTask[];
  age_options: Partial<Record<AgeKey, string>>;
  /* 페르소나 인원 — 기준 인원과 확정할 수 있는 범위 (로그인 없이 4~20명, 테스트 계정이면 계정 수) */
  personaTotal: number;
  personaMin: number;
  personaMax: number;
  segmentIds: string[];
  /* 서버 계획에 저장된 시드 횟수와 고를 수 있는 범위 */
  seedCount: number;
  /* 서버 계획에 저장된 화면 너비 (px) */
  viewportWidth: number;
  seedRange: { min: number; max: number };
  review: PlanReview;
  check: SiteCheck | null;
  /* 3단계에서 추론한 세그먼트 유형 (추론 전이면 name 이 null) */
  segmentProfiles: SegmentProfile[];
};

export function toWizardPlan(
  discovery: Discovery,
  plan: Plan,
  check: SiteCheck | null,
): WizardPlan {
  const stages = new Map(plan.task_funnels.map((funnel) => [funnel.task_id, funnel.stages.length]));
  return {
    planId: plan.id,
    revision: plan.revision,
    discoveryId: discovery.id,
    expiresAt: Date.parse(discovery.expires_at),
    loginMode: discovery.login_mode,
    features: plan.options.features,
    tasks: plan.options.tasks.map((task) => ({ ...task, funnel_stages: stages.get(task.id) })),
    age_options: plan.options.capabilities.ages,
    ...personaRange(plan),
    segmentIds: plan.options.capabilities.segment_ids,
    seedCount: plan.limits.seed_count,
    viewportWidth: plan.limits.viewport_width,
    seedRange: plan.options.capabilities.limits.seed_count ?? { min: SEED_DEFAULT, max: SEED_MAX },
    review: plan.review,
    check,
    segmentProfiles: plan.segment_profiles ?? [],
  };
}

/* 서버 capabilities 의 페르소나 인원 (persona_min·max 가 없으면 기준 인원 하나만) */
function personaRange(plan: Plan) {
  const { persona_total, persona_min, persona_max } = plan.options.capabilities;
  return {
    personaTotal: persona_total,
    personaMin: persona_min ?? persona_total,
    personaMax: persona_max ?? persona_total,
  };
}

/* 계획을 고친 뒤(PATCH) 바뀌는 값만 덮어씁니다 */
export function withServerPlan(current: WizardPlan, plan: Plan): WizardPlan {
  return {
    ...current,
    revision: plan.revision,
    review: plan.review,
    ...personaRange(plan),
    seedCount: plan.limits.seed_count,
    viewportWidth: plan.limits.viewport_width,
    segmentProfiles: plan.segment_profiles ?? [],
  };
}

/* 세그먼트 유형을 아직 추론하지 않았는지 (이름이 하나라도 없으면 추론 전) */
export function needsSegmentInference(plan: WizardPlan | null) {
  return !!plan && (plan.segmentProfiles.length === 0 || plan.segmentProfiles.some((p) => !p.name));
}

/* BE context·additional_request 최대 길이 */
export const TEXT_MAX = 500;

/* 테스트 계정 최대 개수 (Figma P04 "최대 20개") */
export const ACCOUNT_MAX = 20;

/*
  ─── 패널 (P05b 세그먼트 비율) ───
  BE 기본값: 로그인 없이 에이전트 10명(4~20명에서 조절) · 세그먼트 4개 · 시드 1회(1~3회).
  계획을 받으면 서버 capabilities·limits 값을 쓰고, 계획이 없을 때만 아래 기본값으로 짐작합니다.
  (Figma 는 20명 · 시드 3회였으나 실행 비용 때문에 팀에서 기본값을 낮췄습니다)
*/
export const PANEL_DEFAULT = 10;
export const PANEL_MIN = 4;
export const PANEL_MAX = 20;
export const SEGMENT_COUNT = 4;
export const SEED_DEFAULT = 1;
export const SEED_MAX = 3;
/* 실행 기기 — 실행 조건의 맨 앞 항목 (실행 화면도 씁니다) */
/*
  화면 너비 (P05b 기기). 기본은 데스크톱 1280 (팀 결정: 대부분 웹 사이트를 테스트). 모바일 사이트면 모바일 390 을 고릅니다.
  767 이하는 모바일로 봅니다 (BE plans·실측 기기 구분과 같은 기준)
*/
export const VIEWPORTS = [
  { value: "1280", label: "데스크톱 1280" },
  { value: "390", label: "모바일 390" },
] as const;
export function deviceLabel(width: number) {
  return width <= 767 ? `모바일 ${width}` : `데스크톱 ${width}`;
}
export function runConditions(seedCount: number, viewportWidth = 1280) {
  return `${deviceLabel(viewportWidth)} · 동시 5회 방문 · 반복 ${seedCount}회 · 스텝 40`;
}
/* "항목 6개 더 보기"로 펼치는 실행 조건 */
export const RUN_CONDITION_DETAILS = [
  "방문당 시간 상한 5분",
  "방문당 비용 상한 $0.10",
  "결제·본인인증은 하지 않아요",
  "개인정보는 입력하지 않아요",
  "좌절 점수가 임계치를 넘으면 이탈로 기록해요",
  "같은 반복 번호는 같은 행동 순서로 다시 실행해요",
];

/* 계획이 없을 때 짐작하는 에이전트 수 — 로그인 테스트는 계정 1개 = 에이전트 1명(최대 20), 아니면 10명 (P05h) */
export function panelSize(loginMode: "none" | "account", accountCount: number) {
  return loginMode === "account" && accountCount > 0
    ? Math.min(accountCount, PANEL_MAX)
    : PANEL_DEFAULT;
}

/*
  확정할 수 있는 에이전트 수 — 계획이 있으면 서버 값(로그인 없이 4~20명, 테스트 계정이면 서버에 저장된 계정 수),
  없으면 화면 입력으로 짐작한 값입니다. 세그먼트 합계 검증은 모두 이 범위를 씁니다.
*/
export function agentRange(
  plan: Pick<WizardPlan, "personaTotal" | "personaMin" | "personaMax"> | null,
  loginMode: "none" | "account",
  accountCount: number,
) {
  if (plan) return { min: plan.personaMin, max: plan.personaMax, total: plan.personaTotal };
  const total = panelSize(loginMode, accountCount);
  return loginMode === "account" && accountCount > 0
    ? { min: total, max: total, total }
    : { min: PANEL_MIN, max: PANEL_MAX, total };
}

export function inRange(value: number, range: { min: number; max: number }) {
  return value >= range.min && value <= range.max;
}

/* P05e 합계 안내 — BE 422 문구와 같습니다 (범위가 한 값이면 그 인원에 맞추라고 안내) */
export function segmentTotalMessage(total: number, range: { min: number; max: number }) {
  return range.min === range.max
    ? `합계가 ${range.min}명이 되도록 맞춰주세요 · 지금 ${total}명`
    : `합계를 ${range.min}~${range.max}명 사이로 맞춰주세요 · 지금 ${total}명`;
}

/* 인원을 세그먼트에 고르게 나눕니다 (나머지는 앞 세그먼트부터 1명씩) — 10 → [3, 3, 2, 2] */
export function evenSplit(total: number, parts = SEGMENT_COUNT): number[] {
  return Array.from(
    { length: parts },
    (_, index) => Math.floor(total / parts) + (index < total % parts ? 1 : 0),
  );
}

export function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

/* 보정 적용일 "11월 5일" (서울 시간) */
const monthDay = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "long",
  day: "numeric",
});

export function formatMonthDay(iso: string | null | undefined) {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : monthDay.format(date);
}

/* Figma 연령 표기: 전체 · 20대 … 50대 이상 (이름은 서버 capabilities.ages) */
export function ageSummary(ages: AgeKey[], labels: Partial<Record<AgeKey, string>>) {
  if (ages.length === 0 || ages.includes("any")) return "전체";
  return ages.map((age) => labels[age] ?? age).join(", ");
}

/* E07 잘못된 URL — 주소 모양만 확인합니다 (접속 가능 여부는 서버 탐색 결과로) */
export function validateSiteUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "제품 URL 을 입력해 주세요";
  try {
    const url = new URL(trimmed);
    if ((url.protocol === "https:" || url.protocol === "http:") && url.hostname) return null;
  } catch {
    /* 아래 공통 안내 */
  }
  return "URL 형식이 아니에요 · https://로 시작하는 주소를 넣어주세요";
}

/*
  테스트 계정의 로그인 화면 주소 (BE login_url). 에이전트가 이 화면에서 계정으로 로그인한 뒤 테스트합니다.
  비우면 서버가 로그인 상태로 사이트를 확인·실행하지 못해 반드시 받습니다.
  프로젝트 사이트와 같은 출처인지는 서버가 확인합니다 (허용 출처가 사이트 주소 하나가 아닐 수 있음).
*/
export function validateLoginUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "로그인 화면 주소를 입력해 주세요";
  return validateSiteUrl(trimmed);
}

/* 로그인 화면 주소 예시 — 사이트 주소의 출처 + /login (주소가 올바르지 않으면 일반 예시) */
export function loginUrlPlaceholder(siteUrl: string): string {
  try {
    const url = new URL(siteUrl.trim());
    if (url.protocol === "https:" || url.protocol === "http:") return `${url.origin}/login`;
  } catch {
    /* 아래 일반 예시 */
  }
  return "https://example.com/login";
}

/*
  연령 선택 (BE: "any" 는 단독으로만)
  - 전체를 고르면 다른 연령을 지우고, 특정 연령을 고르면 전체를 지웁니다.
  - 마지막 하나를 끄면 전체로 돌아갑니다.
*/
export function toggleAge(ages: AgeKey[], age: AgeKey): AgeKey[] {
  if (age === "any") return ["any"];
  const withoutAny = ages.filter((item) => item !== "any");
  const next = withoutAny.includes(age)
    ? withoutAny.filter((item) => item !== age)
    : [...withoutAny, age];
  return next.length > 0 ? next : ["any"];
}

/*
  연령 칩 하나가 서버 연령 여러 개일 수 있게 둡니다 (지금은 칩 하나 = 연령 하나, "50대 이상" = 50plus).
  칩이 켜져 있으면(모두 포함) 끄고, 아니면 빠진 연령만 켭니다. 전체(any)는 단독입니다.
*/
export function toggleAgeChip(current: AgeKey[], chip: AgeKey[]): AgeKey[] {
  if (chip.includes("any")) return ["any"];
  const on = chip.every((age) => current.includes(age));
  return chip.reduce(
    (ages, age) => (on === ages.includes(age) ? toggleAge(ages, age) : ages),
    current,
  );
}

/*
  P05 과업·타겟을 계획에 저장하는 본문 (PATCH /api/v1/plans/{id}).
  - task_ids: 탐색 결과에 있는 과업만, 화면(탐색 결과) 순서대로
  - 직접 추가한 과업·추가 메모는 서버가 저장만 하고 실행에는 넣지 않습니다 (Figma: 따로 저장, 자동 포함 안 함)
*/
export function taskTargetPatch(
  plan: WizardPlan,
  input: {
    taskIds: string[];
    customTasks: string[];
    memo: string;
    targetDescription: string;
    ages: AgeKey[];
  },
) {
  return {
    task_ids: plan.tasks.filter((task) => input.taskIds.includes(task.id)).map((task) => task.id),
    custom_tasks: input.customTasks,
    additional_request: input.memo.trim(),
    audience: { context: input.targetDescription.trim(), ages: input.ages },
  };
}

/*
  P05b 세그먼트 인원·시드를 계획에 저장하는 본문 (서버 segment_ids 순서, 4개).
  시드는 서버 계획 값과 다를 때만 싣습니다 (limits 는 보낸 키만 바뀝니다).
*/
export function segmentsPatch(
  plan: WizardPlan,
  counts: number[],
  seedCount = plan.seedCount,
  viewportWidth = plan.viewportWidth,
) {
  const limits = {
    ...(seedCount !== plan.seedCount && { seed_count: seedCount }),
    ...(viewportWidth !== plan.viewportWidth && { viewport_width: viewportWidth }),
  };
  return {
    segments: plan.segmentIds.map((id, index) => ({ id, count: counts[index] ?? 0 })),
    ...(Object.keys(limits).length > 0 && { limits }),
  };
}

/* 서버에 저장한 계정은 id 가 있고, id 가 있으면 비밀번호를 비워 보내도 서버가 유지합니다 */
export type TestAccount = { id?: string; username: string; password: string };

/*
  P04d 붙여넣기: 스프레드시트·CSV 에서 복사한 "아이디,비밀번호" 줄을 읽습니다.
  쉼표 또는 탭으로 나누고, 머리글("아이디", "id", "email")과 빈 줄은 건너뜁니다.
*/
export function parseAccountsText(text: string): {
  accounts: TestAccount[];
  invalidLines: number[];
} {
  const accounts: TestAccount[] = [];
  const invalidLines: number[] = [];

  text.split(/\r?\n/).forEach((line, index) => {
    const [username = "", password = ""] = line.split(/[,\t]/).map((cell) => cell.trim());
    if (!username && !password) return;
    if (/^(아이디|id|email|이메일)/i.test(username) && /^(비밀번호|password|pw)/i.test(password)) {
      return;
    }
    if (!username || !password) {
      invalidLines.push(index + 1);
      return;
    }
    accounts.push({ username, password });
  });

  return { accounts, invalidLines };
}

/* P04c 같은 아이디: 대소문자·앞뒤 공백을 무시하고 두 번 이상 나온 행 번호 */
export function findDuplicateUsernames(rows: TestAccount[]): Set<number> {
  const seen = new Map<string, number[]>();
  rows.forEach((row, index) => {
    const key = row.username.trim().toLowerCase();
    if (!key) return;
    seen.set(key, [...(seen.get(key) ?? []), index]);
  });
  return new Set([...seen.values()].filter((list) => list.length > 1).flat());
}

/*
  P07 세그먼트 카드 값 — 확정한 계획의 페르소나(GET /api/v1/plan-revisions/{id}/personas)에서 만듭니다.
  P 코드 범위는 그 세그먼트에 속한 페르소나 코드의 처음~끝입니다.
*/
export function toPanelSegments(personas: RevisionPersonas): PanelSegment[] {
  return personas.segments.map((segment) => {
    const codes = personas.items
      .filter((item) => item.segment_id === segment.id)
      .map((item) => item.code)
      .sort();
    const first = codes[0] ?? segment.representative;
    return {
      id: segment.id,
      name: segment.name,
      count: segment.count,
      codes: [first, codes[codes.length - 1] ?? first],
      representative: segment.representative,
      avatar: segment.avatar,
      traits: {
        patience: segment.variables.patience,
        digital: segment.variables.digital_literacy,
        price: segment.variables.price_sensitivity,
        trust: segment.variables.trust_need,
      },
    };
  });
}

/*
  확인 화면의 "직접 추가한 과업" 줄.
  서버가 이번 실행에 넣는다고 알려 준 과업(review.tasks.custom_names)이면 AI 가 성공 기준을 만들어 함께 테스트하고,
  아니면 예전처럼 실행에 넣지 않습니다. 둘이 섞이면 과업마다 따로 적습니다.
*/
export function customTaskSummary(customTasks: string[], runningNames: string[] | undefined) {
  const running = new Set(runningNames ?? []);
  const inRun = customTasks.filter((task) => running.has(task));
  const notInRun = customTasks.filter((task) => !running.has(task));
  return [
    inRun.length > 0 ? `${inRun.join(" · ")} (AI가 성공 기준을 만들어 함께 테스트해요)` : "",
    notInRun.length > 0 ? `${notInRun.join(" · ")} (실행에 포함 안 됨)` : "",
  ]
    .filter(Boolean)
    .join(" / ");
}
