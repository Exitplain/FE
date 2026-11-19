import { describe, expect, it } from "vitest";

import type { PersonaRun, PersonaSession } from "@/types/persona.type";

import { runTitle } from "./useRunTitle";

function runOf(name: string | undefined, tasks: [string, string][]): PersonaRun {
  return {
    sequence_no: 8,
    name,
    sessions: tasks.map(([task_id, task_name]) => ({ task_id, task_name }) as PersonaSession),
  } as PersonaRun;
}

describe("runTitle — 실행 화면 제목", () => {
  it("방문이 있어도 서버 실행 이름의 과업 부분을 쓴다", () => {
    const run = runOf("8차·첫 주문 쿠폰 받기", [
      ["get-first-order-coupon", "get-first-order-coupon"],
    ]);

    expect(runTitle(run)).toEqual({
      order: 8,
      summary: "첫 주문 쿠폰 받기",
      title: "8차 · 첫 주문 쿠폰 받기",
    });
  });

  it("과업이 여럿이면 서버 이름의 '외 N개' 를 그대로 쓴다", () => {
    const run = runOf("8차·첫 주문 쿠폰 받기 외 1개", [
      ["get-coupon", "get-coupon"],
      ["check-delivery", "check-delivery"],
    ]);

    expect(runTitle(run).title).toBe("8차 · 첫 주문 쿠폰 받기 외 1개");
  });

  it("서버 이름에 과업이 없으면 방문의 과업 이름으로 만든다", () => {
    expect(
      runTitle(
        runOf("8차", [
          ["order", "첫 주문"],
          ["coupon", "쿠폰으로 주문"],
        ]),
      ).title,
    ).toBe("8차 · 첫 주문 외 1개");
    expect(runTitle(runOf(undefined, [])).title).toBe("8차 · 사전 테스트");
  });
});
