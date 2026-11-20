import { describe, expect, it } from "vitest";

import type { PersonaReport, PersonaReportSummary, ReportTask } from "@/types/persona.type";

import {
  canCompareCauses,
  commonTasks,
  compareStages,
  formatDiff,
  pickDefaultB,
  rangeDiff,
  runLabel,
} from "./compareView";

const summary = (run_id: string, created_at = "2026-11-07T03:00:00Z"): PersonaReportSummary => ({
  run_id,
  created_at,
  variant: "problem",
  sessions: 20,
});

const task = (id: string, reached: [number, number][]): ReportTask => ({
  id,
  name: id,
  total: 20,
  success: 0,
  dropout: 0,
  technical: 0,
  funnel: reached.map((range, index) => ({
    stage: (["landing", "product", "complete"] as const)[index],
    reached: range,
    dropout: [0, 0],
  })),
});

describe("P18 비교 계산", () => {
  it("범위 차이는 가운데값끼리, 빼기는 U+2212", () => {
    expect(rangeDiff([20, 30], [35, 45])).toBe(15);
    expect(rangeDiff([30, 38], [10, 16])).toBe(-21);
    expect(formatDiff(15, "%p")).toBe("+15%p");
    expect(formatDiff(-3, "건")).toBe("−3건");
    expect(formatDiff(0, "%p")).toBe("0%p");
  });

  it("두 실행 모두에 있는 과업만 A 순서로", () => {
    expect(
      commonTasks(
        [task("order", []), task("coupon", [])],
        [task("coupon", []), task("cart", [])],
      ).map((item) => item.id),
    ).toEqual(["coupon"]);
  });

  it("B 기본값 — A 다음(더 최근) 실행, 없으면 A 이전 실행", () => {
    const list = [summary("r3"), summary("r2"), summary("r1")];
    expect(pickDefaultB(list, "r1")).toBe("r2");
    expect(pickDefaultB(list, "r3")).toBe("r2");
    expect(pickDefaultB(list, "x")).toBe("r3");
    expect(pickDefaultB([summary("r1")], "r1")).toBeNull();
  });

  it("단계별 도달률은 첫 단계 대비 %, B 에만 있는 단계는 뒤에", () => {
    const rows = compareStages(
      task("order", [
        [20, 20],
        [10, 12],
      ]),
      task("order", [
        [20, 20],
        [14, 16],
        [8, 9],
      ]),
    );
    expect(rows.map((row) => [row.label, row.a, row.b, row.diff])).toEqual([
      ["첫 화면", [100, 100], [100, 100], 0],
      ["상품", [50, 60], [70, 80], 20],
      ["완료 화면", null, [40, 45], null],
    ]);
  });

  it("원인 비교는 패널 인원·반복 수가 같을 때만", () => {
    const report = (panel_size: number, seeds: number) =>
      ({ conditions: { panel_size, seeds, calibrated_at: null } }) as PersonaReport;
    expect(canCompareCauses(report(20, 3), report(20, 3))).toBe(true);
    expect(canCompareCauses(report(20, 3), report(15, 3))).toBe(false);
    expect(canCompareCauses({} as PersonaReport, report(20, 3))).toBe(false);
  });

  it("실행 이름 — 차수 · 재테스트 · 날짜", () => {
    const list = [summary("r2", "2026-11-08T03:00:00Z"), summary("r1")];
    expect(runLabel(list, "r2", true)).toBe("2차 · 재테스트 (11월 8일)");
    expect(runLabel(list, "r1", false)).toBe("1차 (11월 7일)");
  });
});
