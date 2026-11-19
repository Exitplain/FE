import { describe, expect, it, vi } from "vitest";

import { RUN_TASK_NAMES_LIMIT, useRunTaskNamesStore } from "./useRunTaskNamesStore";

const register = useRunTaskNamesStore.getState().register;

describe("useRunTaskNamesStore — 실행을 만든 브라우저에 남기는 과업 이름", () => {
  it("실행 ID 별로 과업 id → 이름을 저장하고, 이름이 빈 과업은 넣지 않는다", () => {
    register("run-a", [
      { id: "get-first-order-coupon", name: " 첫 주문 쿠폰 받기 " },
      { id: "check-delivery", name: "" },
      { id: "skip-delivery", name: null },
    ]);

    expect(useRunTaskNamesStore.getState().byRunId["run-a"]).toEqual({
      "get-first-order-coupon": "첫 주문 쿠폰 받기",
    });
  });

  it("이름이 하나도 없으면 아무것도 저장하지 않는다", () => {
    register("run-a", [{ id: "order", name: "  " }]);

    expect(useRunTaskNamesStore.getState().byRunId).toEqual({});
  });

  it("새로 고쳐도 남도록 localStorage 에 둔다", () => {
    register("run-a", [{ id: "order", name: "첫 주문" }]);

    expect(localStorage.getItem("exitplain-run-task-names")).toContain("첫 주문");
  });

  it(`오래된 실행부터 지워 최근 ${RUN_TASK_NAMES_LIMIT}개만 남긴다`, () => {
    for (let i = 0; i <= RUN_TASK_NAMES_LIMIT; i += 1) {
      register(`run-${i}`, [{ id: "order", name: `과업 ${i}` }]);
    }

    const runIds = Object.keys(useRunTaskNamesStore.getState().byRunId);
    expect(runIds).toHaveLength(RUN_TASK_NAMES_LIMIT);
    expect(runIds).not.toContain("run-0");
    expect(runIds).toContain(`run-${RUN_TASK_NAMES_LIMIT}`);
  });

  it("브라우저 저장소에 쓰지 못해도 예외를 던지지 않는다 (실행 화면 이동을 막지 않게)", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    try {
      expect(() => register("run-a", [{ id: "order", name: "첫 주문" }])).not.toThrow();
    } finally {
      /* 공통 정리(afterEach)도 저장소에 쓰므로 그 전에 되돌립니다 */
      setItem.mockRestore();
    }
    /* 이 탭에서는 계속 씁니다 */
    expect(useRunTaskNamesStore.getState().byRunId["run-a"]).toEqual({ order: "첫 주문" });
  });

  it("같은 실행을 다시 저장하면 가장 최근으로 옮긴다", () => {
    register("run-old", [{ id: "order", name: "첫 주문" }]);
    for (let i = 1; i < RUN_TASK_NAMES_LIMIT; i += 1) {
      register(`run-${i}`, [{ id: "order", name: `과업 ${i}` }]);
    }
    register("run-old", [{ id: "order", name: "첫 주문" }]);
    register("run-new", [{ id: "order", name: "새 과업" }]);

    const runIds = Object.keys(useRunTaskNamesStore.getState().byRunId);
    expect(runIds).toContain("run-old");
    expect(runIds).not.toContain("run-1");
  });
});
