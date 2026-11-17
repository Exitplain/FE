import { describe, expect, it } from "vitest";

import { cannedReport, couponTask, orderTask } from "../reportFixture";
import {
  causeRowsV1,
  describeReport,
  formatMinMax,
  formatSeconds,
  funnelMax,
  funnelRowsV1,
  heatmapV1,
  runConditions,
  toPercent,
  visibleStages,
  worstDropV1,
} from "./reportData";

describe("report-2 화면 값", () => {
  it("비율(0~1)을 정수 %로, 없으면 null", () => {
    expect(toPercent(0.5172)).toBe(52);
    expect(toPercent(null)).toBeNull();
    expect(toPercent(undefined)).toBeNull();
  });

  it("범위는 같으면 한 값, 비어 있으면 —", () => {
    expect(formatMinMax({ min: 9, max: 11 }, "명")).toBe("9~11명");
    expect(formatMinMax({ min: 20, max: 20 }, "명")).toBe("20명");
    expect(formatMinMax({ min: null, max: null })).toBe("—");
  });

  it("초를 분·초로", () => {
    expect(formatSeconds(86.4)).toBe("1분 26초");
    expect(formatSeconds(48)).toBe("48초");
    expect(formatSeconds(120)).toBe("2분");
    expect(formatSeconds(null)).toBe("—");
  });

  it("뒤 단계에 도달했는데 아무도 오지 않은 단계는 건너뛴 단계로 뺀다", () => {
    expect(visibleStages(couponTask()).map((stage) => stage.key)).toEqual([
      "landing",
      "browse",
      "detail",
      "cart",
      "payment",
      "complete",
    ]);
  });

  it("뒤에도 아무도 없으면 실제로 끊긴 단계라 남긴다", () => {
    const task = orderTask();
    task.funnel = task.funnel.map((stage) =>
      stage.order >= 4 ? { ...stage, reached: 0, reached_range: { min: 0, max: 0 } } : stage,
    );
    expect(visibleStages(task)).toHaveLength(7);
  });

  it("퍼널 막대: 첫 단계는 인원만, 나머지는 인원 · 유효 세션 대비 %", () => {
    const rows = funnelRowsV1(orderTask());
    expect(rows[0]).toMatchObject({ label: "랜딩", value: [19, 20], valueLabel: "19~20명" });
    expect(rows[4]).toMatchObject({ label: "가입", value: [9, 11], valueLabel: "9~11명 · 52%" });
    expect(funnelMax(orderTask())).toBe(20);
  });

  it("최대 이탈 구간은 떠난 세션이 가장 많은 단계와 앞 단계 (보이는 단계 기준)", () => {
    expect(worstDropV1(orderTask())).toEqual({
      label: "장바구니 → 가입",
      dropouts: 14,
      percent: 32,
    });
    /* 쿠폰은 가입을 건너뛰어 결제 정보 앞 단계가 장바구니입니다 */
    expect(worstDropV1(couponTask())).toEqual({
      label: "상세 → 장바구니",
      dropouts: 7,
      percent: 13,
    });
    /* 랜딩에서 바로 떠난 세션이 가장 많아도 셉니다 */
    const landing = orderTask();
    landing.funnel = landing.funnel.map((stage) =>
      stage.key === "landing" ? { ...stage, dropouts_here: 20 } : stage,
    );
    expect(worstDropV1(landing)).toEqual({ label: "랜딩 → 탐색", dropouts: 20, percent: 34 });
    const none = orderTask();
    none.funnel = none.funnel.map((stage) => ({ ...stage, dropouts_here: 0 }));
    expect(worstDropV1(none)).toBeNull();
  });

  it("원인은 주 원인으로 떠난 세션이 있는 것만 %와 인원으로", () => {
    expect(causeRowsV1(orderTask())).toEqual([
      { key: "input_burden", name: "입력 부담", dropouts: 14, percent: 50 },
      { key: "cost", name: "비용 충격", dropouts: 7, percent: 25 },
      { key: "navigation", name: "탐색 실패", dropouts: 4, percent: 14 },
      { key: "trust", name: "신뢰 부족", dropouts: 3, percent: 11 },
    ]);
  });

  it("히트맵 열은 퍼널에서 보이는 단계와 같다", () => {
    const task = orderTask({
      heatmap: {
        ...orderTask().heatmap,
        rows: [{ segment_id: "s", name: "S", dropouts: [0, 1, 2, 3, 4, 5, 6] }],
      },
    });
    task.funnel = couponTask().funnel;
    const { columns, rows } = heatmapV1(task);
    expect(columns.map((column) => column.name)).toEqual([
      "랜딩",
      "탐색",
      "상세",
      "장바구니",
      "결제 정보",
      "완료",
    ]);
    expect(rows[0].cells).toEqual([0, 1, 2, 3, 5, 6]);
  });

  it("세션 목록에서 페르소나·시드 수를 세어 설명을 만든다", () => {
    const report = cannedReport();
    expect(runConditions(report.data)).toEqual({ personas: 20, seeds: 3 });
    /* 시드 번호가 1부터 이어지지 않아도 개수로 셉니다 */
    const shifted = report.data.sessions.map((session) => ({
      ...session,
      seed: session.seed * 10,
    }));
    expect(runConditions({ ...report.data, sessions: shifted }).seeds).toBe(3);
    expect(describeReport(report.created_at, report.data)).toBe(
      "11월 7일 · AI 고객 20명 × 시드 3회",
    );
    expect(
      describeReport(report.created_at, { ...report.data, sessions: [], status: "partial" }),
    ).toBe("11월 7일 · 부분 결과");
  });
});

