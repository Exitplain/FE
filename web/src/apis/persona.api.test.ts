import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { server } from "@/mocks/node";
import { ApiError } from "@/types/api.type";

import { getPersonaRun } from "./persona.api";

describe("getPersonaRun", () => {
  it("실행이 없으면 idle 상태와 고정 프로필 3개를 준다", async () => {
    const run = await getPersonaRun();

    expect(run).toMatchObject({ status: "idle", id: null, sessions: [] });
    expect(run.profiles.map((profile) => profile.id)).toEqual(["quick", "careful", "patient"]);
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
