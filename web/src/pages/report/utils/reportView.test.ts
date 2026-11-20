import { describe, expect, it } from "vitest";

import type { ReportFinding, ReportTask } from "@/types/persona.type";

import {
  causeShares,
  completion,
  dropLabel,
  formatDay,
  formatDuration,
  formatRange,
  funnelRows,
  runOrder,
  worstDrop,
} from "./reportView";

const TASK: ReportTask = {
  id: "order",
  name: "첫 주문",
  total: 20,
  success: 5,
  dropout: 13,
  technical: 2,
  funnel: [
    { stage: "landing", reached: [18, 18], dropout: [0, 0] },
    { stage: "cart", reached: [11, 13], dropout: [2, 4] },
    { stage: "signup", reached: [6, 8], dropout: [4, 6] },
    { stage: "complete", reached: [4, 6], dropout: [0, 2] },
  ],
};

function finding(category: ReportFinding["category"], affected: number): ReportFinding {
  return {
    id: `${category}-${affected}`,
    task_id: "order",
    stage: "signup",
    category,
    title: "",
    affected_sessions: affected,
    task_sessions: 18,
    evidence: [],
    interpretation: "",
    recommendation: "",
    mockup: null,
  };
}

describe("reportView", () => {
  it("범위가 같으면 한 값, 다르면 ~ 로 잇는다", () => {
    expect(formatRange([4, 6], "명")).toBe("4~6명");
    expect(formatRange([5, 5], "%")).toBe("5%");
  });

  it("목표 달성률은 마지막 단계 도달 / 첫 단계 도달 (기술 실패는 이미 빠진 분모)", () => {
    expect(completion(TASK)).toEqual({ rate: [22, 33], completed: [4, 6], base: 18 });
  });

  it("단계별 이동이 없으면 완료 / (전체 - 기술 실패) 로 센다", () => {
    expect(completion({ ...TASK, funnel: undefined })).toEqual({
      rate: [28, 28],
      completed: [5, 5],
      base: 18,
    });
  });

  it("최대 이탈 구간은 이탈 상한이 가장 큰 단계와 직전 단계, 비율은 직전 도달 대비", () => {
    const drop = worstDrop(TASK);

    expect(drop).toEqual({ from: "cart", to: "signup", rate: [31, 46] });
    expect(dropLabel(drop!)).toBe("장바구니 → 가입");
  });

  it("이탈이 없으면 최대 이탈 구간이 없다", () => {
    expect(
      worstDrop({
        ...TASK,
        funnel: TASK.funnel!.map((stage) => ({ ...stage, dropout: [0, 0] })),
      }),
    ).toBeNull();
  });

  it("단계별 이동 막대 문구: 첫 단계는 100%, 나머지는 도달·이탈 범위", () => {
    expect(funnelRows(TASK).map((row) => row.valueLabel)).toEqual([
      "18명 (100%)",
      "11~13명 · 이탈 2~4",
      "6~8명 · 이탈 4~6",
      "4~6명 · 이탈 0~2",
    ]);
  });

  it("원인 분포는 원인별로 합쳐 많은 순서와 비율을 준다", () => {
    expect(
      causeShares([finding("cost", 1), finding("input_burden", 3), finding("cost", 1)]),
    ).toEqual([
      { cause: "input_burden", sessions: 3, share: 60 },
      { cause: "cost", sessions: 2, share: 40 },
    ]);
  });

  it("원인 분포 분모는 과업의 이탈 방문 수이고, 원인 없음(none)은 세지 않는다", () => {
    expect(causeShares([finding("cost", 2), finding("none", 1)], 4)).toEqual([
      { cause: "cost", sessions: 2, share: 50 },
    ]);
  });

  it("차수는 완료 목록(최신순)에서 오래된 것이 1차", () => {
    const reports = [
      { run_id: "b", created_at: null, variant: null, sessions: 3 },
      { run_id: "a", created_at: null, variant: null, sessions: 3 },
    ];
    expect(runOrder(reports, "a")).toBe(1);
    expect(runOrder(reports, "b")).toBe(2);
    expect(runOrder(reports, "c")).toBeNull();
  });

  it("날짜는 서울 시간 기준 'M월 D일', 읽을 수 없으면 —", () => {
    expect(formatDay("2026-11-06T15:30:00+00:00")).toBe("11월 7일");
    expect(formatDay("not-a-date")).toBe("—");
    expect(formatDay(null)).toBe("—");
  });
});

describe("formatDuration", () => {
  it("초를 분·초로, 범위는 ~ 로 잇는다", () => {
    expect(formatDuration([250, 250])).toBe("4분 10초");
    expect(formatDuration([250, 290])).toBe("4분 10초~4분 50초");
    expect(formatDuration([60, 60])).toBe("1분 0초");
    expect(formatDuration([45, 45])).toBe("45초");
  });
});
