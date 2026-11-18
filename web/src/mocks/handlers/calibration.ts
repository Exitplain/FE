import { http, HttpResponse } from "msw";

import type { CalibrationProposal, CalibrationRecord } from "@/types/calibration.type";

import { CALIBRATIONS, sampleProposal } from "../fixtures/calibration";

/*
  보정 mock (BE calibrations). 프로젝트마다 이력·조정안 상태를 메모리에 둡니다.
  - 기본: 반찬로드(1)는 조정안 있음, 그 밖은 실측 미연결(NOT_CONNECTED)
  - 테스트는 setCalibrationMock 으로 조정안 상태(reason)를 정합니다
  - 적용하면 새 기록이 생기고, 다음 사전 테스트 전까지 조정안은 WAITING_NEXT_RUN (BE 와 같음)
*/
type State = { history: CalibrationRecord[]; reason: CalibrationProposal["reason"] | null };
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
  };
  store.set(projectId, fresh);
  return fresh;
}

const MESSAGES: Record<string, string> = {
  NOT_CONNECTED: "실측 데이터를 먼저 연결해 주세요.",
  NOT_MAPPED: "단계 매핑을 먼저 저장해 주세요.",
  NO_PREDICTION: "먼저 사전 테스트를 한 번 실행해야 비교할 수 있어요.",
  INSUFFICIENT_SAMPLE: "실측 세션이 단계마다 100개는 모여야 조정안을 만들 수 있어요.",
  NO_GAP: "모든 단계가 예측 범위 안이라 바꿀 값이 없어요.",
  WAITING_NEXT_RUN:
    "보정을 적용한 뒤 아직 새 사전 테스트가 없어요. 다음 사전 테스트가 끝나면 다시 비교해요.",
};

function revisionOf(state: State) {
  return state.history[0]?.revision ?? 0;
}

function proposalOf(projectId: string): CalibrationProposal {
  const state = stateOf(projectId);
  const full = sampleProposal(Number(projectId), revisionOf(state));
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
        message: "다른 보정이 먼저 적용됐어요. 새로고침한 뒤 다시 확인해 주세요.",
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
  http.get("*/api/v1/projects/:projectId/calibration/proposal", ({ params }) =>
    HttpResponse.json(proposalOf(String(params.projectId))),
  ),
  http.post("*/api/v1/projects/:projectId/calibrations", async ({ params, request }) => {
    const projectId = String(params.projectId);
    const state = stateOf(projectId);
    const body = (await request.json()) as { expected_revision: number; keys: string[] };
    if (body.expected_revision !== revisionOf(state)) return conflict();
    const proposal = proposalOf(projectId);
    const chosen = proposal.items.filter((item) => body.keys.includes(item.key));
    const created = record(state, {
      changes: chosen,
      changes_summary: chosen
        .map((c) => `${c.segment_name} ${c.label} ${c.current.toFixed(2)}→${c.proposed.toFixed(2)}`)
        .join(" · "),
      base_comparison: "3차 vs 실측 최근 7일",
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
