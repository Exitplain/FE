import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";

import AppLayout from "@/layouts/AppLayout/AppLayout";
import ProjectListPage from "@/pages/project-list";
import { renderWithProviders } from "@/test/renderWithProviders";

function LocationProbe() {
  const location = useLocation();
  return (
    <output aria-label="현재 주소">
      {location.pathname}
      {location.search}
    </output>
  );
}

describe("새 프로젝트 모달 연결", () => {
  it("현재 페이지에서 열고 취소하면 원래 경로와 필터를 유지한다", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <AppLayout />
        <LocationProbe />
        <input aria-label="작성 중인 내용" />
      </>,
      { route: "/history?status=completed" },
    );
    await user.type(screen.getByRole("textbox", { name: "작성 중인 내용" }), "메모");
    await user.click(screen.getByRole("link", { name: "새 프로젝트" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("현재 주소")).toHaveTextContent(
      "/history?status=completed&create=1",
    );
    await user.click(screen.getByRole("button", { name: "취소" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByLabelText("현재 주소")).toHaveTextContent("/history?status=completed");
    expect(screen.getByRole("textbox", { name: "작성 중인 내용" })).toHaveValue("메모");
  });

  it("목록 페이지에서는 생성 모달을 중복해서 표시하지 않는다", () => {
    renderWithProviders(
      <>
        <AppLayout />
        <ProjectListPage />
      </>,
      { route: "/projects?create=1" },
    );
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
  });
});
