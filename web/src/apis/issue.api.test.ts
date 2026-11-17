import { describe, expect, it } from "vitest";

import { issueFixture } from "@/test/issues";

import { toWorkspaceIssue } from "./issue.api";

describe("toWorkspaceIssue — 발견한 문제 → 화면 값", () => {
  it("프로젝트 id 를 문자열로, 문제 id 는 프로젝트끼리 겹치지 않게 프로젝트 id 를 붙인다", () => {
    const a = toWorkspaceIssue(issueFixture({ project_id: 1 }));
    const b = toWorkspaceIssue(issueFixture({ project_id: 2, project_name: "스튜디오" }));

    expect(a).toMatchObject({
      id: "1:order:/signup:input_burden",
      projectId: "1",
      projectName: "반찬로드",
      cause: "입력 부담",
      stage: "가입 단계",
      task: "첫 주문 완료",
      impact: [5, 7],
      firstSeen: "11월 3일",
      verdict: "계속 발생",
      runId: "run-3",
    });
    expect(b.id).not.toBe(a.id);
  });
});
