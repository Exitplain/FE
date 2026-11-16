import type { PersonaRun, PersonaSession, Stage } from "@/types/persona.type";
import type { RunEvent, RunSession, RunSessionStatus } from "@/types/run.type";

import { findMockRun } from "./personaMock";

/*
  제품 API 실행 세션·이벤트 mock (GET /api/v1/runs/{id}/sessions · /events).
  개발 API mock 실행(personaMock)의 세션을 제품 API 모양으로 바꿉니다. 대기(queued) 세션은 넣지 않습니다.
  실행 mock 을 제품 API 로 옮기면 지웁니다.
*/

/* 개발 mock 화면 단계 → 제품 API 퍼널 단계 */
const FUNNEL: Partial<Record<Stage, string>> = {
  landing: "landing",
  delivery: "browse",
  benefits: "browse",
  account: "browse",
  product: "detail",
  coupon: "detail",
  subscription: "detail",
  cart: "cart",
  signup: "signup",
  checkout: "payment",
  complete: "complete",
};

const funnelKey = (stage: Stage | null | undefined) => (stage ? (FUNNEL[stage] ?? null) : null);

/* 세션 id 는 실행 안에서의 순서(1부터) — 이벤트 id 도 이 순서로 만들어 조회마다 같게 둡니다 */
function startedSessions(run: PersonaRun) {
  return run.sessions
    .map((session, index) => ({ session, id: index + 1 }))
    .filter(({ session }) => session.status !== "queued");
}

function toRunSession(session: PersonaSession, id: number): RunSession {
  const stages = (session.trace ?? []).map((point) => funnelKey(point.stage)).filter(Boolean);
  return {
    id,
    session_key: session.id,
    persona: {
      code: session.code ?? session.id,
      segment_id: session.segment_id ?? session.profile_id,
      segment_name: session.segment_name ?? session.name,
    },
    task_id: session.task_id,
    seed: session.seed ?? 1,
    status: session.status as RunSessionStatus,
    reason: session.reason || null,
    steps: session.steps,
    duration_seconds: session.elapsed_ms != null ? Math.round(session.elapsed_ms / 1000) : null,
    max_frustration: Math.max(0, ...(session.trace ?? []).map((point) => point.score)),
    terminal_stage: funnelKey(session.terminal_stage),
    stages_reached: [...new Set(stages as string[])],
    latest_observation: null,
    final_screenshot_url: null,
    started_at: null,
    finished_at: null,
  };
}

export function runSessionsV1(runId: string) {
  const run = findMockRun(runId);
  if (!run) return null;
  const items = startedSessions(run).map(({ session, id }) => toRunSession(session, id));
  return { items, next_cursor: null, total: items.length };
}

/*
  이벤트 id 는 처음 본 순서대로 늘어납니다 (BE 처럼 시간 순서). 조회마다 같은 관찰에는 같은 id 를 씁니다.
  세션 순서 × 1000 + 스텝처럼 만들면 뒤 세션의 id 가 먼저 커서가 돼 앞 세션의 새 관찰을 놓칩니다.
*/
const eventIds = new Map<string, number>();

export function resetRunV1Mock() {
  eventIds.clear();
}

function eventId(runId: string, sessionKey: string, step: number) {
  const key = `${runId}:${sessionKey}:${step}`;
  if (!eventIds.has(key)) eventIds.set(key, eventIds.size + 1);
  return eventIds.get(key)!;
}

/* 관찰(좌절 점수·발화)만 만듭니다 */
export function runEventsV1(runId: string, after: number) {
  const run = findMockRun(runId);
  if (!run) return null;
  const items: RunEvent[] = startedSessions(run).flatMap(({ session, id }) =>
    (session.trace ?? []).map((point) => {
      const said = session.utterances?.find((item) => item.step === point.step);
      return {
        id: eventId(runId, `${id}:${session.id}:${session.seed ?? 1}`, point.step),
        type: "observation.created",
        sequence: point.step,
        session_id: id,
        session_key: session.id,
        occurred_at: said?.at ?? new Date().toISOString(),
        payload: {
          step_id: point.step,
          url: point.url,
          stage: funnelKey(point.stage),
          text: said?.text ?? "",
          frustration_score: point.score,
          frustration_threshold: point.threshold,
          screenshot_url: null,
        },
      };
    }),
  );
  const next = items.filter((item) => item.id > after).sort((a, b) => a.id - b.id);
  return {
    items: next,
    next_after: next.length > 0 ? next[next.length - 1].id : after,
    has_more: false,
  };
}

/* 실행 상세의 진행 숫자 (예상 = 전체 세션, 시작 = 대기가 아닌 세션) */
export function runProgressV1(runId: string) {
  const run = findMockRun(runId);
  if (!run) return null;
  const started = startedSessions(run);
  return {
    expected_sessions: run.sessions.length,
    started_sessions: started.length,
    finished_sessions: started.filter(({ session }) => session.status !== "running").length,
  };
}
