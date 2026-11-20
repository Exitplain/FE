import { http, HttpResponse } from "msw";

import type {
  CalibrationCompare,
  CalibrationProposal,
  CalibrationRecord,
  HumanObservation,
  HumanObservationList,
  ObservationInput,
} from "@/types/calibration.type";

import { CALIBRATIONS, sampleProposal } from "../fixtures/calibration";

/*
  보정 mock (BE calibrations). 프로젝트마다 이력·조정안 상태를 메모리에 둡니다.
  - 기본: 반찬로드(1)는 조정안 있음, 그 밖은 실측 미연결(NOT_CONNECTED)
  - 테스트는 setCalibrationMock 으로 조정안 상태(reason)를 정합니다
  - 적용하면 새 기록이 생기고, 다음 사전 테스트 전까지 조정안은 WAITING_NEXT_RUN (BE 와 같음)
*/
type State = {
  history: CalibrationRecord[];
  reason: CalibrationProposal["reason"] | null;
  /* 이 보정으로 돈 사전 테스트가 끝났는지 (K03 전·후 비교) */
  afterRun: boolean;
  observations: HumanObservation[];
  /* 비교 기준 리포트가 있는지 (없으면 관측 저장 409) */
  predicted: boolean;
  /* 근거가 10 미만이라 임시값인지 */
  provisional: boolean;
};
const store = new Map<string, State>();
let nextId = 100;

export function resetCalibrationMock() {
  store.clear();
  nextId = 100;
}

export function setCalibrationMock(projectId: string, patch: Partial<State>) {
  store.set(projectId, { ...stateOf(projectId), ...patch });
}

function stateOf(projectId: string): State {
  const found = store.get(projectId);
  if (found) return found;
  const fresh: State = {
    history: structuredClone(CALIBRATIONS[projectId] ?? []),
    reason: projectId === "1" ? null : "NOT_CONNECTED",
    afterRun: false,
    observations: [],
    predicted: true,
    provisional: false,
  };
  store.set(projectId, fresh);
  return fresh;
}

const MESSAGES: Record<string, string> = {
  NOT_CONNECTED: "실제 고객 데이터를 먼저 연결해 주세요.",
  NOT_MAPPED: "단계 매핑을 먼저 저장해 주세요.",
  NO_PREDICTION: "먼저 사전 테스트를 한 번 실행해야 비교할 수 있어요.",
  INSUFFICIENT_SAMPLE: "실제 고객 데이터 방문이 단계마다 100개는 모여야 조정안을 만들 수 있어요.",
  NO_GAP: "모든 단계가 예측 범위 안이라 바꿀 값이 없어요.",
  WAITING_NEXT_RUN:
    "예측 맞추기를 적용한 뒤 아직 새 사전 테스트가 없어요. 다음 사전 테스트가 끝나면 다시 비교해요.",
};

function revisionOf(state: State) {
  return state.history[0]?.revision ?? 0;
}

function proposalOf(
  projectId: string,
  strength: "normal" | "gentle" = "normal",
): CalibrationProposal {
  const state = stateOf(projectId);
  const full = sampleProposal(Number(projectId), revisionOf(state), {
    provisional: state.provisional,
    strength,
  });
  if (!state.reason) return full;
  return {
    ...full,
    available: state.reason === "NO_GAP",
    reason: state.reason,
    message: MESSAGES[state.reason],
    basis: state.reason === "NO_GAP" ? { ...full.basis!, mean_error: 1.2, gaps: [] } : null,
    items: [],
  };
}

const conflict = () =>
  HttpResponse.json(
    {
      error: {
        code: "REVISION_CONFLICT",
        message: "다른 예측 맞추기가 먼저 적용됐어요. 새로고침한 뒤 다시 확인해 주세요.",
        fields: {},
      },
      request_id: "req_mock",
    },
    { status: 409 },
  );

function record(state: State, patch: Partial<CalibrationRecord>): CalibrationRecord {
  nextId += 1;
  return {
    id: nextId,
    revision: revisionOf(state) + 1,
    applied_at: new Date().toISOString(),
    applied_by: "maker",
    params: {},
    changes: [],
    changes_summary: "",
    base_comparison: null,
    error_before_pp: null,
    error_after_pp: null,
    restored_from: null,
    ...patch,
  };
}

