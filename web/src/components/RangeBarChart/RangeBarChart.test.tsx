import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import RangeBarChart from "./RangeBarChart";

const DATA = [
  { key: "landing", label: "랜딩", value: 20, valueLabel: "20명 (100%)" },
  { key: "cart", label: "장바구니", value: [11, 13] as [number, number], valueLabel: "11~13명" },
  { key: "done", label: "완료", value: 4, valueLabel: "표본 부족", muted: true },
];

describe("RangeBarChart", () => {
  it("단계 이름과 수치를 표로도 보여준다 (그림은 스크린 리더에서 숨김)", () => {
    render(<RangeBarChart title="예측 단계별 이동" data={DATA} max={20} />);

    const table = screen.getByRole("table", { name: "예측 단계별 이동" });
    const rows = within(table).getAllByRole("row");
    expect(rows).toHaveLength(3);
    expect(within(rows[1]).getByRole("rowheader")).toHaveTextContent("장바구니");
    expect(within(rows[1]).getByRole("cell")).toHaveTextContent("11~13명");
  });

  it("행 수만큼 높이를 잡는다", () => {
    const { container } = render(
      <RangeBarChart title="실제 고객 데이터 단계별 이동" data={DATA} max={20} rowHeight={26} />,
    );

    expect(container.querySelector("[aria-hidden]")).toHaveStyle({ height: "78px" });
  });
});