describe("실행 퍼널 (journey_funnel)", () => {
  const stage = (
    id: string,
    name: string,
    order: number,
    reached: number,
    dropouts = 0,
  ) => ({
    id,
    path: id,
    name,
    name_source: "model" as const,
    order,
    reached,
    reached_range: { min: reached, max: reached },
    rate_of_valid: reached / 10,
    rate_of_previous: null,
    dropouts_here: dropouts,
    is_goal: id === "/order/success",
  });
  const journeyTask = () =>
    orderTask({
      journey_funnel: {
        basis: "observed_screens",
        valid_sessions: 10,
        stages: [
          stage("/cart", "장바구니", 2, 10),
          stage("/", "홈", 0, 10),
          stage("/product", "상품 상세", 1, 10, 3),
          stage("/order/success", "주문 완료", 3, 7),
        ],
        other: { screens: 1, dropouts: 1 },
        heatmap: {
          stages: ["/", "/product", "/cart", "/order/success", "other"],
          rows: [{ segment_id: "segment_1", name: "빠른 구매형", dropouts: [0, 3, 0, 0, 1] }],
        },
      },
    });

  it("있으면 7단계 대신 실제로 지나간 화면을 역할 이름으로 순서대로 보여준다", () => {
    expect(funnelRowsV1(journeyTask()).map((row) => row.label)).toEqual([
      "홈",
      "상품 상세",
      "장바구니",
      "주문 완료",
    ]);
    expect(funnelMax(journeyTask())).toBe(10);
  });

  it("최대 이탈 구간도 실행 퍼널 기준", () => {
    expect(worstDropV1(journeyTask())).toEqual({ label: "상품 상세 → 장바구니", dropouts: 3, percent: 30 });
  });

  it("히트맵 열은 실행 퍼널 단계 + 기타 화면", () => {
    const { columns, rows } = heatmapV1(journeyTask());
    expect(columns.map((column) => column.name)).toEqual(["홈", "상품 상세", "장바구니", "주문 완료", "기타 화면"]);
    expect(rows[0].cells).toEqual([0, 3, 0, 0, 1]);
  });

  it("없거나 비어 있으면(예전 리포트) 7단계 퍼널 그대로", () => {
    const empty = orderTask({ journey_funnel: { ...journeyTask().journey_funnel!, stages: [] } });
    expect(funnelRowsV1(empty).map((row) => row.key)).toEqual(funnelRowsV1(orderTask()).map((row) => row.key));
  });
});