export const calibrationHandlers = [
  http.get("*/api/v1/projects/:projectId/calibrations", ({ params }) =>
    HttpResponse.json({
      items: structuredClone(stateOf(String(params.projectId)).history),
      next_cursor: null,
    }),
  ),
  http.get("*/api/v1/projects/:projectId/calibration/proposal", ({ params, request }) =>
    HttpResponse.json(
      proposalOf(
        String(params.projectId),
        new URL(request.url).searchParams.get("strength") === "gentle" ? "gentle" : "normal",
      ),
    ),
  ),
  http.post("*/api/v1/projects/:projectId/calibrations", async ({ params, request }) => {
    const projectId = String(params.projectId);
    const state = stateOf(projectId);
    const body = (await request.json()) as {
      expected_revision: number;
      keys: string[];
      strength?: "normal" | "gentle";
    };
    if (body.expected_revision !== revisionOf(state)) return conflict();
    const proposal = proposalOf(projectId, body.strength ?? "normal");
    if (proposal.provisional) {
      return HttpResponse.json(
        {
          error: { code: "PROVISIONAL", message: proposal.message ?? "임시값이에요", fields: {} },
          request_id: "req_mock",
        },
        { status: 422 },
      );
    }
    const chosen = proposal.items.filter((item) => body.keys.includes(item.key));
    const created = record(state, {
      changes: chosen,
      changes_summary: chosen
        .map((c) => `${c.segment_name} ${c.label} ${c.current.toFixed(2)}→${c.proposed.toFixed(2)}`)
        .join(" · "),
      base_comparison: "3차 vs 실제 고객 데이터 최근 7일",
      error_before_pp: proposal.basis?.mean_error ?? null,
    });
    state.history = [created, ...state.history];
    state.reason = "WAITING_NEXT_RUN";
    return HttpResponse.json(created, { status: 201 });
  }),
  http.post("*/api/v1/calibrations/:revisionId/restore", async ({ params, request }) => {
    const id = Number(params.revisionId);
    const entry = [...store.entries()].find(([, s]) => s.history.some((h) => h.id === id));
    if (!entry) return HttpResponse.json({}, { status: 404 });
    const [, state] = entry;
    const body = (await request.json()) as { expected_revision: number };
    if (body.expected_revision !== revisionOf(state)) return conflict();
    const target = state.history.find((h) => h.id === id)!;
    const created = record(state, {
      params: target.params,
      restored_from: target.revision,
      changes_summary: `r${target.revision} 값으로 되돌림`,
    });
    state.history = [created, ...state.history];
    return HttpResponse.json(created, { status: 201 });
  }),
  http.post("*/api/v1/projects/:projectId/calibrations/reset", async ({ params, request }) => {
    const state = stateOf(String(params.projectId));
    const body = (await request.json()) as { expected_revision: number };
    if (body.expected_revision !== revisionOf(state)) return conflict();
    const created = record(state, {
      params: { segments: {} },
      restored_from: 0,
      changes_summary: "기본 모형으로 되돌림",
    });
    state.history = [created, ...state.history];
    return HttpResponse.json(created, { status: 201 });
  }),
];

/* ---------- K03 보정 전·후 비교 ---------- */

const COMPARE_STAGES = [
  ["/products/:id", "상품 상세", 0, false, -0.4, false],
  ["/cart", "장바구니", -16, true, -4.2, false],
  ["/signup", "회원가입", -5, false, -2.1, false],
] as const;

function compareOf(state: State): CalibrationCompare {
  const latest = state.history[0];
  const waiting = !state.afterRun;
  return {
    revision: latest?.revision ?? 0,
    status: waiting ? "waiting" : "ready",
    ...(waiting
      ? {
          message:
            "이 예측 맞추기로 돈 사전 테스트가 아직 없어요. 끝나면 같은 실제 고객 데이터 기간으로 비교해요.",
        }
      : {}),
    before: { report_id: "report-mock-1", mean_error: 4.5, gaps: 1 },
    after: waiting
      ? null
      : { report_id: "report-mock-2", run_sequence: 4, mean_error: 2.1, gaps: 0 },
    stages: COMPARE_STAGES.map(([stageId, name, before, gap, after, gapAfter]) => ({
      task_id: "order",
      task_name: "첫 주문 완료",
      stage_id: stageId,
      stage_name: name,
      error: before,
      gap,
      before,
      after: waiting ? null : after,
      change: waiting ? null : gap && !gapAfter ? "차이 구간 해소" : "개선",
    })),
  };
}

