import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import SegmentedTabs from "./SegmentedTabs";

const OPTIONS = [
  { value: "7", label: "최근 7일" },
  { value: "14", label: "14일" },
  { value: "30", label: "30일" },
] as const;

function Period() {
  const [value, setValue] = useState<"7" | "14" | "30">("7");
  return <SegmentedTabs label="기간" options={OPTIONS} value={value} onChange={setValue} />;
}

describe("SegmentedTabs", () => {
  it("하나만 선택된 radiogroup 으로 보이고 클릭으로 바꾼다", async () => {
    render(<Period />);

    expect(screen.getByRole("radiogroup", { name: "기간" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "최근 7일" })).toBeChecked();

    await userEvent.click(screen.getByRole("radio", { name: "30일" }));

    expect(screen.getByRole("radio", { name: "30일" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "최근 7일" })).not.toBeChecked();
  });

  it("값이 목록에 없으면 아무것도 선택 표시하지 않는다", () => {
    render(
      <SegmentedTabs label="기간" options={OPTIONS} value={"90" as never} onChange={() => {}} />,
    );

    expect(screen.queryByRole("radio", { checked: true })).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "최근 7일" })).toHaveAttribute("tabindex", "0");
  });

  it("Tab 은 선택된 항목에만 멈추고 화살표·Home·End 로 고른다", async () => {
    render(<Period />);

    await userEvent.tab();
    expect(screen.getByRole("radio", { name: "최근 7일" })).toHaveFocus();

    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "14일" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "14일" })).toHaveFocus();

    await userEvent.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(screen.getByRole("radio", { name: "30일" })).toBeChecked();

    await userEvent.keyboard("{Home}");
    expect(screen.getByRole("radio", { name: "최근 7일" })).toBeChecked();
    await userEvent.keyboard("{End}");
    expect(screen.getByRole("radio", { name: "30일" })).toHaveFocus();
  });
});
