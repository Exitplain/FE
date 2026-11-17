import type {
  PersonaRun,
  PersonaSession,
  SessionEvent,
  SessionStatus,
  Stage,
  ThinkAloud,
  TracePoint,
} from "@/types/persona.type";
import { apiAssetUrl } from "@/apis/run.api";
import type { RunDetail, RunEvent, RunSession } from "@/types/run.type";

import type { RunPhase } from "./runView";

/*
  제품 API 실행(GET /api/v1/runs/{id} · /sessions · /events) → 실행 화면이 쓰는 값(PersonaRun 모양).
  실행 화면 컴포넌트는 개발 API 때의 값 모양을 그대로 쓰고, 여기서 한 번만 바꿉니다.
  제품 API 에 없는 값(시드 진행·토큰·비용·원격 브라우저·분석 단계·대기 세션)은 비워 두고 화면이 숨깁니다.
*/

/*
  임시: 과업 이름. 실행·세션 응답에는 과업 id 만 있어, 지금 서버 탐색이 돌려주는 반찬로드 과업 이름을 둡니다.
  BE 가 실행 응답에 과업 이름(또는 계획 확정본 id)을 넣어 주면 지웁니다. 모르는 id 는 그대로 보여 줍니다.
*/
const TASK_LABELS: Record<string, string> = {
  order: "첫 주문",
  delivery: "배송 지역 확인",
  coupon: "쿠폰으로 주문",
  subscription: "다음 배송 건너뛰기",
  cart: "장바구니 담기",
  benefit: "쿠폰 받기",
};

export function taskLabel(taskId: string) {
  return TASK_LABELS[taskId] ?? taskId;
}

const KNOWN_STAGES: readonly string[] = [
  "landing",
  "browse",
  "detail",
  "cart",
  "signup",
  "payment",
  "complete",
];

function toStage(value: unknown): Stage | null {
  return typeof value === "string" && KNOWN_STAGES.includes(value) ? (value as Stage) : null;
}

/* 제품 API 실행 상태 → 실행 화면 단계 */
export function v1Phase(run: Pick<RunDetail, "status" | "phase">): RunPhase {
  switch (run.status) {
    case "queued":
      return "preparing";
    case "running":
      return run.phase === "preparing" ? "preparing" : "running";
    case "finalizing":
      return "analyzing";
    case "completed":
    case "partially_completed":
      return "completed";
    case "failed":
      return "failed";
    case "cancelled":
      return "cancelled";
    /* 서버가 새 상태를 보내도 화면이 비지 않게 진행 중으로 둡니다 */
    default:
      return "running";
  }
}

/* 세션마다 이벤트에서 모은 관찰·행동 (최근 것만) */
export type SessionTrail = {
  observations: {
    step: number;
    stage: Stage | null;
    text: string;
    score: number | null;
    threshold: number | null;
    url: string;
    at: string;
  }[];
  actions: { step: number; kind: string; explanation: string }[];
};

export type RunTrails = { after: number; bySession: Record<number, SessionTrail> };

/* 세션마다 남길 최근 관찰·행동 수 (화면은 최근 몇 개만 씀) */
const TRAIL_LIMIT = 40;

const asNumber = (value: unknown) => (typeof value === "number" ? value : null);
const asString = (value: unknown) => (typeof value === "string" ? value : "");

/* 이벤트를 세션별 관찰·행동으로 쌓습니다. 이미 받은 이벤트(after 이하)는 다시 넣지 않습니다 */
export function reduceEvents(trails: RunTrails, events: RunEvent[], nextAfter: number): RunTrails {
  const bySession = { ...trails.bySession };
  for (const event of events) {
    /* 커서(after)는 이벤트 id 기준입니다 (BE runs.queries.list_events: id > after) */
    if (event.id <= trails.after || event.session_id == null) continue;
    const current = bySession[event.session_id] ?? { observations: [], actions: [] };
    const payload = event.payload;
    if (event.type === "observation.created") {
      const observations = [
        ...current.observations,
        {
          step: asNumber(payload.step_id) ?? current.observations.length + 1,
          stage: toStage(payload.stage),
          text: asString(payload.text),
          score: asNumber(payload.frustration_score),
          threshold: asNumber(payload.frustration_threshold),
          url: asString(payload.url),
          at: event.occurred_at,
        },
      ].slice(-TRAIL_LIMIT);
      bySession[event.session_id] = { ...current, observations };
    } else if (event.type === "action.completed") {
      const action = (payload.action ?? {}) as Record<string, unknown>;
      const actions = [
        ...current.actions,
        {
          step: asNumber(payload.step_id) ?? current.actions.length + 1,
          kind: asString(action.kind),
          explanation: asString(action.explanation),
        },
      ].slice(-TRAIL_LIMIT);
      bySession[event.session_id] = { ...current, actions };
    }
  }
  return { after: Math.max(trails.after, nextAfter), bySession };
}

