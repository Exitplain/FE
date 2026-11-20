import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import StatusBadge from "./StatusBadge";

describe("StatusBadge", () => {
  it("상태 글자를 보여주고 아이콘은 읽지 않는다", () => {
    const { container } = render(<StatusBadge icon="status-wait" label="준비 중" />);

    expect(screen.getByText("준비 중")).toBeInTheDocument();
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("tone 에 따라 data-tone 을 남겨 화면에서 구분할 수 있다", () => {
    render(<StatusBadge icon="status-exit" label="이탈" tone="danger" />);

    expect(screen.getByText("이탈").closest("[data-tone]")).toHaveAttribute("data-tone", "danger");
  });
});
