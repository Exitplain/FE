import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { renderWithProviders } from "@/test/renderWithProviders";

import DashboardPage from ".";

function LocationProbe() {
  const location = useLocation();
  return (
    <output aria-label="이동 주소">
      {location.pathname}
      {location.search}
    </output>
  );
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
    await user.click(screen.getByRole("combobox", { name: "테스트할 프로젝트" }));
    await user.click(screen.getByRole("option", { name: /스튜디오 예약/ }));
    await user.click(screen.getByRole("button", { name: "계속" }));
    expect(screen.getByLabelText("이동 주소")).toHaveTextContent("/projects/studio/tests/new");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("선택 메뉴에서 Escape는 메뉴만 닫고 키보드로 프로젝트를 선택할 수 있다", async () => {
    const user = userEvent.setup();
    renderWithProviders(<DashboardPage />);
    await screen.findByRole("heading", { name: "투두리스트" });
    await user.click(screen.getByRole("button", { name: "새 테스트 시작하기" }));
    const picker = screen.getByRole("combobox", { name: "테스트할 프로젝트" });
    await user.click(picker);
    expect(screen.getByRole("option", { name: /반찬로드/, selected: true })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(picker).toHaveTextContent("스튜디오 예약 · studio.example");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("새 프로젝트 옵션은 프로젝트 생성 모달 경로로 연결한다", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <DashboardPage />
        <LocationProbe />
      </>,
    );
    await screen.findByRole("heading", { name: "투두리스트" });
    await user.click(screen.getByRole("button", { name: "새 테스트 시작하기" }));
    await user.click(screen.getByRole("combobox", { name: "테스트할 프로젝트" }));
    await user.click(screen.getByRole("option", { name: /새 프로젝트/ }));
    expect(screen.getByLabelText("이동 주소")).toHaveTextContent("/projects?create=1");
  });
});
