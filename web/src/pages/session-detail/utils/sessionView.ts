import { CAUSE_LABELS, STAGE_LABELS } from "@/constants/persona";
import { actionLabel, formatTokens, sessionSegment } from "@/pages/test-run/utils/runView";
import type { PersonaSession, SessionStatus, Stage } from "@/types/persona.type";

/* 세션 상세 탭 (?tab=). 잘못된 값은 요약으로 봅니다 */
export const SESSION_TABS = ["summary", "timeline", "questions"] as const;
export type SessionTab = (typeof SESSION_TABS)[number];

export function parseTab(value: string | null): SessionTab {
  return (SESSION_TABS as readonly string[]).includes(value ?? "")
    ? (value as SessionTab)
    : "summary";
}

/* 기술 오류(실행 오류·한도 도달)는 이탈·원인 계산에서 빠지는 세션이라 E06 으로 보여줍니다 */
export function isTechnical(status: SessionStatus) {
  return status === "agent_failure" || status === "budget_exceeded";
}

/* "3분 05초" — Figma 세션 상세 표기 (초를 두 자리로). 1분 미만은 "45초" */
export function formatDurationPadded(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return minutes > 0 ? `${minutes}분 ${String(seconds).padStart(2, "0")}초` : `${seconds}초`;
}

const formatCost = (usd: number) => `$${usd.toFixed(2)}`;

/*
  제목 아래 한 줄.
  Figma P15 "신중한 첫 방문형 · 첫 주문 완료 · 시드 1 · 12스텝 · 3분 05초 · 18.2k 토큰 · $0.04"
  E06 "가격 민감형 · 시드 1 · 6스텝에서 멈춤 · 4.1k 토큰 · $0.01"
*/
export function describeSession(session: PersonaSession) {
  const parts = [sessionSegment(session)];
  const technical = isTechnical(session.status);
  if (!technical) parts.push(session.task_name);
  if (session.seed != null) parts.push(`시드 ${session.seed}`);
  parts.push(technical ? `${session.steps}스텝에서 멈춤` : `${session.steps}스텝`);
  if (!technical && session.elapsed_ms != null) {
    parts.push(formatDurationPadded(session.elapsed_ms));
  }
  if (session.tokens != null) parts.push(`${formatTokens(session.tokens)} 토큰`);
  if (session.cost_usd != null) parts.push(formatCost(session.cost_usd));
  return parts.join(" · ");
}

/* 타임라인 스텝 요소 id (질문 탭 근거 링크가 이 스텝으로 스크롤) */
export const stepAnchor = (step: number) => `session-step-${step}`;

export type StepRow = {
  step: number;
  stage: Stage;
  /* "클릭 · ‘상품’ 화면으로 이동" */
  action: string | null;
  utterance: string | null;
  score: number;
  threshold: number;
  artifactId: string | null;
  /* 이탈한 마지막 스텝 */
  exit: boolean;
};

/* trace 를 기준으로 같은 step 의 행동·발화를 붙입니다 (BE 도 세 기록의 step 번호가 같습니다) */
export function mergeSteps(session: PersonaSession): StepRow[] {
  const events = new Map(session.events.map((event) => [event.step, event]));
  const utterances = new Map((session.utterances ?? []).map((item) => [item.step, item]));
  const lastStep = session.trace.at(-1)?.step;
  return session.trace.map((point) => {
    const event = events.get(point.step);
    return {
      step: point.step,
      stage: point.stage,
      action: event ? `${actionLabel(event.action)} · ${event.description}` : null,
      utterance: utterances.get(point.step)?.text ?? null,
      score: point.score,
      threshold: point.threshold,
      artifactId: point.artifact_id,
      exit: session.status === "simulated_dropout" && point.step === lastStep,
    };
  });
}

export type FlowStage = {
  stage: Stage;
  label: string;
  /* 단계에서 마지막으로 한 행동 (예: 클릭) */
  note: string;
  state: "passed" | "exit" | "done";
};

/*
  지나온 단계 — trace 에 나온 단계를 처음 나온 순서대로.
  마지막 단계는 이탈이면 "여기서 중단", 완료면 체크 표시입니다.
*/
export function stageFlow(session: PersonaSession): FlowStage[] {
  const order: Stage[] = [];
  const lastAction = new Map<Stage, string>();
  const events = new Map(session.events.map((event) => [event.step, event]));
  for (const point of session.trace) {
    if (!order.includes(point.stage)) order.push(point.stage);
    const event = events.get(point.step);
    if (event) lastAction.set(point.stage, actionLabel(event.action));
  }
  return order.map((stage, index) => {
    const last = index === order.length - 1;
    const state = !last ? "passed" : session.status === "simulated_dropout" ? "exit" : "done";
    return {
      stage,
      label: STAGE_LABELS[stage],
      note: state === "exit" ? "여기서 중단" : (lastAction.get(stage) ?? ""),
      state,
    };
  });
}

export type Kpi = { label: string; value: string; emphasis?: boolean };

/* 요약 KPI 4칸 — 이탈(P15)과 완료(P16)가 다릅니다 */
export function sessionKpis(session: PersonaSession): Kpi[] {
  const last = session.trace.at(-1);
  const threshold = last?.threshold ?? 0;
  const stageLabel = session.terminal_stage ? STAGE_LABELS[session.terminal_stage] : "—";

  if (session.status === "simulated_dropout") {
    return [
      { label: "이탈 단계", value: stageLabel, emphasis: true },
      {
        label: "이탈 원인",
        value: session.issue ? CAUSE_LABELS[session.issue.category] : "원인 불명",
      },
      { label: "좌절 점수", value: `${last?.score ?? 0} / 임계치 ${threshold}` },
      { label: "종료 사유", value: "임계치 초과 → 이탈" },
    ];
  }

  const peak = session.trace.reduce((max, point) => Math.max(max, point.score), 0);
  /* Figma P16 "결제 정보 → 완료": 완료 화면 직전에 지나온 단계 → 완료 */
  const before = [...session.trace].reverse().find((point) => point.stage !== "complete");
  const reached =
    session.status === "success"
      ? `${before ? STAGE_LABELS[before.stage] : stageLabel} → 완료`
      : stageLabel;
  return [
    { label: "도달 단계", value: reached, emphasis: true },
    {
      label: "소요 시간",
      value: session.elapsed_ms != null ? formatDurationPadded(session.elapsed_ms) : "—",
    },
    { label: "최고 좌절 점수", value: `${peak} / 임계치 ${threshold}` },
    { label: "종료 사유", value: session.status === "success" ? "목표 달성" : "진행 중" },
  ];
}

/* 질문 칩 — Figma P15 "왜 멈췄나요?", P16 "어디서 망설였나요?", P15d "마지막 행동은 왜 했나요?" */
export function suggestedQuestions(session: PersonaSession, full = false) {
  const first = session.status === "simulated_dropout" ? "왜 멈췄나요?" : "어디서 망설였나요?";
  return full ? [first, "마지막 행동은 왜 했나요?", "개선하려면?"] : [first, "개선하려면?"];
}

/* 근거 발화 — 이탈이면 마지막 발화(이탈 문장), 아니면 없음 */
export function evidenceQuote(session: PersonaSession) {
  if (session.status !== "simulated_dropout") return null;
  return session.utterances?.at(-1)?.text ?? null;
}
