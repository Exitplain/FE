import { http, HttpResponse } from "msw";

import type {
  FunnelStageCompare,
  FunnelTaskCompare,
  MappingRowData,
  MappingStage,
  MeasurementFunnel,
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
  /* 실측 퍼널 세션 수 배율 (테스트에서 표본 부족을 흉내 낼 때 줄입니다) */
  scale: number;
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
      scale: 1,
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
          message: "실제 고객 데이터 분석은 실제 방문자가 오는 배포 주소가 있어야 해요.",
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
    mapping_saved_at: s.key ? s.savedAt : null,
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
            message: "실제 고객 데이터 분석은 실제 방문자가 오는 배포 주소가 있어야 해요.",
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
            message: "알 수 없는 이동 단계가 있습니다.",
            fields: Object.fromEntries(
              bad.map(([k]) => [`mapping.${k}`, ["알 수 없는 이동 단계입니다."]]),
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

/* R06·R08 — 과업별 [단계 ID, 예측 범위(%), 최근 7일 전체 세션] (반찬로드 예시) */
const FUNNEL_TASKS: { id: string; name: string; stages: [string, [number, number], number][] }[] = [
  {
    id: "order",
    name: "첫 주문 완료",
    stages: [
      ["/", [92, 100], 1240],
      ["/products/:id", [70, 80], 930],
      ["/cart", [55, 65], 546],
      ["/signup", [30, 40], 372],
      ["/checkout", [25, 35], 322],
      ["/order/success", [20, 30], 298],
    ],
  },
  {
    id: "coupon",
    name: "쿠폰으로 주문",
    stages: [
      ["/", [92, 100], 1240],
      ["/cart", [38, 52], 546],
      ["/order/success", [20, 32], 298],
    ],
  },
];
const DAY_SCALE: Record<string, number> = { "7": 1, "14": 2.1, "30": 4.4 };
const DEVICE_SHARE: Record<string, number> = { all: 1, mobile: 0.69, desktop: 0.31 };
const MIN_SAMPLE = 100;

const round1 = (n: number) => Math.round(n * 10) / 10;

function dropOf(stages: FunnelStageCompare[], value: (s: FunnelStageCompare) => number | null) {
  let best: { size: number; from: FunnelStageCompare; to: FunnelStageCompare } | null = null;
  const points = stages.filter((s) => value(s) != null);
  points.slice(1).forEach((to, i) => {
    const from = points[i];
    const size = (value(from) ?? 0) - (value(to) ?? 0);
    if (!best || size > best.size) best = { size, from, to };
  });
  const found = best as { from: FunnelStageCompare; to: FunnelStageCompare } | null;
  return found
    ? { from: found.from.id, to: found.to.id, label: `${found.from.name}→${found.to.name}` }
    : null;
}

function funnelOf(projectId: number, s: Stored, days: string, device: string): MeasurementFunnel {
  const names = new Map(STAGES.map((stage) => [stage.id, stage.name]));
  const mapped = new Set(
    mappingOf(projectId, s)
      .rows.map((row) => row.stage_id)
      .filter(Boolean),
  );
  const factor = (DAY_SCALE[days] ?? 1) * (DEVICE_SHARE[device] ?? 1) * s.scale;
  const tasks = FUNNEL_TASKS.map((task): FunnelTaskCompare => {
    const base = Math.round(task.stages[0][2] * factor);
    const stages = task.stages.map(([id, [low, high], count], index): FunnelStageCompare => {
      const sessions = Math.round(count * factor);
      const rate = mapped.has(id) && base ? round1((sessions / base) * 100) : null;
      const mid = (low + high) / 2;
      /* 첫 단계는 기준(100%)이라 비교하지 않습니다 (BE 와 같음) */
      const compared = index > 0 && rate != null;
      return {
        id,
        name: names.get(id) ?? id,
        is_goal: id === "/order/success",
        predicted: { low, high, mid, reached: 0, valid: 20 },
        actual: mapped.has(id) ? { sessions, rate } : null,
        error: compared && rate != null ? round1(rate - mid) : null,
        gap: compared && rate != null && (rate < low || rate > high),
        compared,
        short_sample: mapped.has(id) && sessions < MIN_SAMPLE,
      };
    });
    const errors = stages.filter((st) => st.error != null).map((st) => Math.abs(st.error ?? 0));
    const predicted = dropOf(stages, (st) => st.predicted.mid);
    const actual = dropOf(stages, (st) => st.actual?.rate ?? null);
    return {
      task_id: task.id,
      name: task.name,
      base_sessions: base,
      collecting: base < MIN_SAMPLE,
      stages,
      mapped_stages: stages.filter((st) => st.actual).length,
      compared_stages: stages.filter((st) => st.compared).length,
      mean_error: errors.length
        ? round1(errors.reduce((sum, e) => sum + e, 0) / errors.length)
        : null,
      gaps: stages.filter((st) => st.gap).map((st) => st.id),
      max_drop: {
        predicted,
        actual,
        matched: Boolean(
          predicted && actual && predicted.from === actual.from && predicted.to === actual.to,
        ),
      },
    };
  });
  const until = new Date();
  return {
    project_id: projectId,
    days: Number(days),
    device: device as MeasurementFunnel["device"],
    since: new Date(until.getTime() - Number(days) * 86400000).toISOString(),
    until: until.toISOString(),
    min_sample: MIN_SAMPLE,
    report: s.predicted
      ? {
          report_id: "report-mock-1",
          created_at: "2026-11-07T09:00:00+09:00",
          run_sequence: 3,
          run_id: "run-mock-base",
          plan_revision_id: "plan-rev-mock",
          segments: [
            { id: "segment_1", name: "빠른 구매형", count: 5 },
            { id: "segment_2", name: "꼼꼼한 비교형", count: 5 },
            { id: "segment_3", name: "가격 민감형", count: 5 },
            { id: "segment_4", name: "신중한 첫 방문형", count: 5 },
          ],
        }
      : null,
    mapping_saved: Boolean(s.savedAt),
    ...(s.predicted
      ? {}
      : {
          reason: "NO_PREDICTION" as const,
          message: "먼저 사전 테스트를 한 번 실행해야 비교할 단계가 생겨요.",
        }),
    tasks: s.predicted ? tasks : [],
  };
}

measurementHandlers.push(
  http.get("*/api/v1/projects/:projectId/measurement/funnel", ({ params, request }) => {
    const projectId = Number(params.projectId);
    const s = stateOf(projectId);
    if (!s.key) return noKey();
    const url = new URL(request.url);
    return HttpResponse.json(
      funnelOf(
        projectId,
        s,
        url.searchParams.get("days") ?? "7",
        url.searchParams.get("device") ?? "all",
      ),
    );
  }),
);
