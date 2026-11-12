import type { AgeOption, ConfirmRequest, DiscoverResponse } from "@/types/persona.type";

/* 새 테스트 단계 (?step= 값) — Figma Stepper 순서 */
export const STEPS = ["site", "task", "persona", "confirm"] as const;
export type StepKey = (typeof STEPS)[number];
export const STEP_LABELS: Record<StepKey, string> = {
  site: "사이트",
  task: "과업 · 타겟",
  persona: "페르소나",
  confirm: "시작 전 확인",
};

export function parseStep(value: string | null): StepKey {
  return (STEPS as readonly string[]).includes(value ?? "") ? (value as StepKey) : "site";
}

/*
  지금 입력으로 들어갈 수 있는 가장 앞 단계.
  주소로 바로 들어오거나(새로고침·북마크) 브라우저 뒤로가기로 앞 단계 검증을 건너뛰지 못하게 합니다.
  페르소나 단계는 입력이 없어 과업·타겟을 통과하면 시작 전 확인까지 갈 수 있습니다.
*/
export function furthestAllowedStep(input: {
  hasPlan: boolean;
  taskCount: number;
  targetDescription: string;
}): StepKey {
  if (!input.hasPlan) return "site";
  if (input.taskCount === 0 || !input.targetDescription.trim()) return "task";
  return "confirm";
}

/* 요청한 단계와 갈 수 있는 단계 중 앞쪽 */
export function clampStep(requested: StepKey, allowed: StepKey): StepKey {
  return STEPS.indexOf(requested) <= STEPS.indexOf(allowed) ? requested : allowed;
}

/* confirm 400 중 계획 만료 (BE: "탐색 결과가 만료됐습니다. 다시 확인해주세요.") — 그 밖의 400 은 입력 오류 */
export function isPlanExpiredMessage(message: string) {
  return message.includes("만료");
}

/* BE 탐색 계획 보관 시간 (agent/preflight.py 900초) */
export const PLAN_TTL_MS = 15 * 60 * 1000;

export function isPlanExpired(discoveredAt: number, now = Date.now()) {
  return now - discoveredAt >= PLAN_TTL_MS;
}

/* BE context·additional_request 최대 길이 */
export const TEXT_MAX = 500;

/* 테스트 계정 최대 개수 (Figma P04 "최대 20개") */
export const ACCOUNT_MAX = 20;

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
  return "https:// 로 시작하는 주소를 입력해 주세요";
}

/*
  연령 선택 (BE: 비어 있으면 400, "any" 는 단독으로만)
  - 전체를 고르면 다른 연령을 지우고, 특정 연령을 고르면 전체를 지웁니다.
  - 마지막 하나를 끄면 전체로 돌아갑니다.
*/
export function toggleAge(ages: AgeOption[], age: AgeOption): AgeOption[] {
  if (age === "any") return ["any"];
  const withoutAny = ages.filter((item) => item !== "any");
  const next = withoutAny.includes(age)
    ? withoutAny.filter((item) => item !== age)
    : [...withoutAny, age];
  return next.length > 0 ? next : ["any"];
}

export type TaskTargetInput = {
  taskIds: string[];
  ages: AgeOption[];
  targetDescription: string;
  memo: string;
};

/*
  confirm 요청 여섯 필드를 만듭니다.
  - task_ids: 탐색 결과에 있는 과업만, 화면(탐색 결과) 순서대로
  - feature_ids: 고른 과업이 속한 기능 (BE 는 과업의 기능이 feature_ids 에 있어야 받음)
  - 직접 추가한 과업은 BE 가 실행하지 못해 보내지 않습니다 (Figma: 따로 저장, 자동 포함 안 함)
*/
export function buildConfirmRequest(
  plan: DiscoverResponse,
  input: TaskTargetInput,
): ConfirmRequest {
  const tasks = plan.tasks.filter((task) => input.taskIds.includes(task.id));
  const featureIds = new Set(tasks.map((task) => task.feature_id));

  return {
    plan_id: plan.plan_id,
    feature_ids: plan.features.filter((f) => featureIds.has(f.id)).map((f) => f.id),
    task_ids: tasks.map((task) => task.id),
    ages: input.ages,
    context: input.targetDescription.trim(),
    additional_request: input.memo.trim(),
  };
}

export type TestAccount = { username: string; password: string };

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
