import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { idlePersonaRun } from "@/mocks/fixtures/personas";
import { server } from "@/mocks/node";
import { ApiError } from "@/types/api.type";

import { getPersonaRun } from "./persona.api";

describe("getPersonaRun", () => {
  it("mock 핸들러의 실행 상태를 그대로 돌려준다", async () => {
    await expect(getPersonaRun()).resolves.toEqual(idlePersonaRun);
  });

  it("개발 API 오류 본문 { error: string } 을 ApiError 로 바꾼다", async () => {
    server.use(
      http.get("*/api/personas", () =>
        HttpResponse.json({ error: "실행 중인 테스트가 있습니다." }, { status: 409 }),
      ),
    );

    const request = getPersonaRun();

    await expect(request).rejects.toBeInstanceOf(ApiError);
    await expect(request).rejects.toMatchObject({
      status: 409,
      message: "실행 중인 테스트가 있습니다.",
    });
  });
});