/* ---------- K04 사람 관측 ---------- */

const OBS_TASKS: HumanObservationList["tasks"] = [
  {
    task_id: "order",
    name: "첫 주문 완료",
    stages: [
      { id: "/", name: "첫 화면" },
      { id: "/products/:id", name: "상품 상세" },
      { id: "/cart", name: "장바구니" },
      { id: "/signup", name: "회원가입" },
      { id: "/order/success", name: "주문 완료" },
    ],
    predicted: {
      outcome: "dropout",
      stage_id: "/signup",
      stage_name: "회원가입",
      cause: "input_burden",
      cause_name: "입력 부담",
      pain_top: ["/signup", "/cart"],
    },
  },
  {
    task_id: "coupon",
    name: "쿠폰으로 주문",
    stages: [
      { id: "/", name: "첫 화면" },
      { id: "/cart", name: "장바구니" },
      { id: "/order/success", name: "주문 완료" },
    ],
    predicted: {
      outcome: "success",
      stage_id: null,
      stage_name: null,
      cause: null,
      cause_name: null,
      pain_top: ["/cart"],
    },
  },
];
const OBS_CAUSES = [
  ["input_burden", "입력 부담"],
  ["navigation", "탐색 실패"],
  ["cost", "비용 충격"],
  ["value", "가치 불명확"],
  ["trust", "신뢰 부족"],
  ["technical", "기술 오류·지연"],
  ["accessibility", "접근성 장벽"],
  ["unknown", "원인 미상"],
].map(([key, name]) => ({ key, name }));

/* 모델이 화면에서 감지한 원인 예시 (BE screen_causes) */
const SCREEN_CAUSES: Record<string, string[]> = {
  "/signup": ["input_burden", "trust"],
  "/cart": ["cost", "navigation"],
};

function matchOf(
  row: Pick<
    HumanObservation,
    "task_id" | "outcome" | "stage_id" | "cause" | "pain_stage_id" | "pain_cause"
  >,
) {
  const predicted = OBS_TASKS.find((t) => t.task_id === row.task_id)!.predicted;
  const dropout = row.outcome === "dropout";
  const painCause = row.pain_cause && row.pain_cause !== "unknown" ? row.pain_cause : null;
  return {
    outcome: row.outcome === predicted.outcome,
    stage: dropout ? row.stage_id === predicted.stage_id : null,
    cause: dropout && row.cause !== "unknown" ? row.cause === predicted.cause : null,
    pain_screen: row.pain_stage_id ? predicted.pain_top.includes(row.pain_stage_id) : null,
    pain_cause:
      painCause && row.pain_stage_id
        ? (SCREEN_CAUSES[row.pain_stage_id] ?? []).includes(painCause)
        : null,
  };
}

function observationList(projectId: string, state: State): HumanObservationList {
  const evaluation = state.observations.filter((o) => o.purpose === "evaluation");
  const basis = evaluation.length ? evaluation : state.observations;
  const count = (key: keyof HumanObservation["match"]) => {
    const values = basis.map((o) => o.match[key]).filter((v) => v !== null);
    return { matched: values.filter(Boolean).length, total: values.length };
  };
  return {
    project_id: Number(projectId),
    report_id: state.predicted ? "report-mock-1" : null,
    tasks: state.predicted ? OBS_TASKS : [],
    causes: OBS_CAUSES,
    items: [...state.observations].sort((a, b) =>
      (a.participant_code + a.task_id).localeCompare(b.participant_code + b.task_id),
    ),
    summary: {
      outcome: count("outcome"),
      stage: count("stage"),
      cause: count("cause"),
      pain_screen: count("pain_screen"),
      pain_cause: count("pain_cause"),
    },
    summary_basis: evaluation.length ? "evaluation" : "all",
  };
}

