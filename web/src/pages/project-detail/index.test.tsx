import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { createProject, getProjectOverview } from "@/apis/project.api";
import { renderWithProviders } from "@/test/renderWithProviders";
import { PROJECT_STORAGE_KEY } from "@/utils/projectRegistry";

import ProjectDetailPage from ".";

afterEach(() => sessionStorage.removeItem(PROJECT_STORAGE_KEY));

describe("프로젝트 개요 데이터와 상태", () => {
  it("C06의 실측·보정 수치를 조회한 데이터로 표시한다", async () => {
    renderWithProviders(<ProjectDetailPage />, {
      route: "/projects/banchan",
      path: "/projects/:projectId",
    });
    expect(await screen.findByText("1,240 세션")).toBeInTheDocument();
    expect(screen.getByText("298 세션 · 24.0%")).toBeInTheDocument();
    expect(screen.getByText("평균 4.5%p")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "조정안 확인" })).toHaveAttribute(
      "href",
      "/projects/banchan/calibration",
    );
  });

  it("C05 미연결 상태에는 실측·보정 수치를 표시하지 않는다", async () => {
    renderWithProviders(<ProjectDetailPage />, {
      route: "/projects/banchan?variant=unconnected",
      path: "/projects/:projectId",
    });
    expect(await screen.findByText("스크립트 미설치")).toBeInTheDocument();
    expect(screen.queryByText("1,240 세션")).not.toBeInTheDocument();
    expect(screen.queryByText("평균 4.5%p")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "실측 데이터 연결하기" })).toHaveAttribute(
      "href",
      "/projects/banchan/analytics",
    );
  });

  it("새 프로젝트에는 샘플의 테스트·실측·연결 결과가 섞이지 않는다", async () => {
    const project = await createProject({
      name: "새 프로젝트",
      url: "https://new-project.example",
      journey: "주문 완료",
    });
    const overview = await getProjectOverview(project.id);
    expect(overview.connection).toBeNull();
    expect(overview.test.status).toBeNull();
    expect(overview.analytics.landingSessions).toBeNull();
    renderWithProviders(<ProjectDetailPage />, {
      route: `/projects/${project.id}`,
      path: "/projects/:projectId",
    });
    expect(await screen.findByText("테스트 전")).toBeInTheDocument();
    expect(screen.queryByText(/로그인 연결 · 연결됨/)).not.toBeInTheDocument();
    expect(screen.queryByText("20~30%")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "새 테스트 시작하기" })).toHaveAttribute(
      "href",
      `/projects/${project.id}/tests/new`,
    );
  });
});
