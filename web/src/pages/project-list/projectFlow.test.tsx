import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { getWorkspaceSnapshot } from "@/apis/workspace.api";
import Sidebar from "@/layouts/AppLayout/Sidebar";
import ProjectHistoryPage from "@/pages/project-history";
import ProjectIssuesPage from "@/pages/project-issues";
import { getMyProjects } from "@/apis/project.v1.api";
import { createTestProject } from "@/test/projects";
import { renderWithProviders } from "@/test/renderWithProviders";

import ProjectListPage from ".";

/* 목록은 제품 API(내 프로젝트 + 샘플)로 받으므로 첫 행이 그려질 때까지 기다립니다 */
async function waitForList() {
  await screen.findByRole("link", { name: "반찬로드" });
}
function LocationProbe() {
  return <output aria-label="현재 주소">{useLocation().pathname}</output>;
}

describe("프로젝트 작업 흐름", () => {
  it("조합을 끝내거나 다른 곳을 누르기 전에도 검색 안내와 결과가 입력값을 따른다", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProjectListPage />, { route: "/projects" });
    await waitForList();
    const search = screen.getByRole("textbox", { name: "프로젝트 이름 또는 URL 검색" });
    await user.click(search);
    fireEvent.compositionStart(search);
    for (const value of ["이", "이정", "이정능"]) {
      fireEvent.change(search, { target: { value } });
      expect(search).toHaveValue(value);
      expect(search).toHaveFocus();
      expect(screen.getByText(`‘${value}’ 검색 결과 0개`)).toBeInTheDocument();
      expect(screen.getByText(`‘${value}’과 맞는 프로젝트가 없어요`)).toBeInTheDocument();
    }
    fireEvent.compositionEnd(search, { data: "능" });
    fireEvent.change(search, { target: { value: "반찬" } });
    expect(screen.getByText("‘반찬’ 검색 결과 1개")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "반찬로드" })).toBeInTheDocument();
  });

  it("이름·URL 검색과 검색 결과 초기화가 동작한다", async () => {
    const user = userEvent.setup();
    await createTestProject();
    renderWithProviders(<ProjectListPage />, { route: "/projects" });
    await waitForList();
    const search = screen.getByRole("textbox", { name: "프로젝트 이름 또는 URL 검색" });
    await user.type(search, "없는프로젝트");
    expect(screen.getByText("‘없는프로젝트’과 맞는 프로젝트가 없어요")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "검색어 지우기" })[0]);
    expect(screen.getByRole("link", { name: "반찬로드" })).toBeInTheDocument();
    await user.type(search, "studio.example");
    expect(screen.getByRole("link", { name: "스튜디오 예약" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "반찬로드" })).not.toBeInTheDocument();
  });

  it("프로젝트 생성 후 목록·사이드바·대시보드 공급 데이터·기존 프로젝트 조회에서 찾을 수 있다", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <Sidebar />
        <ProjectListPage />
        <LocationProbe />
      </>,
      { route: "/projects?create=1" },
    );
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByRole("textbox", { name: "프로젝트 이름" }), "새 쇼핑몰");
    await user.type(
      within(dialog).getByRole("textbox", { name: "사이트 URL" }),
      "https://new-shop.example",
    );
    await user.type(within(dialog).getByRole("textbox", { name: "점검할 고객 여정" }), "주문 완료");
    await user.click(within(dialog).getByRole("button", { name: "만들기" }));
    /* POST /api/v1/projects 가 준 숫자 id 의 개요로 이동합니다 */
    await waitFor(() =>
      expect(screen.getByLabelText("현재 주소")).toHaveTextContent(/^\/projects\/101$/),
    );
    const [created] = (await getMyProjects()).items;
    expect(created).toMatchObject({
      id: 101,
      name: "새 쇼핑몰",
      entry_url: "https://new-shop.example/",
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      await within(screen.getByRole("navigation", { name: "프로젝트" })).findByRole("link", {
        name: "새 쇼핑몰",
      }),
    ).toBeInTheDocument();
    expect((await getWorkspaceSnapshot()).projects.some((project) => project.id === "101")).toBe(
      true,
    );
  });

  it("잘못된 URL과 중복 사이트를 막고 입력값을 유지한다", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProjectListPage />, { route: "/projects?create=1" });
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "만들기" }));
    expect(screen.getByText("프로젝트 이름을 입력해주세요")).toBeInTheDocument();
    expect(within(dialog).getByRole("textbox", { name: "프로젝트 이름" })).toHaveFocus();
    expect(screen.getByText("HTTP 또는 HTTPS로 시작하는 주소를 입력해주세요")).toBeInTheDocument();
    await user.type(
      within(dialog).getByRole("textbox", { name: "프로젝트 이름" }),
      "중복 프로젝트",
    );
    expect(screen.queryByText("프로젝트 이름을 입력해주세요")).not.toBeInTheDocument();
    await user.type(
      within(dialog).getByRole("textbox", { name: "사이트 URL" }),
      "https://banchanroad.example",
    );
    await user.click(within(dialog).getByRole("button", { name: "만들기" }));
    /* 서버가 409 DUPLICATE_PROJECT 로 짚은 사이트 URL 칸 아래에 알립니다 */
    expect(
      await within(dialog).findByText("이미 등록된 사이트예요. 기존 프로젝트를 확인해 주세요"),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("textbox", { name: "사이트 URL" })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(within(dialog).getByRole("textbox", { name: "프로젝트 이름" })).toHaveValue(
      "중복 프로젝트",
    );
    expect((await getMyProjects()).items).toHaveLength(0);
  });

  it("프로젝트 없음 화면에서 생성 폼으로 이동할 수 있다", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProjectListPage />, { route: "/projects?state=empty" });
    expect(await screen.findByText("아직 프로젝트가 없어요")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "검색어 지우기" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "새 프로젝트 만들기" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

describe("프로젝트별 기록·문제 격리", () => {
  it("다른 프로젝트 쿼리가 있어도 해당 프로젝트의 기록만 표시한다", async () => {
    renderWithProviders(<ProjectHistoryPage />, {
      route: "/projects/1/history?project=101",
      path: "/projects/:projectId/history",
    });
    expect(
      await screen.findByRole("link", { name: "4차 · 첫 주문 완료 외 1개" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "1차 · 예약 완료" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "프로젝트 필터" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("checkbox")).toHaveLength(5);
  });

  it("프로젝트의 문제 개수와 원인 필터가 독립적으로 계산된다", async () => {
    renderWithProviders(<ProjectIssuesPage />, {
      route: "/projects/1/issues",
      path: "/projects/:projectId/issues",
    });
    expect(
      await screen.findByRole("button", { name: "입력 부담 · 가입 단계" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "기술 오류·지연 · 랜딩 단계" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/3개 묶음/)).toBeInTheDocument();
  });
});
