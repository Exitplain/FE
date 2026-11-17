import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { server } from "@/mocks/node";
import { createTestProject } from "@/test/projects";
import { renderWithProviders } from "@/test/renderWithProviders";
import type { RunItem } from "@/types/run.type";

import DiagnosisHistoryPage from ".";

const run = (id: string, overrides: Partial<RunItem> = {}): RunItem => ({
  id,
  sequence_no: 1,
  name: id,
  kind: "pretest",
  status: "completed",
  change_note: "",
  parent_run_id: null,
  created_at: new Date().toISOString(),
  started_at: null,
  finished_at: null,
  report: {
    id: `report-${id}`,
    status: "final",
    revision: 1,
    goal_rates: [{ task_id: "order", name: "첫 주문", achievement_rate: 0.25 }],
  },
  ...overrides,
});

/* 프로젝트 id → 실행 목록 (GET /api/v1/projects/{id}/runs) */
function serveRuns(byProject: Record<string, RunItem[]>) {
  server.use(
    http.get("*/api/v1/projects/:projectId/runs", ({ params }) => {
      const items = byProject[String(params.projectId)] ?? [];
      return HttpResponse.json({ items, next_cursor: null, total: items.length });
    }),
  );
}

describe("진단 기록 (제품 API 실행 목록)", () => {
  it("W02 — 여러 프로젝트의 실행을 모으고 프로젝트·상태로 거른다", async () => {
    const user = userEvent.setup();
    const studio = await createTestProject();
    serveRuns({
      "1": [run("반찬 1차")],
      [studio]: [run("예약 1차", { status: "failed", report: null })],
    });
    renderWithProviders(<DiagnosisHistoryPage />, { route: "/history" });

    expect(await screen.findByRole("link", { name: "예약 1차" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "반찬 1차" })).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /반찬 1차/ })).toHaveTextContent("25%");

    await user.selectOptions(
      screen.getByRole("combobox", { name: "프로젝트 필터" }),
      screen.getByRole("option", { name: "프로젝트 · 스튜디오 예약" }),
    );
    expect(screen.queryByRole("link", { name: "반찬 1차" })).not.toBeInTheDocument();
    await user.selectOptions(screen.getByRole("combobox", { name: "상태 필터" }), "completed");
    expect(screen.getByText("조건에 맞는 실행이 없어요")).toBeInTheDocument();
  });

  it("같은 프로젝트의 완료 실행 두 개를 비교한다", async () => {
    const user = userEvent.setup();
    serveRuns({ "1": [run("1차"), run("2차")] });
    renderWithProviders(<DiagnosisHistoryPage />, { route: "/history" });

    await user.click(await screen.findByRole("checkbox", { name: "1차 선택" }));
    expect(screen.getByRole("button", { name: "선택한 1개 비교" })).toBeDisabled();
    await user.click(screen.getByRole("checkbox", { name: "2차 선택" }));
    await user.click(screen.getByRole("button", { name: "선택한 2개 비교" }));
    expect(within(screen.getByRole("dialog")).getAllByText("과업 1 · 25%")).toHaveLength(2);
  });

  it("실행 목록을 받지 못하면 다시 시도할 수 있다", async () => {
    server.use(http.get("*/api/v1/projects/:projectId/runs", () => HttpResponse.error()));
    renderWithProviders(<DiagnosisHistoryPage />, { route: "/history" });

    expect(
      await screen.findByRole("heading", { name: "진단 기록을 불러오지 못했어요" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /다시 시도/ })).toBeInTheDocument();
  });
});
