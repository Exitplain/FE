import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { getProjectDetail } from "@/apis/project.v1.api";
import { server } from "@/mocks/node";
import { createTestProject } from "@/test/projects";
import { renderWithProviders } from "@/test/renderWithProviders";

import ProjectDetailPage from ".";

function renderDetail(projectId: string) {
  return renderWithProviders(<ProjectDetailPage />, {
    route: `/projects/${projectId}`,
    path: "/projects/:projectId",
  });
}

describe("C05 프로젝트 개요 (GET /api/v1/projects/{id})", () => {
  it("서버의 프로젝트 이름·주소를 보여주고, 실측·보정 수치는 아직 없어 비워 둔다", async () => {
    renderDetail("1");

    expect(await screen.findByRole("heading", { level: 1, name: "반찬로드" })).toBeInTheDocument();
    expect(screen.getByText("https://banchanroad.example")).toBeInTheDocument();
    expect(screen.getByText("테스트 전")).toBeInTheDocument();
    expect(screen.queryByText("1,240 세션")).not.toBeInTheDocument();
    expect(screen.queryByText("평균 4.5%p")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "새 테스트 시작하기" })).toHaveAttribute(
      "href",
      "/projects/1/tests/new",
    );
  });

  it("마지막 사전 테스트가 있으면 차수·상태를 보여준다", async () => {
    const detail = await getProjectDetail(1);
    const last = {
      run_id: "run-3",
      sequence_no: 3,
      status: "completed" as const,
      created_at: "2026-11-07T05:00:00+00:00",
      finished_at: "2026-11-07T05:20:00+00:00",
    };
    server.use(
      http.get("*/api/v1/projects/:projectId", () =>
        HttpResponse.json({
          ...detail,
          last_pretest: last,
          runs: { total: 3, active: 0, last_pretest: last },
        }),
      ),
    );
    renderDetail("1");

    expect(await screen.findByText("3차")).toBeInTheDocument();
    expect(screen.getByText("완료")).toBeInTheDocument();
    expect(screen.queryByText("테스트 전")).not.toBeInTheDocument();
  });

  it("새로 만든 프로젝트는 그 id 의 주소로 연결한다", async () => {
    const projectId = await createTestProject("새 프로젝트", "https://new-project.example");
    renderDetail(projectId);

    expect(
      await screen.findByRole("heading", { level: 1, name: "새 프로젝트" }),
    ).toBeInTheDocument();
    expect(screen.getByText("테스트 전")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "새 테스트 시작하기" })).toHaveAttribute(
      "href",
      `/projects/${projectId}/tests/new`,
    );
  });
});
