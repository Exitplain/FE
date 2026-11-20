import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import Modal from "./Modal";

function renderModal(props: Partial<Parameters<typeof Modal>[0]> = {}) {
  const onClose = vi.fn();
  render(
    <Modal open title="테스트 계정 등록" description="최대 20개" onClose={onClose} {...props}>
      <input type="hidden" name="csrf" />
      <input aria-label="아이디" />
      <button type="button">계정 추가</button>
    </Modal>,
  );
  return { onClose };
}

describe("Modal", () => {
  it("닫혀 있으면 아무것도 그리지 않는다", () => {
    renderModal({ open: false });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("제목과 설명으로 대화상자 이름을 붙인다", () => {
    renderModal();

    const dialog = screen.getByRole("dialog", { name: "테스트 계정 등록" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleDescription("최대 20개");
  });

  it("열리면 hidden 이 아닌 첫 입력칸으로 초점을 옮긴다", () => {
    renderModal();

    expect(screen.getByLabelText("아이디")).toHaveFocus();
  });

  it("Escape 로 닫는다", async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();

    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("닫기 버튼으로 닫는다", async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();

    await user.click(screen.getByRole("button", { name: "닫기" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("바깥 덮개를 눌러 닫는다", async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();

    await user.click(screen.getByTestId("modal-scrim"));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("대화상자 안을 눌러서는 닫히지 않는다", async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();

    await user.click(screen.getByLabelText("아이디"));

    expect(onClose).not.toHaveBeenCalled();
  });

  it("Tab 초점이 대화상자 밖으로 나가지 않고 처음으로 돌아온다", async () => {
    const user = userEvent.setup();
    renderModal();

    // 아이디 → 계정 추가 → 닫기 → (다시) 아이디
    await user.tab();
    expect(screen.getByRole("button", { name: "계정 추가" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "닫기" })).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText("아이디")).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "닫기" })).toHaveFocus();
  });

  it("모달 안에 모달이 열려 있으면 Escape 는 위쪽 모달만 닫는다", async () => {
    const user = userEvent.setup();
    const outerClose = vi.fn();

    function Nested() {
      const [innerOpen, setInnerOpen] = useState(true);
      return (
        <Modal open title="바깥" onClose={outerClose}>
          <Modal open={innerOpen} title="안쪽" onClose={() => setInnerOpen(false)}>
            <input aria-label="안쪽 입력" />
          </Modal>
        </Modal>
      );
    }
    render(<Nested />);

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog", { name: "안쪽" })).not.toBeInTheDocument();
    expect(outerClose).not.toHaveBeenCalled();
  });

  it("열려 있는 동안 뒤 화면 스크롤을 막고, 모두 닫히면 원래대로 돌린다", () => {
    document.body.style.overflow = "auto";
    const { rerender } = render(
      <Modal open title="제목" onClose={() => {}}>
        내용
      </Modal>,
    );
    expect(document.body.style.overflow).toBe("hidden");

    rerender(
      <Modal open={false} title="제목" onClose={() => {}}>
        내용
      </Modal>,
    );
    expect(document.body.style.overflow).toBe("auto");
    document.body.style.overflow = "";
  });

  it("닫히면 열기 전 초점 위치로 돌려준다", () => {
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();

    const { rerender } = render(
      <Modal open title="제목" onClose={() => {}}>
        내용
      </Modal>,
    );
    rerender(
      <Modal open={false} title="제목" onClose={() => {}}>
        내용
      </Modal>,
    );

    expect(document.activeElement).toBe(opener);
    opener.remove();
  });
});
