import { apiAssetUrl } from "@/apis/run.api";
import { taskLabel } from "@/pages/test-run/utils/runAdapter";
import type {
  PersonaSession,
  SessionEvent,
  SessionStatus,
  Stage,
  TracePoint,
} from "@/types/persona.type";
import type { ReportSessionDetail } from "@/types/report.type";

/*
  제품 API 세션 상세(GET /api/v1/reports/{id}/sessions/{task}/{seed}/{persona}) → 세션 화면이 쓰는 값.
  실행 화면(runAdapter)처럼 화면 컴포넌트는 그대로 두고 여기서 한 번만 바꿉니다.
  제품 API 에 없는 값(Think-aloud 발화·토큰·비용·질문 답)은 비워 두고 화면이 숨깁니다.
*/

const FUNNEL_STAGES: readonly string[] = [
  "landing",
  "browse",
  "detail",
  "cart",
  "signup",
  "payment",
  "complete",
];

const toStage = (value: string | null): Stage =>
  value && FUNNEL_STAGES.includes(value) ? (value as Stage) : "other";

/* 끝나지 않은 세션(incomplete)은 화면에서 진행 중과 같게 봅니다 */
const toStatus = (value: string): SessionStatus =>
  value === "incomplete" ? "running" : (value as SessionStatus);

export function toPersonaSession(detail: ReportSessionDetail): PersonaSession {
  const last = detail.timeline.length - 1;
  /* 화면에 보이는 스텝 번호는 1부터 (BE step_id "step_003" 은 건너뛴 번호가 있을 수 있어 순서로 매깁니다) */
  const trace: TracePoint[] = detail.timeline.map((step, index, list) => {
    /* 스텝 임계치가 없으면 세션 임계치로 (둘 다 없으면 0 — 초과로 보지 않습니다) */
    const threshold = step.frustration_threshold ?? detail.chart.threshold;
    const score = step.frustration_score ?? 0;
    return {
      step: index + 1,
      stage: toStage(step.stage),
      score,
      previous_score: list[index - 1]?.frustration_score ?? 0,
      threshold: threshold ?? 0,
      required_fields: step.required_fields ?? 0,
      crossed: threshold != null && score > threshold,
      url: step.url,
      artifact_id: null,
      /* 마지막 스텝에 캡처가 없으면 세션 마지막 화면으로 채웁니다 */
      screenshot_url: apiAssetUrl(
        step.screenshot ?? (index === last ? detail.final_screenshot : null),
      ),
    };
  });
  const events: SessionEvent[] = detail.timeline.flatMap((step, index) =>
    step.action
      ? [{ step: index + 1, action: step.action.kind, description: step.action.explanation ?? "" }]
      : [],
  );
  const segmentName = detail.persona.segment_name ?? detail.persona.code;

  return {
    id: detail.session_id,
    name: segmentName,
    context: detail.persona.context ?? "",
    max_required_fields: 0,
    width: 390,
    search_sensitivity: 0,
    cost_sensitivity: 0,
    profile_id: detail.persona.segment_id ?? detail.persona.code,
    task_id: detail.task.id,
    task_name: detail.task.name ?? taskLabel(detail.task.id),
    goal: "",
    status: toStatus(detail.status),
    reason: detail.reason ?? "",
    explanation: detail.explanation ?? null,
    steps: detail.steps,
    events,
    trace,
    terminal_stage: detail.terminal_stage ? toStage(detail.terminal_stage) : null,
    issue: null,
    cause_name: detail.primary_cause?.name ?? null,
    artifact_id: null,
    viewer_url: null,
    code: detail.persona.code,
    segment_id: detail.persona.segment_id ?? undefined,
    segment_name: segmentName,
    seed: detail.seed,
    elapsed_ms: detail.duration_seconds == null ? undefined : detail.duration_seconds * 1000,
  };
}
