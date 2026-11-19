import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import DeleteProjectDialog from "./DeleteProjectDialog";

const project = { id: "101", name: "스튜디오 예약" };

describe("프로젝트 삭제 확인", () => {
  it("확인 전에는 삭제하지 않고, 처리 중 중복 요청과 닫기를 막는다", async () => {
    let finish: () => void = () => {};
    const onDelete = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<DeleteProjectDialog project={project} onClose={onClose} onDelete={onDelete} />);
    expect(onDelete).not.toHaveBeenCalled();
    await user.dblClick(screen.getByRole("button", { name: "삭제" }));
    expect(onDelete).toHaveBeenCalledExactlyOnceWith("101");
    expect(screen.getByRole("button", { name: "취소" })).toBeDisabled();
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "닫기" }));
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => finish());
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });

  it("실패하면 확인창을 유지하고 취소할 수 있다", async () => {
    const onDelete = vi.fn().mockRejectedValue(new Error("failed"));
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<DeleteProjectDialog project={project} onClose={onClose} onDelete={onDelete} />);
    await user.click(screen.getByRole("button", { name: "삭제" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("프로젝트를 삭제하지 못했어요");
    expect(onClose).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "취소" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
