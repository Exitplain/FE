import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { projectErrorHandlers } from "@/mocks/handlers/projects";
import { server } from "@/mocks/node";
import { createTestProject } from "@/test/projects";

import { displayUrl, getProjects, toProjectRecord } from "./project.api";
import { getProjectDetail } from "./project.v1.api";

describe("화면용 프로젝트 (apis/project.api)", () => {
  it("내 프로젝트를 샘플보다 먼저, 같은 id 는 한 번만 둔다", async () => {
    await createTestProject();

    expect((await getProjects()).map((project) => project.id)).toEqual(["101", "1"]);
  });

  it("로그인하지 않았으면(401) 샘플만 보여 준다", async () => {
    server.use(
      http.get("*/api/v1/projects", () =>
        HttpResponse.json(
          { error: { code: "AUTH_REQUIRED", message: "로그인이 필요합니다.", fields: {} } },
          { status: 401 },
        ),
      ),
    );

    expect((await getProjects()).map((project) => project.name)).toEqual(["반찬로드"]);
  });

  it("샘플 목록만 실패하면 내 프로젝트는 그대로 보여 주고, 둘 다 실패해야 오류다", async () => {
    await createTestProject();
    server.use(projectErrorHandlers.sampleProjectsNetworkError);
    expect((await getProjects()).map((project) => project.id)).toEqual(["101"]);

    server.use(http.get("*/api/v1/projects", () => HttpResponse.error()));
    await expect(getProjects()).rejects.toThrow();
  });

  it("주소는 빈 경로의 끝 슬래시만 떼고 보여 준다", () => {
    expect(displayUrl("https://banchanroad.example/")).toBe("https://banchanroad.example");
    expect(displayUrl("https://shop.example/cart/")).toBe("https://shop.example/cart/");
    expect(displayUrl("https://shop.example/?a=1")).toBe("https://shop.example/?a=1");
  });

  it("서버가 모르는 실행 상태를 보내면 테스트 전으로 둔다", async () => {
    const detail = await getProjectDetail(1);
    const record = toProjectRecord({
      ...detail,
      last_pretest: {
        run_id: "run-1",
        sequence_no: 1,
        status: "paused" as never,
        created_at: detail.created_at,
        finished_at: null,
      },
    });

    expect(record.lastTestStatus).toBeNull();
    expect(record.stageDetail).toBe("테스트 전");
  });

  it("목록의 실측·보정 상태를 열 문구로 바꾸고, 주지 않거나 모르는 값이면 미연결·보정 전", async () => {
    const detail = await getProjectDetail(1);
    const record = (patch: Partial<typeof detail>) => toProjectRecord({ ...detail, ...patch });

    expect(
      record({
        measurement: { status: "connected", last_received_at: null },
        calibration: { status: "applied", revision: 3, applied_at: null, mean_error_pp: null },
      }),
    ).toMatchObject({
      measurementStatus: "connected",
      analytics: "실측 연결됨",
      calibrationRevision: 3,
      calibration: "r3 적용",
    });
    expect(record({ measurement: { status: "waiting", last_received_at: null } })).toMatchObject({
      measurementStatus: "waiting",
      analytics: "실측 수집 대기",
    });
    expect(record({ measurement: undefined, calibration: undefined })).toMatchObject({
      measurementStatus: "unconnected",
      analytics: "실측 미연결",
      calibrationRevision: null,
      calibration: "보정 전",
    });
    expect(
      record({ measurement: { status: "toString" as never, last_received_at: null } }),
    ).toMatchObject({ measurementStatus: "unconnected", analytics: "실측 미연결" });
    expect(
      record({ measurement: { status: "paused" as never, last_received_at: null } }),
    ).toMatchObject({ measurementStatus: "unconnected", analytics: "실측 미연결" });
  });
});
