import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";

import { server, TEST_CSRF_TOKEN } from "@/mocks/node";
import { ApiError, CSRF_FAILED } from "@/types/api.type";

import axiosInstance, { resetCsrfToken } from "./axiosInstance";

const DJANGO_CSRF_403 = "<!DOCTYPE html><html><title>403 Forbidden</title></html>";

/* 요청마다 받은 X-CSRFToken 헤더를 기록하는 POST 핸들러 */
function recordCsrfHeaders(path: string, respond?: (attempt: number) => Response) {
  const seen: (string | null)[] = [];
  server.use(
    http.post(path, ({ request }) => {
      seen.push(request.headers.get("X-CSRFToken"));
      return respond?.(seen.length) ?? HttpResponse.json({ ok: true });
    }),
  );
  return seen;
}

function countCsrfIssues(token: (call: number) => string = () => TEST_CSRF_TOKEN) {
  const calls = { count: 0 };
  server.use(
    http.get("*/api/v1/auth/csrf", () => {
      calls.count += 1;
      return HttpResponse.json({ csrf_token: token(calls.count) });
    }),
  );
  return calls;
}

describe("CSRF 토큰", () => {
  it("제품 API POST 에 X-CSRFToken 을 붙이고, 토큰은 한 번만 받는다", async () => {
    const issues = countCsrfIssues();
    const seen = recordCsrfHeaders("*/api/v1/things");

    await Promise.all([
      axiosInstance.post("/api/v1/things", {}),
      axiosInstance.post("/api/v1/things", {}),
    ]);
    await axiosInstance.post("/api/v1/things", {});

    expect(seen).toEqual([TEST_CSRF_TOKEN, TEST_CSRF_TOKEN, TEST_CSRF_TOKEN]);
    expect(issues.count).toBe(1);
  });

  it("GET 과 개발 API 에는 붙이지 않는다", async () => {
    const issues = countCsrfIssues();
    const getHeaders: (string | null)[] = [];
    server.use(
      http.get("*/api/v1/things", ({ request }) => {
        getHeaders.push(request.headers.get("X-CSRFToken"));
        return HttpResponse.json({});
      }),
    );
    const devSeen = recordCsrfHeaders("*/api/personas/discover");

    await axiosInstance.get("/api/v1/things");
    await axiosInstance.post("/api/personas/discover", { variant: "problem" });

    expect(getHeaders).toEqual([null]);
    expect(devSeen).toEqual([null]);
    expect(issues.count).toBe(0);
  });

  it("CSRF 403(HTML)이면 토큰을 새로 받아 한 번만 다시 보낸다", async () => {
    const issues = countCsrfIssues((call) => `token-${call}`);
    const seen = recordCsrfHeaders("*/api/v1/things", (attempt) =>
      attempt === 1
        ? new HttpResponse(DJANGO_CSRF_403, {
            status: 403,
            headers: { "Content-Type": "text/html" },
          })
        : HttpResponse.json({ ok: true }),
    );

    const { data } = await axiosInstance.post("/api/v1/things", {});

    expect(data).toEqual({ ok: true });
    expect(seen).toEqual(["token-1", "token-2"]);
    expect(issues.count).toBe(2);
  });

  it("다시 보내도 CSRF 403 이면 CSRF_FAILED 로 끝낸다", async () => {
    const seen = recordCsrfHeaders(
      "*/api/v1/things",
      () =>
        new HttpResponse(DJANGO_CSRF_403, {
          status: 403,
          headers: { "Content-Type": "text/html" },
        }),
    );

    const request = axiosInstance.post("/api/v1/things", {});

    await expect(request).rejects.toMatchObject({ status: 403, code: CSRF_FAILED });
    expect(seen).toHaveLength(2);
  });

  it("BE 가 준 JSON 403 은 권한 오류라 다시 보내지 않는다", async () => {
    const seen = recordCsrfHeaders("*/api/v1/things", () =>
      HttpResponse.json(
        {
          error: { code: "FORBIDDEN", message: "권한이 없습니다.", fields: {} },
          request_id: "req_1",
        },
        { status: 403 },
      ),
    );

    await expect(axiosInstance.post("/api/v1/things", {})).rejects.toMatchObject({
      status: 403,
      code: "FORBIDDEN",
    });
    expect(seen).toHaveLength(1);
  });

  it("토큰을 받지 못하면 토큰 없이 보낸다", async () => {
    server.use(http.get("*/api/v1/auth/csrf", () => HttpResponse.error()));
    const seen = recordCsrfHeaders("*/api/v1/things");

    await axiosInstance.post("/api/v1/things", {});

    expect(seen).toEqual([null]);
  });

  it("옛 토큰으로 보낸 요청들이 동시에 403 이어도 토큰은 한 번만 새로 받는다", async () => {
    const issues = countCsrfIssues((call) => `token-${call}`);
    const seen = recordCsrfHeaders("*/api/v1/things", () => HttpResponse.json({ ok: true }));
    server.use(
      http.post("*/api/v1/things", ({ request }) => {
        if (request.headers.get("X-CSRFToken") !== "token-1") return;
        seen.push("token-1");
        return new HttpResponse(DJANGO_CSRF_403, { status: 403 });
      }),
    );

    const results = await Promise.all([
      axiosInstance.post("/api/v1/things", {}),
      axiosInstance.post("/api/v1/things", {}),
    ]);

    expect(results.map(({ data }) => data)).toEqual([{ ok: true }, { ok: true }]);
    expect(issues.count).toBe(2);
    expect(seen).toEqual(["token-1", "token-1", "token-2", "token-2"]);
  });

  it("발급 중에 reset 하면 늦게 온 옛 토큰을 저장하지 않는다", async () => {
    let release = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    const issues = countCsrfIssues((call) => `token-${call}`);
    server.use(
      http.get("*/api/v1/auth/csrf", async () => {
        issues.count += 1;
        if (issues.count === 1) {
          await gate;
          return HttpResponse.json({ csrf_token: "stale" });
        }
        return HttpResponse.json({ csrf_token: "fresh" });
      }),
    );
    const seen = recordCsrfHeaders("*/api/v1/things");

    const first = axiosInstance.post("/api/v1/things", {});
    await vi.waitFor(() => expect(issues.count).toBe(1));
    resetCsrfToken();
    release();
    await first;
    await axiosInstance.post("/api/v1/things", {});

    expect(seen).toEqual(["stale", "fresh"]);
    expect(issues.count).toBe(2);
  });

  it("PATCH 도 다시 보낼 때 원래 본문을 그대로 보낸다", async () => {
    const bodies: unknown[] = [];
    server.use(
      http.patch("*/api/v1/plans/:id", async ({ request }) => {
        bodies.push(await request.json());
        return bodies.length === 1
          ? new HttpResponse(DJANGO_CSRF_403, { status: 403 })
          : HttpResponse.json({ ok: true });
      }),
    );

    await axiosInstance.patch("/api/v1/plans/1", { task_ids: ["order"] });

    expect(bodies).toEqual([{ task_ids: ["order"] }, { task_ids: ["order"] }]);
  });
});

describe("제품 API 오류 본문", () => {
  it("code·fields·request_id 를 ApiError 에 담는다", async () => {
    server.use(
      http.post("*/api/v1/plans/:id/confirmations", () =>
        HttpResponse.json(
          {
            error: {
              code: "NO_TASKS",
              message: "과업을 선택해 주세요.",
              fields: { blocking: ["NO_TASKS", "NO_AUDIENCE"] },
            },
            request_id: "req_abc",
          },
          { status: 409 },
        ),
      ),
    );

    const request = axiosInstance.post("/api/v1/plans/1/confirmations", { revision: 1 });

    await expect(request).rejects.toBeInstanceOf(ApiError);
    await expect(request).rejects.toMatchObject({
      status: 409,
      code: "NO_TASKS",
      message: "과업을 선택해 주세요.",
      fields: { blocking: ["NO_TASKS", "NO_AUDIENCE"] },
      requestId: "req_abc",
    });
  });
});
