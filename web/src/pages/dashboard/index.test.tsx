import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { renderWithProviders } from "@/test/renderWithProviders";

import DashboardPage from ".";

function LocationProbe() {
  return <output aria-label="이동 주소">{useLocation().pathname}</output>;
}

describe("워크스페이스 대시보드", () => {
  it("W07에서 선택한 프로젝트의 기존 새 테스트 경로로 이동한다", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <DashboardPage />
        <LocationProbe />
      </>,
    );
    await screen.findByRole("heading", { name: "투두리스트" });
    await user.click(screen.getByRole("button", { name: "새 테스트 시작하기" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "테스트할 프로젝트" }), "studio");
    await user.click(screen.getByRole("button", { name: "계속" }));
    expect(screen.getByLabelText("이동 주소")).toHaveTextContent("/projects/studio/tests/new");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
