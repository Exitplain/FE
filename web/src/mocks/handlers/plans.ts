import { delay, http, HttpResponse } from "msw";

import { MockApiError } from "../personaMock";
import {
  checkSite,
  confirmPlan,
  createDiscovery,
  createPlan,
  createRun,
  getDiscovery,
  getPlan,
  getTestAccounts,
  MockPlanError,
  patchPlan,
  putTestAccounts,
  revisionPersonas,
  startDiscovery,
} from "../planMock";

/*
  제품 API 새 테스트 위저드 mock 핸들러 (mocks/planMock.ts).
  mock 은 로그인·소유자를 따지지 않습니다 (실서버는 모두 로그인 + 프로젝트 소유자만).
*/

function productError(status: number, code: string, message: string, fields: object = {}) {
  return HttpResponse.json(
    { error: { code, message, fields }, request_id: "req_mock" },
    { status },
  );
}

async function handle(
  run: () => unknown | Promise<unknown>,
  status = 200,
  headers?: () => HeadersInit,
) {
  try {
    const body = await run();
    return HttpResponse.json(body as object, { status, headers: headers?.() });
  } catch (error) {
    if (error instanceof MockPlanError) {
      return productError(error.status, error.code, error.message, error.fields);
    }
    if (error instanceof MockApiError) return productError(error.status, "ERROR", error.message);
    if (error instanceof SyntaxError)
      return productError(400, "INVALID_JSON", "JSON 본문을 확인해주세요.");
    throw error;
  }
}

/* 브라우저 mock 에서 탐색 로딩 화면이 잠깐 보이도록 늦춥니다 (테스트는 바로 응답) */
const DISCOVERY_DELAY_MS = import.meta.env.MODE === "test" ? 0 : 1200;

async function json(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text();
  return text ? (JSON.parse(text) as Record<string, unknown>) : {};
}

const projectIdOf = (params: Record<string, unknown>) => Number(params.projectId);

export const planHandlers = [
  http.post("*/api/v1/projects/:projectId/check", ({ params }) =>
    handle(() => checkSite(projectIdOf(params))),
  ),
  http.post("*/api/v1/projects/:projectId/discoveries", async ({ params, request }) => {
    /* Prefer: respond-async 면 BE 처럼 running 으로 바로 202, 진행은 GET 으로 */
    if (request.headers.get("Prefer")?.includes("respond-async")) {
      return handle(async () => startDiscovery(projectIdOf(params), await json(request)), 202);
    }
    await delay(DISCOVERY_DELAY_MS);
    return handle(async () => createDiscovery(projectIdOf(params), await json(request)), 201);
  }),
  http.get("*/api/v1/discoveries/:discoveryId", ({ params }) =>
    handle(() => getDiscovery(String(params.discoveryId))),
  ),
  http.post("*/api/v1/projects/:projectId/plans", async ({ params, request }) => {
    let revision = 1;
    return handle(
      async () => {
        const plan = createPlan(projectIdOf(params), await json(request));
        revision = plan.revision;
        return plan;
      },
      201,
      () => ({ ETag: `"${revision}"` }),
    );
  }),
  http.get("*/api/v1/plans/:planId", ({ params }) => {
    let revision = 0;
    return handle(
      () => {
        const plan = getPlan(String(params.planId));
        revision = plan.revision;
        return plan;
      },
      200,
      () => ({ ETag: `"${revision}"` }),
    );
  }),
  http.patch("*/api/v1/plans/:planId", async ({ params, request }) => {
    let revision = 0;
    return handle(
      async () => {
        const plan = patchPlan(
          String(params.planId),
          request.headers.get("If-Match"),
          await json(request),
        );
        revision = plan.revision;
        return plan;
      },
      200,
      () => ({ ETag: `"${revision}"` }),
    );
  }),
  http.post("*/api/v1/plans/:planId/confirmations", async ({ params, request }) =>
    handle(async () => confirmPlan(String(params.planId), await json(request)), 201),
  ),
  http.get("*/api/v1/plan-revisions/:revisionId/personas", ({ params }) =>
    handle(() => revisionPersonas(String(params.revisionId))),
  ),
  http.get("*/api/v1/projects/:projectId/test-accounts", ({ params }) =>
    handle(() => getTestAccounts(projectIdOf(params))),
  ),
  http.put("*/api/v1/projects/:projectId/test-accounts", async ({ params, request }) =>
    handle(async () => putTestAccounts(projectIdOf(params), await json(request))),
  ),
  http.post("*/api/v1/runs", async ({ request }) => {
    let replayed = false;
    return handle(
      async () => {
        const result = createRun(await json(request), request.headers.get("Idempotency-Key"));
        replayed = result.replayed;
        return {
          run_id: result.run_id,
          status: "queued",
          status_url: `/api/v1/runs/${result.run_id}`,
        };
      },
      202,
      (): HeadersInit => (replayed ? { "Idempotent-Replayed": "true" } : {}),
    );
  }),
];

/* 테스트에서 server.use(...) 로 바꿔 끼우는 오류 응답 */
export const planErrorHandlers = {
  discoveryUnauthorized: http.post("*/api/v1/projects/:projectId/check", () =>
    productError(401, "AUTH_REQUIRED", "로그인이 필요합니다."),
  ),
  discoveryForbidden: http.post("*/api/v1/projects/:projectId/check", () =>
    productError(403, "FORBIDDEN", "이 프로젝트에 접근할 권한이 없습니다."),
  ),
  siteUnreachable: http.post("*/api/v1/projects/:projectId/discoveries", () =>
    productError(
      503,
      "SITE_UNREACHABLE",
      "사이트를 살펴보지 못했습니다. 잠시 뒤 다시 확인해주세요.",
    ),
  ),
  discoveryNetworkError: http.post("*/api/v1/projects/:projectId/discoveries", () =>
    HttpResponse.error(),
  ),
  checkFailed: http.post("*/api/v1/projects/:projectId/check", ({ params }) =>
    HttpResponse.json({
      project_id: Number(params.projectId),
      check: {
        status: "failed",
        http_status: null,
        elapsed_ms: 3000,
        checked_at: new Date().toISOString(),
        reason: "DNS_FAILED",
        message: "주소를 찾을 수 없어요. 도메인을 다시 확인해주세요",
      },
    }),
  ),
  personaGenerationFailed: http.post("*/api/v1/plans/:planId/confirmations", () =>
    productError(503, "PERSONA_GENERATION_FAILED", "페르소나를 만들지 못했습니다: 생성기 오류"),
  ),
  confirmExpired: http.post("*/api/v1/plans/:planId/confirmations", () =>
    productError(409, "DISCOVERY_EXPIRED", "사이트 확인 결과가 만료됐습니다.", {
      blocking: ["DISCOVERY_EXPIRED"],
    }),
  ),
  runInProgress: http.post("*/api/v1/runs", () =>
    productError(
      409,
      "RUN_IN_PROGRESS",
      "이미 진행 중인 실행이 있어요. 끝난 뒤에 다시 시작해주세요.",
    ),
  ),
  runInvalid: http.post("*/api/v1/runs", () =>
    productError(422, "RUN_INPUT_INVALID", "실행 입력을 만들지 못했습니다."),
  ),
};
