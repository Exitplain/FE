import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Link } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "@/test/renderWithProviders";

import Sidebar from "./Sidebar";

function renderAt(route: string) {
  const { container } = renderWithProviders(<Sidebar />, { route });
  return { nav: screen.getByRole("navigation", { name: "프로젝트" }), container };
}

describe("Sidebar 프로젝트 하위 메뉴 (Figma Sidebar 프로젝트 선택 상태)", () => {
  it("프로젝트 밖 화면에서는 하위 메뉴를 접어 두고, 접힌 메뉴는 읽거나 Tab 으로 갈 수 없다", () => {
    const { nav, container } = renderAt("/");

    expect(within(nav).queryByRole("link", { name: "테스트" })).not.toBeInTheDocument();
    /* 접히는 애니메이션을 위해 DOM 에는 남기고 inert 로 막습니다 */
    const collapsed = container.querySelector('[data-submenu="banchan"]');
    expect(collapsed).toHaveAttribute("inert");
    expect(collapsed).toHaveAttribute("aria-hidden", "true");
  });

  it("고른 프로젝트 아래에만 테스트·진단 기록·발견한 문제를 펼치고, 프로젝트 전용 경로로 연결한다", () => {
    const { nav, container } = renderAt("/projects/banchan/tests");

    const submenu = within(nav).getByRole("list", { name: "반찬로드 메뉴" });
    expect(within(submenu).getByRole("link", { name: "테스트" })).toHaveAttribute(
      "href",
      "/projects/banchan/tests",
    );
    expect(within(submenu).getByRole("link", { name: "진단 기록" })).toHaveAttribute(
      "href",
      "/projects/banchan/history",
    );
    expect(within(submenu).getByRole("link", { name: "발견한 문제" })).toHaveAttribute(
      "href",
      "/projects/banchan/issues",
    );
    expect(within(nav).queryByRole("list", { name: "스튜디오 예약 메뉴" })).not.toBeInTheDocument();
    expect(container.querySelector('[data-submenu="studio"]')).toHaveAttribute(
      "data-open",
      "false",
    );
  });

  it.each([
    ["/projects/banchan/tests", "테스트"],
    ["/projects/banchan/tests/", "테스트"],
    ["/projects/banchan/tests/new", "테스트"],
    ["/projects/banchan/runs/run-1", "테스트"],
    ["/projects/banchan/runs/run-1/report", "테스트"],
    ["/projects/banchan/analytics", "테스트"],
    ["/projects/banchan/calibration", "테스트"],
    ["/projects/banchan/history", "진단 기록"],
    ["/projects/banchan/issues", "발견한 문제"],
  ])("%s 에서는 하위 메뉴 '%s' 를 현재 위치로 표시한다", (route, name) => {
    const { nav } = renderAt(route);
    const submenu = within(nav).getByRole("list", { name: "반찬로드 메뉴" });

    expect(within(submenu).getByRole("link", { name })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "반찬로드" })).not.toHaveAttribute("aria-current");
    expect(within(nav).getAllByRole("link", { current: "page" })).toHaveLength(1);
  });

  it.each(["/projects/banchan", "/projects/banchan/"])(
    "프로젝트 개요(%s)에서만 프로젝트 항목을 현재 위치로 표시하고 하위 메뉴는 펼쳐 둔다",
    (route) => {
      const { nav, container } = renderAt(route);

      expect(within(nav).getByRole("link", { name: "반찬로드" })).toHaveAttribute(
        "aria-current",
        "page",
      );
      expect(container.querySelector('[data-submenu="banchan"]')).toHaveAttribute(
        "data-open",
        "true",
      );
    },
  );

  it("워크스페이스 진단 기록(/history)에서는 프로젝트 메뉴를 펼치지 않는다", () => {
    renderAt("/history");

    expect(screen.getByRole("navigation", { name: "워크스페이스" })).toContainElement(
      screen.getByRole("link", { current: "page" }),
    );
    expect(screen.queryByRole("list", { name: "반찬로드 메뉴" })).not.toBeInTheDocument();
    expect(document.querySelector('[data-submenu="banchan"]')).toHaveAttribute(
      "data-open",
      "false",
    );
  });
});

describe("Sidebar 선택 표시 모서리 크기", () => {
  /* 단언이 실패해도 가짜 타이머가 다음 테스트로 새지 않게 합니다 */
  afterEach(() => {
    vi.useRealTimers();
  });

  it("하위 메뉴로 이동하면 이동이 끝난 뒤(0.3초) 작은 모서리로 바꾸고, 그 사이 경로가 또 바뀌어도 바꾼다", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { container } = renderWithProviders(
      <>
        <Sidebar />
        <Link to="/projects/banchan/tests/new">새 테스트로</Link>
      </>,
      { route: "/projects/banchan" },
    );
    const indicator = container.querySelector<HTMLElement>(".sidebar-indicator")!;
    expect(indicator.dataset.size).toBe("main");

    await user.click(screen.getByRole("link", { name: "테스트" }));
    expect(indicator.dataset.size).toBe("main");

    // 0.3초가 지나기 전에 같은 "테스트" 메뉴의 다른 화면으로 다시 이동
    await user.click(screen.getByRole("link", { name: "새 테스트로" }));
    act(() => vi.advanceTimersByTime(300));

    expect(indicator.dataset.size).toBe("sub");
  });
});
