import { describe, expect, it } from "vitest";

import type { RunEvent } from "@/types/run.type";

import { reduceEvents, taskLabel, v1Phase } from "./runAdapter";

describe("v1Phase — 제품 API 실행 상태 → 실행 화면 단계", () => {
  it.each([
    ["queued", "preparing", "preparing"],
    ["running", "preparing", "preparing"],
    ["running", "running", "running"],
    ["finalizing", "analyzing", "analyzing"],
    ["completed", "done", "completed"],
    ["partially_completed", "done", "completed"],
    ["failed", "failed", "failed"],
    ["cancelled", "cancelled", "cancelled"],
  ] as const)("%s (%s) → %s", (status, phase, expected) => {
    expect(v1Phase({ status, phase })).toBe(expected);
  });
});

function event(
  id: number,
  sessionId: number,
  type: string,
  payload: Record<string, unknown>,
): RunEvent {
  return {
    id,
    type,
    sequence: id,
    session_id: sessionId,
    session_key: `s${sessionId}`,
    occurred_at: "2026-11-17T05:00:00+00:00",
    payload,
  };
}

describe("reduceEvents — 이벤트를 세션별 관찰·행동으로", () => {
  it("관찰·행동을 세션별로 쌓고 커서(id) 이하의 이벤트는 다시 넣지 않는다", () => {
    const first = reduceEvents(
      { after: 0, bySession: {} },
      [
        event(1, 7, "observation.created", {
          step_id: 1,
          stage: "landing",
          text: "첫 화면이네요",
          frustration_score: 10,
          frustration_threshold: 48,
        }),
        event(2, 7, "action.completed", {
          step_id: 1,
          action: { kind: "click", explanation: "담기" },
        }),
        event(3, 8, "session.started", {}),
      ],
      3,
    );
    const again = reduceEvents(
      first,
      [event(2, 7, "action.completed", { step_id: 1, action: { kind: "click" } })],
      3,
    );

    expect(again.after).toBe(3);
    expect(again.bySession[7].observations).toEqual([
      expect.objectContaining({
        step: 1,
        stage: "landing",
        text: "첫 화면이네요",
        score: 10,
        threshold: 48,
      }),
    ]);
    expect(again.bySession[7].actions).toEqual([{ step: 1, kind: "click", explanation: "담기" }]);
    expect(again.bySession[8]).toBeUndefined();
  });

  it("모르는 단계는 비워 둔다", () => {
    const result = reduceEvents(
      { after: 0, bySession: {} },
      [event(1, 1, "observation.created", { step_id: 1, stage: "somewhere" })],
      1,
    );
    expect(result.bySession[1].observations[0].stage).toBeNull();
  });
});

describe("taskLabel — 임시 과업 이름", () => {
  it("아는 과업은 이름, 모르는 과업은 id 그대로", () => {
    expect(taskLabel("order")).toBe("첫 주문");
    expect(taskLabel("custom_task")).toBe("custom_task");
  });
});
