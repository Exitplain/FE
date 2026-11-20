import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import ChoiceChip from "./ChoiceChip";

describe("ChoiceChip", () => {
  it("선택 여부를 aria-pressed 로 알린다", () => {
    render(
      <>
        <ChoiceChip selected>30대</ChoiceChip>
        <ChoiceChip selected={false}>40대</ChoiceChip>
      </>,
    );

    expect(screen.getByRole("button", { name: "30대" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "40대" })).toHaveAttribute("aria-pressed", "false");
  });

  it("하나만 고르는 곳에서는 radio 로 선택 여부를 알린다", () => {
    render(
      <div role="radiogroup" aria-label="계정 입력 방식">
        <ChoiceChip kind="radio" selected>
          직접 입력
        </ChoiceChip>
        <ChoiceChip kind="radio" selected={false}>
          붙여넣기
        </ChoiceChip>
      </div>,
    );

    expect(screen.getByRole("radio", { name: "직접 입력" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "붙여넣기" })).not.toBeChecked();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("누르면 onClick 을 부른다", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <ChoiceChip selected={false} onClick={onClick}>
        전체
      </ChoiceChip>,
    );

    await user.click(screen.getByRole("button", { name: "전체" }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