function toSession(
  session: RunSession,
  trail: SessionTrail | undefined,
  now: number,
): PersonaSession {
  const observations = trail?.observations ?? [];
  const trace: TracePoint[] = observations
    .filter((item) => item.score != null)
    .map((item, index, list) => ({
      step: item.step,
      stage: item.stage ?? "other",
      score: item.score ?? 0,
      previous_score: list[index - 1]?.score ?? 0,
      threshold: item.threshold ?? 0,
      required_fields: 0,
      crossed: item.threshold != null && (item.score ?? 0) > item.threshold,
      url: item.url,
      artifact_id: null,
    }));
  const utterances: ThinkAloud[] = observations
    .filter((item) => item.text.trim())
    .map((item) => ({
      step: item.step,
      stage: item.stage ?? "other",
      text: item.text,
      at: item.at,
    }));
  const events: SessionEvent[] = (trail?.actions ?? []).map((action) => ({
    step: action.step,
    action: action.kind,
    description: action.explanation,
  }));
  const started = session.started_at ? Date.parse(session.started_at) : NaN;
  const elapsedMs =
    session.duration_seconds != null
      ? session.duration_seconds * 1000
      : Number.isNaN(started)
        ? undefined
        : Math.max(0, now - started);

  return {
    id: String(session.id),
    name: session.persona.segment_name,
    context: "",
    max_required_fields: 0,
    width: 390,
    search_sensitivity: 0,
    cost_sensitivity: 0,
    profile_id: session.persona.segment_id,
    task_id: session.task_id,
    task_name: taskLabel(session.task_id),
    goal: "",
    status: session.status as SessionStatus,
    reason: session.reason ?? "",
    steps: session.steps,
    url: session.latest_observation?.url,
    events,
    trace,
    terminal_stage: toStage(session.terminal_stage),
    issue: null,
    artifact_id: null,
    viewer_url: null,
    code: session.persona.code,
    segment_id: session.persona.segment_id,
    segment_name: session.persona.segment_name,
    seed: session.seed,
    utterances,
    elapsed_ms: elapsedMs,
    screenshot_url: apiAssetUrl(
      session.latest_observation?.screenshot_url ?? session.final_screenshot_url,
    ),
  };
}

/*
  실행 화면 값. 준비 단계의 "브라우저 n/N" 은 시작한 세션 / 예상 세션 수로 셉니다.
  시드·토큰·분석 단계는 제품 API 에 없어 넣지 않습니다.
*/
export function toPersonaRun(
  detail: RunDetail,
  sessions: RunSession[],
  trails: RunTrails | undefined,
  now = Date.now(),
): PersonaRun {
  const phase = v1Phase(detail);
  const active = phase === "preparing" || phase === "running" || phase === "analyzing";
  return {
    status: active ? "running" : "completed",
    id: detail.id,
    sequence_no: detail.sequence_no,
    name: detail.name,
    policy: "",
    model_calls: 0,
    target: "",
    profiles: [],
    tasks: [],
    sessions: sessions.map((session) => toSession(session, trails?.bySession[session.id], now)),
    created_at: detail.started_at ?? detail.created_at,
    stage: active ? (phase as "preparing" | "running" | "analyzing") : undefined,
    prepare: {
      browsers_ready: detail.progress.started_sessions,
      browsers_total: detail.progress.expected_sessions,
    },
  };
}
