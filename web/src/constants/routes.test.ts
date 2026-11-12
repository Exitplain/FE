import { describe, expect, it } from "vitest";

import { buildPath } from "./routes";

describe("buildPath", () => {
  it("파라미터가 없는 경로는 인자 없이 만든다", () => {
    expect(buildPath("dashboard")).toBe("/");
    expect(buildPath("projectList")).toBe("/projects");
  });

  it("프로젝트 경로에 projectId 를 넣는다", () => {
    expect(buildPath("projectDetail", { projectId: "banchan" })).toBe("/projects/banchan");
    expect(buildPath("testList", { projectId: "banchan" })).toBe("/projects/banchan/tests");
  });

  it("사전 테스트 흐름 경로는 프로젝트 아래에 있다", () => {
    const projectId = "banchan";
    const runId = "run-1";

    expect(buildPath("newTest", { projectId })).toBe("/projects/banchan/tests/new");
    expect(buildPath("testRun", { projectId, runId })).toBe("/projects/banchan/runs/run-1");
    expect(buildPath("report", { projectId, runId })).toBe("/projects/banchan/runs/run-1/report");
    expect(buildPath("retest", { projectId, runId })).toBe("/projects/banchan/runs/run-1/retest");
    expect(buildPath("sessionDetail", { projectId, runId, sessionId: "quick_order" })).toBe(
      "/projects/banchan/runs/run-1/sessions/quick_order",
    );
  });

  it("외부 공유 링크는 프로젝트 밖에 그대로 둔다", () => {
    expect(buildPath("sharedReport", { shareId: "abc" })).toBe("/share/abc");
  });

  it("경로에 쓸 수 없는 문자는 인코딩한다", () => {
    expect(buildPath("projectDetail", { projectId: "a/b c" })).toBe("/projects/a%2Fb%20c");
  });

  it("빈 파라미터는 다른 화면 주소가 되므로 막는다", () => {
    // generatePath 는 빈 값 세그먼트를 지워 /projects/tests 처럼 projectDetail 에 매칭되는 주소를 만듭니다
    expect(() => buildPath("testList", { projectId: "" })).toThrow(/projectId/);
    expect(() => buildPath("testRun", { projectId: "banchan", runId: "" })).toThrow(/runId/);
  });

  it("파라미터 이름과 개수를 타입으로 검사한다", () => {
    // 아래 호출은 런타임 결과가 아니라 tsc(npm run build)에서 오류가 나는지를 확인합니다
    const typeChecks = () => {
      // @ts-expect-error projectId 누락
      buildPath("newTest");
      // @ts-expect-error runId 누락
      buildPath("testRun", { projectId: "banchan" });
      // @ts-expect-error 없는 파라미터 이름
      buildPath("projectDetail", { id: "banchan" });
      // @ts-expect-error 파라미터가 없는 경로에 인자 전달
      buildPath("dashboard", { projectId: "banchan" });
    };

    expect(typeChecks).toBeTypeOf("function");
  });
});
