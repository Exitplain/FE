import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { Link } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MOCK_SAMPLE_PROJECTS } from "@/mocks/handlers/projects";
import { server } from "@/mocks/node";
import { renderWithProviders } from "@/test/renderWithProviders";

import Sidebar from "./Sidebar";

/* 로그인한 사용자의 프로젝트 하나 (GET /api/v1/projects) + 샘플 반찬로드(1) */
beforeEach(() => {
  server.use(
    http.get("*/api/v1/projects", () =>
      HttpResponse.json({
        items: [
          {
            ...MOCK_SAMPLE_PROJECTS[0],
            id: 101,
            name: "스튜디오 예약",
            entry_url: "https://studio.example/",
            domain: "studio.example",
            is_sample: false,
          },
        ],
        next_cursor: null,
        total: 1,
      }),
    ),
  );
});

/* 프로젝트 목록은 제품 API 로 받으므로 항목이 그려질 때까지 기다립니다 */
async function renderAt(route: string) {
  const { container } = renderWithProviders(<Sidebar />, { route });
  const nav = screen.getByRole("navigation", { name: "프로젝트" });
  await within(nav).findByRole("link", { name: "반찬로드" });
  return { nav, container };
}

describe("Sidebar 프로젝트 하위 메뉴 (Figma Sidebar 프로젝트 선택 상태)", () => {
  it("프로젝트 밖 화면에서는 하위 메뉴를 접어 두고, 접힌 메뉴는 읽거나 Tab 으로 갈 수 없다", async () => {
    const { nav, container } = await renderAt("/");

    expect(within(nav).queryByRole("link", { name: "테스트" })).not.toBeInTheDocument();
    /* 접히는 애니메이션을 위해 DOM 에는 남기고 inert 로 막습니다 */
    const collapsed = container.querySelector('[data-submenu="1"]');
    expect(collapsed).toHaveAttribute("inert");
    expect(collapsed).toHaveAttribute("aria-hidden", "true");
  });

  it("고른 프로젝트 아래에만 테스트·진단 기록·발견한 문제를 펼치고, 프로젝트 전용 경로로 연결한다", async () => {
    const { nav, container } = await renderAt("/projects/1/tests");

    const submenu = within(nav).getByRole("list", { name: "반찬로드 메뉴" });
    expect(within(submenu).getByRole("link", { name: "테스트" })).toHaveAttribute(
      "href",
      "/projects/1/tests",
    );
    expect(within(submenu).getByRole("link", { name: "진단 기록" })).toHaveAttribute(
      "href",
      "/projects/1/history",
    );
    expect(within(submenu).getByRole("link", { name: "발견한 문제" })).toHaveAttribute(
      "href",
      "/projects/1/issues",
    );
    expect(within(nav).queryByRole("list", { name: "스튜디오 예약 메뉴" })).not.toBeInTheDocument();
    expect(container.querySelector('[data-submenu="101"]')).toHaveAttribute("data-open", "false");
  });

  it.each([
    ["/projects/1/tests", "테스트"],
    ["/projects/1/tests/", "테스트"],
    ["/projects/1/tests/new", "테스트"],
    ["/projects/1/runs/run-1", "테스트"],
    ["/projects/1/runs/run-1/report", "테스트"],
    ["/projects/1/analytics", "테스트"],
    ["/projects/1/calibration", "테스트"],
    ["/projects/1/history", "진단 기록"],
    ["/projects/1/issues", "발견한 문제"],
  ])("%s 에서는 하위 메뉴 '%s' 를 현재 위치로 표시한다", async (route, name) => {
    const { nav } = await renderAt(route);
    const submenu = within(nav).getByRole("list", { name: "반찬로드 메뉴" });

    expect(within(submenu).getByRole("link", { name })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "반찬로드" })).not.toHaveAttribute("aria-current");
    expect(within(nav).getAllByRole("link", { current: "page" })).toHaveLength(1);
  });

  it.each(["/projects/1", "/projects/1/"])(
    "프로젝트 개요(%s)에서만 프로젝트 항목을 현재 위치로 표시하고 하위 메뉴는 펼쳐 둔다",
    async (route) => {
      const { nav, container } = await renderAt(route);

      expect(within(nav).getByRole("link", { name: "반찬로드" })).toHaveAttribute(
        "aria-current",
        "page",
      );
      expect(container.querySelector('[data-submenu="1"]')).toHaveAttribute("data-open", "true");
    },
  );

  it("워크스페이스 진단 기록(/history)에서는 프로젝트 메뉴를 펼치지 않는다", async () => {
    await renderAt("/history");

    expect(screen.getByRole("navigation", { name: "워크스페이스" })).toContainElement(
      screen.getByRole("link", { current: "page" }),
    );
    expect(screen.queryByRole("list", { name: "반찬로드 메뉴" })).not.toBeInTheDocument();
    expect(document.querySelector('[data-submenu="1"]')).toHaveAttribute("data-open", "false");
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
        <Link to="/projects/1/tests/new">새 테스트로</Link>
      </>,
      { route: "/projects/1" },
    );
    await screen.findByRole("link", { name: "테스트" });
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

describe("Sidebar 하단 개인정보처리방침 링크", () => {
  it("로그아웃 상태에서도 로그인 버튼 위에 /privacy 링크를 둔다", () => {
    renderAt("/");

    const link = screen.getByRole("link", { name: "개인정보처리방침" });
    expect(link).toHaveAttribute("href", "/privacy");
    expect(
      link.compareDocumentPosition(screen.getByRole("button", { name: "로그인" })) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
