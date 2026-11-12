import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithProviders } from "@/test/renderWithProviders";

import ProjectPageHeader from "./ProjectPageHeader";

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
    expect(screen.getByRole("link", { name: "실측 분석" })).toHaveAttribute(
      "href",
      "/projects/banchan/analytics",
    );
    expect(screen.getByRole("link", { name: "보정" })).not.toHaveAttribute("aria-current");
  });
});
