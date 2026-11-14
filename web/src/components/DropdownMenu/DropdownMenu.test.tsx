import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import Button from "@/components/Button/Button";

import DropdownMenu, { type DropdownMenuItem } from "./DropdownMenu";

function renderMenu(items: DropdownMenuItem[]) {
  return render(
    <>
      <DropdownMenu
        label="내보내기 형식"
        items={items}
        renderTrigger={(props) => (
          <Button variant="secondary" {...props}>
            내보내기
          </Button>
        )}
      />
      <p>바깥</p>
    </>,
  );
}

describe("DropdownMenu", () => {
  it("열면 첫 항목에 초점이 가고, 고르면 닫히며 여는 버튼으로 초점이 돌아온다", async () => {
    const onPdf = vi.fn();
    renderMenu([
      { key: "pdf", label: "PDF로 내보내기", description: "A4 · 요약부터", onSelect: onPdf },
      { key: "md", label: "Markdown으로 내보내기", onSelect: vi.fn() },
    ]);
    const trigger = screen.getByRole("button", { name: "내보내기" });

    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(trigger);

    expect(screen.getByRole("menu", { name: "내보내기 형식" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /PDF로 내보내기/ })).toHaveFocus();

    await userEvent.keyboard("{Enter}");

    expect(onPdf).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("화살표는 비활성 항목을 건너뛰고, Escape 로 닫는다", async () => {
    renderMenu([
      { key: "a", label: "첫 항목", onSelect: vi.fn() },
      { key: "b", label: "실행 중", disabled: true, onSelect: vi.fn() },
      { key: "c", label: "세 번째", onSelect: vi.fn() },
    ]);
    const trigger = screen.getByRole("button", { name: "내보내기" });

    trigger.focus();
    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "첫 항목" })).toHaveFocus();

    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "세 번째" })).toHaveFocus();
    expect(screen.getByRole("menuitem", { name: "실행 중" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("여는 버튼에서 ↑ 로 열면 마지막 항목부터, Home·End 로 처음·끝, Tab 으로 닫는다", async () => {
    renderMenu([
      { key: "a", label: "첫 항목", onSelect: vi.fn() },
      { key: "b", label: "두 번째", onSelect: vi.fn() },
      { key: "c", label: "마지막", onSelect: vi.fn() },
    ]);

    screen.getByRole("button", { name: "내보내기" }).focus();
    await userEvent.keyboard("{ArrowUp}");
    expect(screen.getByRole("menuitem", { name: "마지막" })).toHaveFocus();

    await userEvent.keyboard("{Home}");
    expect(screen.getByRole("menuitem", { name: "첫 항목" })).toHaveFocus();
    await userEvent.keyboard("{End}");
    expect(screen.getByRole("menuitem", { name: "마지막" })).toHaveFocus();

    await userEvent.tab();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("모든 항목이 비활성이어도 Escape 로 닫는다", async () => {
    renderMenu([{ key: "b", label: "실행 중", disabled: true, onSelect: vi.fn() }]);
    const trigger = screen.getByRole("button", { name: "내보내기" });

    await userEvent.click(trigger);
    expect(trigger).toHaveFocus();
    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("비활성 항목은 눌러도 고르지 않는다", async () => {
    const onSelect = vi.fn();
    renderMenu([{ key: "b", label: "실행 중", disabled: true, onSelect }]);

    await userEvent.click(screen.getByRole("button", { name: "내보내기" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "실행 중" }));

    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("선택 항목이 있으면 menuitemradio 로 보이고 선택된 항목에 초점이 간다", async () => {
    renderMenu([
      { key: "3", label: "3차", selected: false, onSelect: vi.fn() },
      { key: "2", label: "2차", selected: true, onSelect: vi.fn() },
    ]);

    await userEvent.click(screen.getByRole("button", { name: "내보내기" }));

    expect(screen.getByRole("menuitemradio", { name: "2차" })).toBeChecked();
    expect(screen.getByRole("menuitemradio", { name: "2차" })).toHaveFocus();
  });

  it("바깥을 누르면 닫는다", async () => {
    renderMenu([{ key: "a", label: "첫 항목", onSelect: vi.fn() }]);

    await userEvent.click(screen.getByRole("button", { name: "내보내기" }));
    await userEvent.click(screen.getByText("바깥"));

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
