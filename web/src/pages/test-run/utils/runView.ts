import type { IconName } from "@/components/Icon/iconNames";
import type { StatusTone } from "@/components/StatusBadge/StatusBadge";
import type { PersonaSession, SessionStatus, Stage } from "@/types/persona.type";

/*
  실행 화면이 어떤 상태를 보여줄지
  - preparing (P08): 브라우저 준비 · running (P09): 세션 진행 · analyzing (P10): 결과 분석
  - completed: 실행 종료 (분석 화면을 보고 있었다면 리포트로 자동 이동)
  - failed (E05): 끝났는데 모든 세션이 기술 실패(실행 오류·한도 도달)
  - stopped (E12): 비용 상한에 닿아 중간에 멈춤 (부분 결과)
  - cancelled: 중지한 실행 (제품 API)
  제품 API 실행 상태에서 단계를 정하는 건 utils/runAdapter.ts v1Phase 입니다.
*/
export type RunPhase =
  | "idle"
  | "preparing"
  | "running"
  | "analyzing"
  | "completed"
  | "failed"
  | "stopped"
  /* 제품 API: 중지한 실행 */
  | "cancelled";

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
    case "cancelled":
      /* 제품 API: 실행을 중지해 멈춘 세션 (임시 문구) */
      return { icon: "close", label: "중지", tone: "muted" };
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

/* 리포트·세션 상세도 쓰게 돼 constants 로 옮겼습니다. 실행 화면 import 는 그대로 둡니다 */
export { STAGE_LABELS } from "@/constants/persona";

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

/*
  세션당 최대 행동 수. BE 개발 서버 한도는 35 지만 Figma·실행 조건(스텝 40)에 맞춰 40 으로 보여줍니다 (임시)
*/
export const MAX_STEPS = 40;
/* 세션당 시간 상한 (실행 조건 "세션당 시간 상한 5분") */
export const SESSION_TIME_LIMIT_MIN = 5;

/* 타일·발화에 쓰는 이름: mock 은 P 코드와 세그먼트를 주고, 없으면(BE) 프로필 이름 */
export function sessionCode(session: PersonaSession) {
  return session.code ?? session.name;
}
export function sessionSegment(session: PersonaSession) {
  return session.segment_name ?? session.name;
}

/* 행동 로그의 행동 이름 (Figma P11: 클릭 · 스크롤 · 입력 · 뒤로) */
const ACTION_LABELS: Record<string, string> = {
  click: "클릭",
  scroll: "스크롤",
  input: "입력",
  type: "입력",
  back: "뒤로",
  navigate: "이동",
};
export function actionLabel(action: string) {
  return ACTION_LABELS[action] ?? action;
}

/* 서울 시간 "14:36" */
const clockFormat = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
export function formatClock(iso: string | null | undefined) {
  if (!iso) return "";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : clockFormat.format(date);
}

/* "12.4k 토큰" · "1.1M" */
export function formatTokens(tokens: number) {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}k`;
  return String(tokens);
}

/* 세션의 마지막 Think-aloud 발화 (mock 임시 필드) */
export function lastUtterance(session: PersonaSession) {
  return session.utterances?.at(-1) ?? null;
}

/*
  P11 라이브 화면 iframe 주소 검증.
  sandbox 에 allow-scripts + allow-same-origin 을 함께 주면, 앱과 같은 출처의 문서는 sandbox 를 스스로
  풀 수 있습니다. 그래서 앱과 다른 출처의 http(s) 주소(BE 개발 원격 브라우저 등)만 허용하고
  같은 출처·상대 경로·그 밖의 스킴은 막습니다.
*/
export function safeViewerUrl(raw: string | null | undefined, appOrigin: string): string | null {
  if (!raw) return null;
  let url: URL;
  let app: URL;
  try {
    /* file: 등에서 origin 이 "null" 이면 파싱이 실패하므로 막는 쪽으로 처리합니다 */
    app = new URL(appOrigin);
    url = new URL(raw, app);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.origin === app.origin) return null;
  return url.href;
}

/* E05 문구: 기술 실패 이유와 정상 종료(완료·이탈) 세션 수 */
export function failureSummary(sessions: PersonaSession[]) {
  const counts = countSessions(sessions);
  const reasons = [...new Set(sessions.map((session) => session.reason).filter(Boolean))];
  const allBudget =
    sessions.length > 0 && sessions.every((session) => session.status === "budget_exceeded");
  return {
    reason: allBudget
      ? "모든 방문이 행동·시간 한도에 닿았어요"
      : reasons.slice(0, 2).join(" · ") || "브라우저를 실행하지 못했어요",
    /* Figma E05 "끝난 세션 0 / 20" — 정상 종료(완료·이탈)한 세션 */
    finishedNormally: counts.success + counts.dropout,
    total: counts.all,
  };
}
