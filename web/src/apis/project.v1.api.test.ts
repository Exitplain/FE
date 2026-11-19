import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { server, TEST_CSRF_TOKEN } from "@/mocks/node";
import { createTestProject } from "@/test/projects";

import {
  deleteProjectV1,
  getMyProjects,
  getProjectDetail,
  getSampleProjects,
} from "./project.v1.api";

describe("프로젝트 보관 삭제 API", () => {
  it("DELETE에 CSRF를 보내고 본문 없는 204를 처리한다", async () => {
    let token: string | null = null;
    let body: string | undefined;
    server.use(
      http.delete("*/api/v1/projects/101", async ({ request }) => {
        token = request.headers.get("X-CSRFToken");
        body = await request.text();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    await expect(deleteProjectV1(101)).resolves.toBeUndefined();
    expect(token).toBe(TEST_CSRF_TOKEN);
    expect(body).toBe("");
  });

  it("삭제하면 활성 목록에서 빠지고, 반복 삭제는 성공하며 샘플은 유지한다", async () => {
    const id = Number(await createTestProject());
    await deleteProjectV1(id);
    await expect(deleteProjectV1(id)).resolves.toBeUndefined();
    expect((await getMyProjects()).items).toHaveLength(0);
    await expect(getProjectDetail(id)).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
    expect((await getSampleProjects()).items[0].id).toBe(1);
    // Archiving allows a new project at the same URL, with a different ID.
    const replacement = Number(await createTestProject());
    expect(replacement).not.toBe(id);
    await deleteProjectV1(id);
    expect((await getMyProjects()).items.map((project) => project.id)).toEqual([replacement]);
  });

  it("샘플 프로젝트는 403으로 보호한다", async () => {
    await expect(deleteProjectV1(1)).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
    expect((await getSampleProjects()).items).toHaveLength(1);
  });
});
