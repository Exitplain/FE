import { http, HttpResponse } from "msw";

import type { V1ProjectDetail, V1ProjectSummary } from "@/types/project.v1.type";

import { runList } from "../personaMock";

/*
  제품 API(/api/v1) 프로젝트·실행 목록 mock.
  - 샘플 프로젝트: 실서버와 같은 반찬로드 하나 (id 1)
  - 내 프로젝트: POST /api/v1/projects 로 만든 것만 메모리에 둡니다 (resetProjectMock 으로 비움)
  - 실행 목록: 개발 API mock 의 실행으로 만듭니다 (personaMock.runList). 샘플이 아닌 프로젝트는 빈 목록입니다.
    다른 P 화면이 아직 개발 API 를 써서 mock 에서 같은 실행을 보도록 남겨 둡니다. P 화면이 모두 옮겨지면 지웁니다.
  mock 은 로그인 여부를 따지지 않습니다. (실서버는 내 프로젝트 목록·만들기에 로그인이 필요)
*/
const SAMPLE_DETAIL: V1ProjectDetail = {
  id: 1,
  name: "반찬로드",
  entry_url: "https://banchanroad.example/",
  domain: "banchanroad.example",
  is_sample: true,
  archived_at: null,
  last_pretest: null,
  updated_at: "2026-11-14T14:07:20.325695+00:00",
  allowed_origins: ["https://banchanroad.example"],
  login_mode: "none",
  journey_note: "",
  check: { status: "unchecked", http_status: null, elapsed_ms: null, checked_at: null },
  runs: { total: 0, active: 0, last_pretest: null },
  created_at: "2026-11-14T14:07:20.325695+00:00",
};

function toSummary(project: V1ProjectDetail): V1ProjectSummary {
  const { id, name, entry_url, domain, is_sample, archived_at, last_pretest, updated_at } = project;
  return { id, name, entry_url, domain, is_sample, archived_at, last_pretest, updated_at };
}

export const MOCK_SAMPLE_PROJECTS: V1ProjectSummary[] = [toSummary(SAMPLE_DETAIL)];

const FIRST_CREATED_ID = 101;
let created: V1ProjectDetail[] = [];

export function resetProjectMock() {
  created = [];
}

function findProject(id: string | readonly string[] | undefined) {
  return [SAMPLE_DETAIL, ...created].find((project) => String(project.id) === id);
}

function fieldError(field: string, message: string, status = 422, code = "VALIDATION_ERROR") {
  return HttpResponse.json(
    { error: { code, message, fields: { [field]: [message] } }, request_id: "req_mock" },
    { status },
  );
}

/* BE projects.services 의 주소 정규화 (소문자 · 빈 경로는 "/") */
function normalizeUrl(value: string) {
  const url = new URL(value);
  url.hash = "";
  return url.href;
}

const DEFAULT_LIMIT = 20;

/* 커서는 다음 페이지가 시작할 위치입니다 (BE 는 불투명 문자열) */
function paginate<T>(items: T[], url: URL) {
  const limit = Number(url.searchParams.get("limit")) || DEFAULT_LIMIT;
  const start = Number(url.searchParams.get("cursor")) || 0;
  const page = items.slice(start, start + limit);
  const next = start + limit < items.length ? String(start + limit) : null;
  return { items: page, next_cursor: next, total: items.length };
}

export const projectHandlers = [
  http.get("*/api/v1/sample/projects", () =>
    HttpResponse.json({
      items: structuredClone(MOCK_SAMPLE_PROJECTS),
      next_cursor: null,
      total: MOCK_SAMPLE_PROJECTS.length,
    }),
  ),
  http.get("*/api/v1/projects", ({ request }) =>
    HttpResponse.json(paginate([...created].reverse().map(toSummary), new URL(request.url))),
  ),
  http.post("*/api/v1/projects", async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const entry = typeof body.entry_url === "string" ? body.entry_url.trim() : "";
    const journey = typeof body.journey_note === "string" ? body.journey_note : "";
    if (!name) return fieldError("name", "프로젝트 이름을 입력해주세요");
    let entryUrl: string;
    try {
      entryUrl = normalizeUrl(entry);
      if (!/^https?:$/.test(new URL(entryUrl).protocol)) throw new Error("protocol");
    } catch {
      return fieldError("entry_url", "HTTP 또는 HTTPS로 시작하는 주소를 입력해주세요");
    }
    if ([SAMPLE_DETAIL, ...created].some((project) => project.entry_url === entryUrl))
      return fieldError("entry_url", "이미 등록된 프로젝트입니다.", 409, "DUPLICATE_PROJECT");
    const now = new Date().toISOString();
    const url = new URL(entryUrl);
    const project: V1ProjectDetail = {
      ...structuredClone(SAMPLE_DETAIL),
      id: FIRST_CREATED_ID + created.length,
      name,
      entry_url: entryUrl,
      domain: url.hostname,
      is_sample: false,
      journey_note: journey,
      allowed_origins: [url.origin],
      updated_at: now,
      created_at: now,
    };
    created.push(project);
    return HttpResponse.json(structuredClone(project), { status: 201 });
  }),
  http.get("*/api/v1/projects/:projectId", ({ params }) => {
    const project = findProject(params.projectId);
    if (!project)
      return HttpResponse.json(
        { error: { code: "NOT_FOUND", message: "프로젝트를 찾을 수 없습니다.", fields: {} } },
        { status: 404 },
      );
    return HttpResponse.json(structuredClone(project));
  }),
  http.get("*/api/v1/projects/:projectId/runs", ({ params, request }) => {
    const known = MOCK_SAMPLE_PROJECTS.some((p) => String(p.id) === params.projectId);
    const url = new URL(request.url);
    const items = known ? runList({ progress: !url.searchParams.get("cursor") }) : [];
    return HttpResponse.json(paginate(items, url));
  }),
];

/* 테스트에서 server.use(...) 로 바꿔 끼우는 오류 응답 */
export const projectErrorHandlers = {
  runsNetworkError: http.get("*/api/v1/projects/:projectId/runs", () => HttpResponse.error()),
  sampleProjectsNetworkError: http.get("*/api/v1/sample/projects", () => HttpResponse.error()),
  projectUnauthorized: http.get("*/api/v1/projects/:projectId", () =>
    HttpResponse.json(
      { error: { code: "AUTH_REQUIRED", message: "로그인이 필요합니다.", fields: {} } },
      { status: 401 },
    ),
  ),
  projectForbidden: http.get("*/api/v1/projects/:projectId", () =>
    HttpResponse.json(
      { error: { code: "FORBIDDEN", message: "권한이 없습니다.", fields: {} } },
      { status: 403 },
    ),
  ),
};
