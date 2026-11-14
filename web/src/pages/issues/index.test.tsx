import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { renderWithProviders } from "@/test/renderWithProviders";

import IssuesPage from ".";

describe("워크스페이스 발견한 문제", () => {
  it("원인 필터와 상세 열기·닫기가 동작한다", async () => {
    const user = userEvent.setup();
    renderWithProviders(<IssuesPage />, { route: "/issues" });
    await screen.findByRole("button", { name: "입력 부담 · 가입 단계" });
    await user.click(screen.getByRole("button", { name: /입력 부담\s*1/ }));
    expect(
      screen.queryByRole("button", { name: "비용 충격 · 결제 정보 단계" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "입력 부담 · 가입 단계" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "닫기" })[0]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
