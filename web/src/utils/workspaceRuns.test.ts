import { describe, expect, it } from "vitest";

import type { RunItem } from "@/types/run.type";

import { formatRate, toWorkspaceRun } from "./workspaceRuns";

const item = (overrides: Partial<RunItem> = {}): RunItem => ({
  id: "run-1",
  sequence_no: 3,
  name: "3차 · 첫 주문",
  kind: "pretest",
  status: "completed",
  change_note: "",
  parent_run_id: null,
  created_at: "2026-11-07T03:00:00Z",
  started_at: null,
  finished_at: null,
  report: null,
  ...overrides,
});

describe("toWorkspaceRun — 제품 API 실행 → 진단 기록 한 줄", () => {
  it("과업별 달성률(0~1)을 % 로, 값이 없는 과업은 뺀다", () => {
    const run = toWorkspaceRun(
      item({
        report: {
          id: "r",
          status: "final",
          revision: 1,
          goal_rates: [
            { task_id: "order", name: "첫 주문", achievement_rate: 0.254 },
            { task_id: "coupon", name: "쿠폰", achievement_rate: null },
          ],
        },
      }),
      { id: "7", name: "반찬로드" },
    );

    expect(run).toMatchObject({
      projectId: "7",
      projectName: "반찬로드",
      title: "3차 · 첫 주문",
      type: "사전 테스트",
      status: "completed",
      predictions: [[25, 25]],
    });
  });

  it("상태는 화면 4종으로 묶고, 이름이 비면 차수로, 원인 재현은 유형을 바꾼다", () => {
    const project = { id: "1", name: "p" };
    expect(toWorkspaceRun(item({ status: "finalizing" }), project).status).toBe("running");
    expect(toWorkspaceRun(item({ status: "cancelled" }), project).status).toBe("failed");
    expect(toWorkspaceRun(item({ status: "partially_completed" }), project).status).toBe(
      "completed",
    );
    expect(toWorkspaceRun(item({ name: "" }), project).title).toBe("3차");
    expect(toWorkspaceRun(item({ kind: "cause_repro" }), project).type).toBe("원인 재현");
  });

  it("범위가 같으면 값 하나로 쓴다", () => {
    expect(formatRate([25, 25])).toBe("25%");
    expect(formatRate([20, 30])).toBe("20~30%");
  });
});
