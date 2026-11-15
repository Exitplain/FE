import { describe, expect, it } from "vitest";

import type { RunItem, RunStatus } from "@/types/run.type";

import { formatGoalRates, formatRunDate, toTestRows } from "./testRows";

const NOW = new Date("2026-11-13T15:00:00+09:00");

function item(overrides: Partial<RunItem> = {}): RunItem {
  return {
    id: "run-1",
    sequence_no: 1,
    name: "1차·첫 주문 완료",
    kind: "pretest",
    status: "completed",
    change_note: "",
    parent_run_id: null,
    created_at: "2026-11-07T05:00:00+00:00",
    started_at: null,
    finished_at: null,
    report: {
      id: "report-1",
      status: "final",
      revision: 1,
      goal_rates: [{ task_id: "order", name: "첫 주문 완료", achievement_rate: 0.25 }],
    },
    ...overrides,
  };
}

describe("formatRunDate", () => {
  it("오늘이면 시:분, 아니면 월·일로 보여준다", () => {
    expect(formatRunDate("2026-11-13T05:40:00Z", NOW)).toBe("14:40");
    expect(formatRunDate("2026-11-07T05:00:00Z", NOW)).toBe("11월 7일");
    expect(formatRunDate(null, NOW)).toBe("—");
    expect(formatRunDate("not-a-date", NOW)).toBe("—");
  });
});

describe("formatGoalRates", () => {
  it("과업별 0~1 비율을 정수 %로 잇는다", () => {
    expect(
      formatGoalRates([
        { task_id: "order", name: "첫 주문", achievement_rate: 0.2549 },
        { task_id: "cart", name: "장바구니", achievement_rate: 1 },
      ]),
    ).toBe("25% · 100%");
  });

  it("비율이 없는 과업은 — 로, 리포트가 없거나 과업이 없으면 — 하나로 보여준다", () => {
    expect(
      formatGoalRates([
        { task_id: "order", name: "첫 주문", achievement_rate: null },
        { task_id: "cart", name: "장바구니", achievement_rate: 0.4 },
      ]),
    ).toBe("— · 40%");
    expect(formatGoalRates([])).toBe("—");
    expect(formatGoalRates(undefined)).toBe("—");
  });
});

describe("toTestRows", () => {
  it("BE 가 만든 이름·날짜·달성률을 그대로 쓴다", () => {
    expect(toTestRows([item()], NOW)).toEqual([
      {
        key: "run-1",
        name: "1차·첫 주문 완료",
        status: "done",
        link: "report",
        completion: "25%",
        date: "11월 7일",
      },
    ]);
  });

  it("이름이 비어 있으면 차수로 이름 붙인다", () => {
    expect(toTestRows([item({ name: "", sequence_no: 4 })], NOW)[0].name).toBe("4차");
  });

  it.each<[RunStatus, string]>([
    ["queued", "preparing"],
    ["running", "running"],
    ["finalizing", "running"],
    ["completed", "done"],
    ["partially_completed", "done"],
    ["failed", "failed"],
    ["cancelled", "cancelled"],
  ])("실행 상태 %s 는 %s 행이다", (status, expected) => {
    expect(toTestRows([item({ status })], NOW)[0].status).toBe(expected);
  });

  it("진행 중이면 실행 화면, 리포트가 있으면 리포트, 끝났는데 리포트가 없으면 링크가 없다", () => {
    const rows = toTestRows(
      [
        item({ id: "a", status: "queued", report: null }),
        item({ id: "b", status: "finalizing", report: null }),
        item({ id: "c", status: "failed" }),
        item({ id: "d", status: "cancelled", report: null }),
      ],
      NOW,
    );

    expect(rows.map((row) => [row.key, row.link])).toEqual([
      ["a", "testRun"],
      ["b", "testRun"],
      ["c", "report"],
      ["d", null],
    ]);
  });

  it("리포트가 없으면 달성률은 — 이다", () => {
    expect(toTestRows([item({ status: "running", report: null })], NOW)[0].completion).toBe("—");
  });
});
