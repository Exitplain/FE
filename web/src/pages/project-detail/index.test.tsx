import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { getProjectDetail } from "@/apis/project.v1.api";
import { setProjectLoopMock } from "@/mocks/handlers/projects";
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
  it("서버의 프로젝트 이름·주소를 보여주고, 실제 고객 데이터·예측 맞추기 수치는 아직 없어 비워 둔다", async () => {
    renderDetail("1");

    expect(await screen.findByRole("heading", { level: 1, name: "반찬로드" })).toBeInTheDocument();
    expect(screen.getByText("https://banchanroad.example")).toBeInTheDocument();
    expect(screen.getByText("테스트 전")).toBeInTheDocument();
    expect(screen.queryByText("1,240회 방문")).not.toBeInTheDocument();
    expect(screen.queryByText("평균 4.5%p")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "새 테스트 시작하기" })).toHaveAttribute(
      "href",
      "/projects/1/tests/new",
    );
  });

  it("CSV 로만 올린 실측도 실제 고객 데이터 연결됨으로 보여 준다", async () => {
    const projectId = await createTestProject();
    setProjectLoopMock(Number(projectId), {
      measurement: {
        status: "connected",
        last_received_at: null,
        last_imported_at: "2026-11-19T10:00:00+09:00",
      },
    });
    renderDetail(projectId);

    expect(await screen.findByText("연결됨")).toBeInTheDocument();
    expect(screen.getByText("CSV 로 올림")).toBeInTheDocument();
    expect(screen.getByText("마지막으로 올린 날")).toBeInTheDocument();
    expect(screen.queryByText("미연결")).not.toBeInTheDocument();
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
      /* 실행 목록이 비어 있으면 프로젝트 상세의 last_pretest 로 정합니다 */
      http.get("*/api/v1/projects/:projectId/runs", () =>
        HttpResponse.json({ items: [], next_cursor: null, total: 0 }),
      ),
    );
    renderDetail("1");

    expect(await screen.findByText("3차")).toBeInTheDocument();
    expect(screen.queryByText("테스트 전")).not.toBeInTheDocument();
    /* Figma C05: 사전 테스트가 끝나면 사전 테스트는 완료, 실측 분석이 지금 단계 */
    expect(
      screen.getByRole("heading", { name: /실제 고객 데이터 분석\s*지금 단계/ }),
    ).toBeInTheDocument();
    /* 실행 목록을 받은 뒤 버튼이 나옵니다 */
    expect(
      await screen.findByRole("link", { name: "실제 고객 데이터 연결하기" }),
    ).toBeInTheDocument();
  });

  it("실행 목록의 마지막 사전 테스트로 단계를 정한다 — 진행 중이면 그 실행으로, 끝나면 달성률까지", async () => {
    const run = (status: string, report: unknown = null) => ({
      id: "run-9",
      sequence_no: 9,
      name: "9차·첫 주문",
      kind: "pretest",
      status,
      change_note: "",
      parent_run_id: null,
      created_at: "2026-11-17T05:00:00+00:00",
      started_at: null,
      finished_at: null,
      report,
    });
    let current = run("running");
    server.use(
      http.get("*/api/v1/projects/:projectId/runs", () =>
        HttpResponse.json({ items: [current], next_cursor: null, total: 1 }),
      ),
    );
    const { unmount } = renderDetail("1");

    expect(await screen.findByRole("link", { name: "진행 중 테스트 보기" })).toHaveAttribute(
      "href",
      "/projects/1/runs/run-9",
    );
    expect(screen.getByRole("heading", { name: /사전 테스트\s*지금 단계/ })).toBeInTheDocument();
    unmount();

    current = run("completed", {
      id: "r9",
      status: "final",
      revision: 1,
      goal_rates: [],
      achievement_rate: 0.3,
    });
    renderDetail("1");

    expect(
      await screen.findByRole("link", { name: "실제 고객 데이터 연결하기" }),
    ).toBeInTheDocument();
    expect(screen.getByText("9차·첫 주문")).toBeInTheDocument();
    expect(screen.getByText("목표 달성률 (예측)").nextElementSibling).toHaveTextContent("30%");
  });

  it("원인 재현은 건너뛰고, 마지막 재테스트가 실패해도 앞서 끝낸 테스트가 있으면 실제 고객 데이터 분석 단계를 유지한다", async () => {
    const item = (id: string, sequence_no: number, kind: string, status: string) => ({
      id,
      sequence_no,
      name: `${sequence_no}차`,
      kind,
      status,
      change_note: "",
      parent_run_id: null,
      created_at: "2026-11-17T05:00:00+00:00",
      started_at: null,
      finished_at: null,
      report: null,
    });
    server.use(
      http.get("*/api/v1/projects/:projectId/runs", () =>
        HttpResponse.json({
          items: [
            item("repro", 6, "cause_repro", "running"),
            item("retest", 5, "retest", "failed"),
            item("done", 4, "pretest", "completed"),
          ],
          next_cursor: null,
          total: 3,
        }),
      ),
    );
    renderDetail("1");

    expect(
      await screen.findByRole("link", { name: "실제 고객 데이터 연결하기" }),
    ).toBeInTheDocument();
    /* 요약은 마지막 사전 테스트(실패한 5차 재테스트) 기준 */
    expect(screen.getByText("5차")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "진행 중 테스트 보기" })).not.toBeInTheDocument();
  });

  it("실행 목록을 받지 못하면 프로젝트 상세의 마지막 사전 테스트로 그린다", async () => {
    const detail = await getProjectDetail(1);
    const last = {
      run_id: "run-2",
      sequence_no: 2,
      status: "completed" as const,
      created_at: "2026-11-07T05:00:00+00:00",
      finished_at: "2026-11-07T05:20:00+00:00",
    };
    server.use(
      http.get("*/api/v1/projects/:projectId", () =>
        HttpResponse.json({ ...detail, runs: { total: 2, active: 0, last_pretest: last } }),
      ),
      http.get("*/api/v1/projects/:projectId/runs", () => HttpResponse.error()),
    );
    renderDetail("1");

    expect(
      await screen.findByRole("link", { name: "실제 고객 데이터 연결하기" }),
    ).toBeInTheDocument();
    expect(screen.getByText("2차")).toBeInTheDocument();
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
