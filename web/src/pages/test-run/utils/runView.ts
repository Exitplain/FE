import type { IconName } from "@/components/Icon/iconNames";
import type { StatusTone } from "@/components/StatusBadge/StatusBadge";
import type { PersonaRun, PersonaSession, SessionStatus, Stage } from "@/types/persona.type";

/*
  실행 화면이 어떤 상태를 보여줄지 (BE 실행 상태에는 준비·분석 단계가 따로 없어 세션으로 판단)
  - preparing (P08): 실행 중이지만 아직 어떤 세션도 행동하지 않음 (브라우저 준비)
  - running (P09): 한 세션이라도 행동을 시작했거나 끝남
  - completed (P10 자리): 실행 종료 — BE 는 리포트를 요청할 때 계산하므로 "분석 중" 단계 없이 결과 요약
  - failed (E05): 끝났는데 모든 세션이 기술 실패(실행 오류·한도 도달)
*/
export type RunPhase = "idle" | "preparing" | "running" | "completed" | "failed";

const TECHNICAL_FAILURE: SessionStatus[] = ["agent_failure", "budget_exceeded"];

export function runPhase(run: PersonaRun): RunPhase {
  if (run.status === "idle") return "idle";
  if (run.status === "completed") {
    const allFailed =
      run.sessions.length > 0 &&
      run.sessions.every((session) => TECHNICAL_FAILURE.includes(session.status));
    return allFailed ? "failed" : "completed";
  }
  const started = run.sessions.some(
    (session) => session.steps > 0 || !["queued", "running"].includes(session.status),
  );
  return started ? "running" : "preparing";
}

/* Figma P09 필터 탭 묶음. 기술 실패(실행 오류·한도 도달)는 이탈률에 섞지 않고 오류로 셉니다 */
export type SessionGroup = "running" | "success" | "dropout" | "queued" | "error";
export type SessionFilter = SessionGroup | "all";

export function sessionGroup(status: SessionStatus): SessionGroup {
  switch (status) {
    case "running":
      return "running";
    case "success":
      return "success";
    case "simulated_dropout":
      return "dropout";
    case "queued":
      return "queued";
    default:
      return "error";
  }
}

export type SessionCounts = Record<SessionFilter, number> & { finished: number };

export function countSessions(sessions: PersonaSession[]): SessionCounts {
  const counts: SessionCounts = {
    all: sessions.length,
    running: 0,
    success: 0,
    dropout: 0,
    queued: 0,
    error: 0,
    finished: 0,
  };
  for (const session of sessions) {
    const group = sessionGroup(session.status);
    counts[group] += 1;
    if (group !== "running" && group !== "queued") counts.finished += 1;
  }
  return counts;
}

export function filterSessions(sessions: PersonaSession[], filter: SessionFilter) {
  return filter === "all"
    ? sessions
    : sessions.filter((session) => sessionGroup(session.status) === filter);
}

export const FILTER_LABELS: Record<SessionFilter, string> = {
  all: "전체",
  running: "진행 중",
  success: "완료",
  dropout: "이탈",
  queued: "대기",
  error: "오류",
};

/* 세션 타일·라이브 화면의 상태 배지 (Figma P09 타일: 이탈은 빨간 글자) */
export function sessionBadge(status: SessionStatus): {
  icon: IconName;
  label: string;
  tone: StatusTone;
} {
  switch (status) {
    case "queued":
      return { icon: "status-wait", label: "대기", tone: "muted" };
    case "running":
      return { icon: "play", label: "진행 중", tone: "strong" };
    case "success":
      return { icon: "check", label: "완료", tone: "muted" };
    case "simulated_dropout":
      return { icon: "status-exit", label: "이탈", tone: "danger" };
    case "budget_exceeded":
      /* E12 — 행동 횟수·시간 한도 */
      return { icon: "status-error", label: "한도 도달", tone: "alert" };
    default:
      return { icon: "status-error", label: "오류", tone: "alert" };
  }
}

/* 과업 탭: 세션의 과업을 처음 나온 순서대로 */
export function taskOptions(sessions: PersonaSession[]) {
  const seen = new Map<string, string>();
  for (const session of sessions) {
    if (!seen.has(session.task_id)) seen.set(session.task_id, session.task_name);
  }
  return [...seen].map(([id, name]) => ({ id, name }));
}

/* BE 화면 단계 이름 (agent/frustration.py STAGES 경로 기준) */
export const STAGE_LABELS: Record<Stage, string> = {
  landing: "첫 화면",
  product: "상품",
  cart: "장바구니",
  signup: "가입",
  checkout: "결제 정보",
  complete: "완료 화면",
  delivery: "배송 지역",
  benefits: "혜택",
  coupon: "쿠폰",
  account: "내 정보",
  subscription: "구독",
  other: "기타",
};

/* "지금 가장 많은 단계: 장바구니 · 4세션" */
export function busiestStage(sessions: PersonaSession[]): { stage: Stage; count: number } | null {
  const counts = new Map<Stage, number>();
  for (const session of sessions) {
    if (session.status !== "running" || !session.terminal_stage) continue;
    counts.set(session.terminal_stage, (counts.get(session.terminal_stage) ?? 0) + 1);
  }
  let best: { stage: Stage; count: number } | null = null;
  for (const [stage, count] of counts) {
    if (!best || count > best.count) best = { stage, count };
  }
  return best;
}

export function formatElapsed(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}분 ${seconds % 60}초`;
}

/* BE 실행 한도 (agent/persona_dashboard.py) — 세션당 최대 행동 수 */
export const MAX_STEPS = 35;
