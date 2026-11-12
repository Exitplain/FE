import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Stepper from "./Stepper";

const STEPS = ["사이트", "과업 · 타겟", "페르소나", "시작 전 확인"];

describe("Stepper", () => {
  it("단계를 순서 있는 목록으로 보여준다", () => {
    render(<Stepper steps={STEPS} current={0} />);

    const items = within(screen.getByRole("list", { name: "진행 단계" })).getAllByRole("listitem");
    expect(items).toHaveLength(4);
    expect(items[1]).toHaveTextContent("과업 · 타겟");
  });

  it("현재 단계에만 aria-current=step 을 붙인다", () => {
    render(<Stepper steps={STEPS} current={2} />);

    const items = screen.getAllByRole("listitem");
    expect(items[2]).toHaveAttribute("aria-current", "step");
    expect(items.filter((item) => item.hasAttribute("aria-current"))).toHaveLength(1);
  });

  it("지난 단계는 번호 대신 완료로 읽히고, 남은 단계는 번호를 보여준다", () => {
    render(<Stepper steps={STEPS} current={2} />);

    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("완료");
    expect(items[0]).not.toHaveTextContent("1");
    expect(items[2]).toHaveTextContent("3");
    expect(items[3]).toHaveTextContent("4");
  });
});
