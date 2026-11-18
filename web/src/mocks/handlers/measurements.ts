import { http, HttpResponse } from "msw";

import type {
  MappingRowData,
  MappingStage,
  MeasurementMapping,
  MeasurementStatus,
} from "@/types/measurement.type";

/*
  실측 수집 mock (BE measurements). 프로젝트마다 키 발급·수신 여부를 메모리에 둡니다.
  - 브라우저 mock 은 키를 발급하고 설치 확인을 두 번째로 조회할 때 첫 수집이 온 것처럼 바꿉니다.
  - 테스트는 setMeasurementMock 으로 배포 주소 없음·수신 여부·예측 리포트 유무를 직접 정합니다.
  - 단계 매핑(R05)은 반찬로드 경로를 예로 씁니다. 저장하지 않은 행은 BE 처럼 자동 추천값을 보여줍니다.
*/
type Stored = {
  key: string | null;
  received: boolean;
  deployed: boolean;
  checks: number;
  predicted: boolean;
  mapping: Record<string, string | null>;
  savedAt: string | null;
};
const store = new Map<number, Stored>();
const AUTO_RECEIVE = import.meta.env.MODE !== "test";
const ORIGIN = "https://shop.example.com";

export function resetMeasurementMock() {
  store.clear();
}

export function setMeasurementMock(projectId: number, patch: Partial<Stored>) {
  store.set(projectId, { ...stateOf(projectId), ...patch });
}

function stateOf(projectId: number): Stored {
  return (
    store.get(projectId) ?? {
      key: null,
      received: false,
      deployed: true,
      checks: 0,
      predicted: true,
      mapping: {},
      savedAt: null,
    }
  );
}

function statusOf(projectId: number, s: Stored): MeasurementStatus {
  return {
    project_id: projectId,
    available: s.deployed,
    ...(s.deployed
      ? {}
      : {
          reason: "NOT_DEPLOYED" as const,
          message: "실측 분석은 실제 방문자가 오는 배포 주소가 있어야 해요.",
        }),
    origins: [ORIGIN],
    key: s.key,
    snippet: s.key
      ? `<script src="https://exitplain.store/api/v1/e.js" data-project="${s.key}" async></script>`
      : null,
    installed: Boolean(s.key && s.received),
    last_received_at: s.key && s.received ? new Date().toISOString() : null,
    last_origin: s.key && s.received ? ORIGIN : null,
    sessions_24h: s.received ? 3 : 0,
    events_24h: s.received ? 7 : 0,
  };
}

export const measurementHandlers = [
  http.get("*/api/v1/projects/:projectId/measurement", ({ params }) => {
    const projectId = Number(params.projectId);
    const s = stateOf(projectId);
    if (s.key && AUTO_RECEIVE && ++s.checks >= 2) s.received = true;
    store.set(projectId, s);
    return HttpResponse.json(statusOf(projectId, s));
  }),
  http.post("*/api/v1/projects/:projectId/measurement", ({ params }) => {
    const projectId = Number(params.projectId);
    const s = stateOf(projectId);
    if (!s.deployed) {
      return HttpResponse.json(
        {
          error: {
            code: "NOT_DEPLOYED",
            message: "실측 분석은 실제 방문자가 오는 배포 주소가 있어야 해요.",
            fields: {},
          },
          request_id: "req_mock",
        },
        { status: 409 },
      );
    }
    s.key ??= `ep_${projectId.toString(16).padStart(12, "0")}`;
    store.set(projectId, s);
    return HttpResponse.json(statusOf(projectId, s));
  }),
];

const STAGES: MappingStage[] = [
  { id: "/", name: "첫 화면", is_goal: false, tasks: ["첫 주문 완료", "쿠폰으로 주문"] },
  { id: "/products/:id", name: "상품 상세", is_goal: false, tasks: ["첫 주문 완료"] },
  { id: "/cart", name: "장바구니", is_goal: false, tasks: ["첫 주문 완료", "쿠폰으로 주문"] },
  { id: "/signup", name: "회원가입", is_goal: false, tasks: ["첫 주문 완료"] },
  { id: "/checkout", name: "배송 정보", is_goal: false, tasks: ["첫 주문 완료"] },
  { id: "/order/success", name: "주문 완료", is_goal: true, tasks: ["첫 주문 완료"] },
];

/* [단계 ID, 최근 7일 세션, 자동 추천, 추천 이유] */
const STEPS: [string, number, string | null, MappingRowData["suggestion"]][] = [
  ["/", 1240, "/", "exact"],
  ["/product/:id", 930, "/products/:id", "similar"],
  ["/cart", 546, "/cart", "exact"],
  ["/signup", 372, "/signup", "exact"],
  ["/checkout", 322, "/checkout", "exact"],
  ["/order/success", 298, "/order/success", "exact"],
  ["coupon_applied", 88, null, null],
  ["/faq", 41, null, null],
];

function mappingOf(projectId: number, s: Stored): MeasurementMapping {
  const stages = s.predicted ? STAGES : [];
  const ids = new Set(stages.map((stage) => stage.id));
  const rows = STEPS.map(([stepId, sessions, suggested, suggestion]): MappingRowData => {
    const saved = stepId in s.mapping;
    const stageId = saved ? s.mapping[stepId] : s.predicted ? suggested : null;
    return {
      step_id: stepId,
      sessions,
      events: Math.round(sessions * 1.4),
      stage_id: stageId && ids.has(stageId) ? stageId : null,
      suggested_stage_id: s.predicted ? suggested : null,
      suggestion: s.predicted ? suggestion : null,
      saved,
    };
  });
  return {
    project_id: projectId,
    days: 7,
    report_id: s.predicted ? "report-mock-1" : null,
    ...(s.predicted
      ? {}
      : {
          reason: "NO_PREDICTION" as const,
          message: "먼저 사전 테스트를 한 번 실행해야 비교할 단계가 생겨요.",
        }),
    stages,
    rows,
    mapped: rows.filter((row) => row.stage_id).length,
    saved_at: s.savedAt,
  };
}

const noKey = () =>
  HttpResponse.json(
    {
      error: { code: "NOT_FOUND", message: "아직 수집 스크립트를 발급하지 않았어요.", fields: {} },
      request_id: "req_mock",
    },
    { status: 404 },
  );

measurementHandlers.push(
  http.get("*/api/v1/projects/:projectId/measurement/mapping", ({ params }) => {
    const projectId = Number(params.projectId);
    const s = stateOf(projectId);
    return s.key ? HttpResponse.json(mappingOf(projectId, s)) : noKey();
  }),
  http.put("*/api/v1/projects/:projectId/measurement/mapping", async ({ params, request }) => {
    const projectId = Number(params.projectId);
    const s = stateOf(projectId);
    if (!s.key) return noKey();
    const body = (await request.json()) as { mapping?: Record<string, string | null> };
    const ids = new Set((s.predicted ? STAGES : []).map((stage) => stage.id));
    const bad = Object.entries(body.mapping ?? {}).filter(([, v]) => v !== null && !ids.has(v));
    if (bad.length) {
      return HttpResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "알 수 없는 퍼널 단계가 있습니다.",
            fields: Object.fromEntries(
              bad.map(([k]) => [`mapping.${k}`, ["알 수 없는 퍼널 단계입니다."]]),
            ),
          },
          request_id: "req_mock",
        },
        { status: 422 },
      );
    }
    s.mapping = { ...(body.mapping ?? {}) };
    s.savedAt = new Date().toISOString();
    store.set(projectId, s);
    return HttpResponse.json(mappingOf(projectId, s));
  }),
);