function upsert(
  projectId: string,
  state: State,
  input: ObservationInput,
  source: HumanObservation["source"],
) {
  const task = OBS_TASKS.find((t) => t.task_id === input.task_id)!;
  const stageName = task.stages.find((st) => st.id === input.stage_id)?.name ?? null;
  const causeName = OBS_CAUSES.find((c) => c.key === input.cause)?.name ?? null;
  const index = state.observations.findIndex(
    (o) => o.participant_code === input.participant_code && o.task_id === input.task_id,
  );
  const row: HumanObservation = {
    id: index >= 0 ? state.observations[index].id : (nextId += 1),
    participant_code: input.participant_code,
    task_id: input.task_id,
    task_name: task.name,
    outcome: input.outcome,
    stage_id: input.stage_id || null,
    stage_name: input.outcome === "dropout" ? stageName : null,
    cause: input.cause || null,
    cause_name: input.outcome === "dropout" ? causeName : null,
    pain_stage_id: input.pain_stage_id || null,
    pain_stage_name: task.stages.find((st) => st.id === input.pain_stage_id)?.name ?? null,
    pain_cause: input.pain_cause || null,
    pain_cause_name: OBS_CAUSES.find((c) => c.key === input.pain_cause)?.name ?? null,
    discomfort: input.discomfort ?? null,
    purpose: input.purpose,
    source,
    updated_at: new Date().toISOString(),
    match: matchOf({
      task_id: input.task_id,
      outcome: input.outcome,
      stage_id: input.stage_id || null,
      cause: input.cause || null,
      pain_stage_id: input.pain_stage_id || null,
      pain_cause: input.pain_cause || null,
    }),
  };
  if (index >= 0) state.observations[index] = row;
  else state.observations.push(row);
  return HttpResponse.json(
    { replaced: index >= 0, ...observationList(projectId, state) },
    { status: index >= 0 ? 200 : 201 },
  );
}

const fieldError = (field: string, message: string) =>
  HttpResponse.json(
    {
      error: { code: "VALIDATION_ERROR", message, fields: { [field]: [message] } },
      request_id: "req_mock",
    },
    { status: 422 },
  );

calibrationHandlers.push(
  http.get("*/api/v1/projects/:projectId/calibration/compare", ({ params }) =>
    HttpResponse.json(compareOf(stateOf(String(params.projectId)))),
  ),
  http.get("*/api/v1/projects/:projectId/human-observations", ({ params }) => {
    const projectId = String(params.projectId);
    return HttpResponse.json(observationList(projectId, stateOf(projectId)));
  }),
  http.post("*/api/v1/projects/:projectId/human-observations", async ({ params, request }) => {
    const projectId = String(params.projectId);
    const input = (await request.json()) as ObservationInput;
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(input.participant_code)) {
      return fieldError("participant_code", "영문·숫자·밑줄·하이픈 1~40자로 입력해주세요");
    }
    return upsert(projectId, stateOf(projectId), input, "manual");
  }),
  http.post(
    "*/api/v1/projects/:projectId/human-observations/import",
    async ({ params, request }) => {
      const projectId = String(params.projectId);
      const body = (await request.json()) as {
        task_id: string;
        purpose: ObservationInput["purpose"];
        record: { schema?: string; participant_id?: string; outcome?: string };
      };
      if (body.record?.schema !== "human-record-1") {
        return fieldError("record", "recorder.js 로 저장한 결과 파일(human-record-1)이 아니에요.");
      }
      const dropout = body.record.outcome === "give_up";
      return upsert(
        projectId,
        stateOf(projectId),
        {
          participant_code: body.record.participant_id ?? "",
          task_id: body.task_id,
          outcome: dropout ? "dropout" : "success",
          stage_id: dropout ? "/cart" : undefined,
          cause: dropout ? "unknown" : undefined,
          purpose: body.purpose,
        },
        "recorder",
      );
    },
  ),
  http.delete("*/api/v1/human-observations/:id", ({ params }) => {
    const id = Number(params.id);
    for (const state of store.values()) {
      state.observations = state.observations.filter((o) => o.id !== id);
    }
    return new HttpResponse(null, { status: 204 });
  }),
);
