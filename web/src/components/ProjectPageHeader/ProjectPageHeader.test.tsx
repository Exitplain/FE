import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { wantsResumeActiveRun } from "@/constants/navigationState";
import { renderWithProviders } from "@/test/renderWithProviders";

import ProjectPageHeader, { type ProjectTab } from "./ProjectPageHeader";

describe("ProjectPageHeader", () => {
  it("경로·제목·설명과 프로젝트 탭을 보여주고, 현재 탭을 표시한다", () => {
    renderWithProviders(
      <ProjectPageHeader
        projectId="banchan"
        breadcrumb="반찬로드 · 테스트"
        title="반찬로드"
        description="https://banchanroad.example"
        activeTab="tests"
      />,
    );

    expect(screen.getByText("반찬로드 · 테스트")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "반찬로드" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "테스트 목록" })).toHaveAttribute(
      "href",
      "/projects/banchan/tests",
    );
    expect(screen.getByRole("link", { name: "테스트 목록" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "실제 고객 데이터 분석" })).toHaveAttribute(
      "href",
      "/projects/banchan/analytics",
    );
    expect(screen.getByRole("link", { name: "예측 맞추기" })).not.toHaveAttribute("aria-current");
  });

  it.each(["analytics", "calibration"] as const)(
    "%s 탭에서 테스트 목록으로 가면 진행 중인 실행 이어 보기를 요청한다",
    async (activeTab) => {
      renderHeaderWithProbe(activeTab);

      await userEvent.setup().click(screen.getByRole("link", { name: "테스트 목록" }));

      expect(await screen.findByText("이어 보기 true")).toBeInTheDocument();
    },
  );

  it("이미 테스트 목록 탭 안(실행·리포트 화면)이면 이어 보기 없이 목록으로 간다", async () => {
    renderHeaderWithProbe("tests");

    await userEvent.setup().click(screen.getByRole("link", { name: "테스트 목록" }));

    expect(await screen.findByText("이어 보기 false")).toBeInTheDocument();
  });
});

function ListProbe() {
  const location = useLocation();
  return <p>이어 보기 {String(wantsResumeActiveRun(location.state))}</p>;
}

function renderHeaderWithProbe(activeTab: ProjectTab) {
  render(
    <MemoryRouter initialEntries={["/projects/1/here"]}>
      <Routes>
        <Route
          path="/projects/1/here"
          element={
            <ProjectPageHeader
              projectId="1"
              breadcrumb="반찬로드 · 테스트"
              title="반찬로드"
              activeTab={activeTab}
            />
          }
        />
        <Route path="/projects/1/tests" element={<ListProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}
