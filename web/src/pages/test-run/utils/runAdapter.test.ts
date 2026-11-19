import { describe, expect, it } from "vitest";

import type { RunDetail, RunEvent, RunGoalRate } from "@/types/run.type";

import { reduceEvents, runTaskNames, taskFromRunName, taskLabel, v1Phase } from "./runAdapter";

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

describe("taskFromRunName — 서버 실행 이름의 과업 부분", () => {
  it.each([
    ["8차·첫 주문 쿠폰 받기", "첫 주문 쿠폰 받기"],
    ["8차 · 첫 주문 쿠폰 받기", "첫 주문 쿠폰 받기"],
    ["1차·첫 주문 외 1개", "첫 주문 외 1개"],
    ["2차·A·B 비교", "A·B 비교"],
  ])("%s → %s", (name, expected) => {
    expect(taskFromRunName(name)).toBe(expected);
  });

  it.each([["8차"], ["8차· "], ["원인 재현"], [""], [null], [undefined]])("%s → null", (name) => {
    expect(taskFromRunName(name)).toBeNull();
  });
});

function detailOf(name: string, goalRates: RunGoalRate[] | null = null) {
  return {
    name,
    report: goalRates
      ? { id: "report-1", status: "final", revision: 1, goal_rates: goalRates }
      : null,
  } satisfies Pick<RunDetail, "name" | "report">;
}

describe("runTaskNames — 실행 화면의 과업 이름 표", () => {
  it("과업이 하나면 서버 실행 이름에서 그 과업 이름을 쓴다", () => {
    expect(runTaskNames(detailOf("8차·첫 주문 쿠폰 받기"), ["get-first-order-coupon"])).toEqual({
      "get-first-order-coupon": "첫 주문 쿠폰 받기",
    });
  });

  it("과업이 여럿이면 실행 이름(… 외 N개)으로 짐작하지 않는다", () => {
    expect(
      runTaskNames(detailOf("8차·첫 주문 쿠폰 받기 외 1개"), ["get-coupon", "check-delivery"]),
    ).toEqual({ "get-coupon": "get-coupon", "check-delivery": "check-delivery" });
  });

  it("과업 하나라도 이름이 '… 외 N개' 면 그 부분을 이름으로 쓰지 않는다", () => {
    expect(runTaskNames(detailOf("8차·첫 주문 외 1개"), ["get-coupon"])).toEqual({
      "get-coupon": "get-coupon",
    });
  });

  it("실행을 만든 브라우저에 남긴 이름을 과업마다 쓴다", () => {
    expect(
      runTaskNames(detailOf("8차·첫 주문 쿠폰 받기 외 1개"), ["get-coupon", "check-delivery"], {
        "get-coupon": "첫 주문 쿠폰 받기",
        "check-delivery": "배송 지역 확인하기",
      }),
    ).toEqual({ "get-coupon": "첫 주문 쿠폰 받기", "check-delivery": "배송 지역 확인하기" });
  });

  it("리포트가 있으면 리포트 과업 이름이 가장 먼저다", () => {
    expect(
      runTaskNames(
        detailOf("8차·첫 주문 쿠폰 받기", [
          { task_id: "get-coupon", name: "리포트 이름", achievement_rate: 0.5 },
        ]),
        ["get-coupon"],
        { "get-coupon": "저장한 이름" },
      ),
    ).toEqual({ "get-coupon": "리포트 이름" });
  });

  it("어디에도 없으면 임시 표, 그다음 id 그대로", () => {
    expect(runTaskNames(detailOf("1차·첫 주문 외 1개"), ["order", "custom_task"])).toEqual({
      order: "첫 주문",
      custom_task: "custom_task",
    });
  });
});
