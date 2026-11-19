import { http, HttpResponse } from "msw";

import type {
  MeasurementImport,
  MeasurementImportResult,
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
  /* CSV 로 올린 로그 */
  imports: MeasurementImport[];
};
const store = new Map<number, Stored>();
/* 올린 CSV 내용 (같은 파일 409) */
const contents = new Map<number, Set<string>>();
const AUTO_RECEIVE = import.meta.env.MODE !== "test";
const ORIGIN = "https://shop.example.com";

export function resetMeasurementMock() {
  store.clear();
  contents.clear();
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
      imports: [],
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
    mapping_saved_at: s.key || s.imports.length ? s.savedAt : null,
    imports: {
      count: s.imports.length,
      sessions: s.imports.reduce((sum, item) => sum + item.sessions, 0),
      last_at: s.imports[0]?.created_at ?? null,
    },
  };
}

function productError(status: number, code: string, message: string, fields = {}) {
  return HttpResponse.json(
    { error: { code, message, fields }, request_id: "req_mock" },
    { status },
  );
}

/* BE csv_import 와 같은 규칙을 간단히: 머리글 필수 열, 줄마다 session_id·timestamp·path 검사 */
function importCsv(
  text: string,
  filename: string,
  nextId: number,
): MeasurementImportResult | Response {
  const [header = "", ...lines] = text
    .replace(/^\ufeff/, "")
    .trim()
    .split(/\r?\n/);
  const columns = header.split(",").map((name) => name.trim().toLowerCase());
  const missing = ["session_id", "timestamp", "path"].filter((name) => !columns.includes(name));
  if (missing.length) {
    return productError(422, "VALIDATION_ERROR", `필수 열이 없어요: ${missing.join(", ")}`);
  }
  const at = (name: string, cells: string[]) => cells[columns.indexOf(name)]?.trim() ?? "";
  const errors: MeasurementImportResult["errors"] = [];
  const sessions = new Set<string>();
  const times: number[] = [];
  lines.forEach((line, index) => {
    const cells = line.split(",");
    const time = Date.parse(at("timestamp", cells).replace(" ", "T"));
    const path = at("path", cells);
    if (!at("session_id", cells))
      errors.push({ line: index + 2, message: "session_id 가 비었거나 너무 길어요" });
    else if (Number.isNaN(time))
      errors.push({
        line: index + 2,
        message: "timestamp 형식을 읽지 못했어요 (예: 2026-11-18 14:03:22)",
      });
    else if (!path.startsWith("/") && !/^https?:\/\//.test(path))
      errors.push({ line: index + 2, message: "path 는 /로 시작하는 경로나 전체 주소여야 해요" });
    else {
      sessions.add(at("session_id", cells));
      times.push(time);
    }
  });
  if (times.length === 0) {
    return productError(
      422,
      "NO_VALID_ROWS",
      "넣을 수 있는 줄이 없어요. 형식과 최근 30일 안의 기록인지 확인해 주세요.",
      {
        rows: errors.map((error) => `${error.line}번째 줄: ${error.message}`),
      },
    );
  }
  return {
    id: nextId,
    filename,
    rows_total: lines.length,
    rows_imported: times.length,
    sessions: sessions.size,
    first_at: new Date(Math.min(...times)).toISOString(),
    last_at: new Date(Math.max(...times)).toISOString(),
    created_at: new Date().toISOString(),
    skipped: { invalid: errors.length, outside_window: 0, duplicate: 0 },
    errors: errors.slice(0, 20),
  };
}

const TEMPLATE =
  "\ufeffsession_id,timestamp,path,step,device\n" +
  "a81f3c,2026-11-18 14:03:22,/,,desktop\n" +
  "a81f3c,2026-11-18 14:04:05,/cart,cart,desktop\n";

export const measurementHandlers = [
  http.get("*/api/v1/projects/:projectId/measurement/imports", ({ params }) =>
    HttpResponse.json({ items: stateOf(Number(params.projectId)).imports }),
  ),
  http.post("*/api/v1/projects/:projectId/measurement/imports", async ({ params, request }) => {
    const projectId = Number(params.projectId);
    const s = stateOf(projectId);
    /*
      jsdom 은 FormData 본문을 formData() 로 다시 읽지 못해 multipart 본문에서 파일 부분을 직접 꺼냅니다
      (파일 이름도 "blob" 으로 올 수 있어 같은 파일 여부는 내용으로 봅니다)
    */
    const raw = await request.text();
    const part =
      /name="file"(?:; filename="([^"]*)")?\r?\n(?:[^\r\n]+\r?\n)*\r?\n([\s\S]*?)\r?\n--/.exec(raw);
    if (!part) return productError(422, "VALIDATION_ERROR", "CSV 파일을 올려 주세요.");
    const [, filename = "upload.csv", text] = part;
    if (contents.get(projectId)?.has(text)) {
      return productError(409, "DUPLICATE_IMPORT", "이미 올린 파일이에요.");
    }
    const result = importCsv(text, filename, s.imports.length + 1);
    if (result instanceof Response) return result;
    const item: MeasurementImport = {
      id: result.id,
      filename: result.filename,
      rows_total: result.rows_total,
      rows_imported: result.rows_imported,
      sessions: result.sessions,
      first_at: result.first_at,
      last_at: result.last_at,
      created_at: result.created_at,
    };
    s.imports = [item, ...s.imports];
    store.set(projectId, s);
    contents.set(projectId, new Set([...(contents.get(projectId) ?? []), text]));
    return HttpResponse.json(result, { status: 201 });
  }),
  http.delete("*/api/v1/projects/:projectId/measurement/imports/:importId", ({ params }) => {
    const projectId = Number(params.projectId);
    const s = stateOf(projectId);
    s.imports = s.imports.filter((item) => item.id !== Number(params.importId));
    store.set(projectId, s);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get("*/api/v1/projects/:projectId/measurement/csv-template", () =>
    HttpResponse.text(TEMPLATE, { headers: { "Content-Type": "text/csv; charset=utf-8" } }),
  ),
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
