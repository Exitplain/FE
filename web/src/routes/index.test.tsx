import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { buildPath } from "@/constants/routes";
import { createTestQueryClient } from "@/test/renderWithProviders";

import { routes } from "./index";

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  // 화면이 서버 데이터를 쓰기 시작해 QueryClient 를 함께 감쌉니다
  render(
    <QueryClientProvider client={createTestQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

const projectId = "banchan";
const runId = "run-1";

describe("라우트 — 사전 테스트 흐름은 프로젝트 아래", () => {
  it("리포트(P12)를 /runs/:runId/report 에서 연다", async () => {
    renderAt(buildPath("report", { projectId, runId }));

    // 저장된 실행이 아닌 runId 라 실행 기록 없음(E18)이 열립니다
    expect(
      await screen.findByRole("heading", { name: "실행 기록을 찾을 수 없어요" }),
    ).toBeInTheDocument();
  });

  it("세션 상세(P15·P16)를 /runs/:runId/sessions/:sessionId 에서 연다", async () => {
    renderAt(buildPath("sessionDetail", { projectId, runId, sessionId: "quick_order" }));

    // 저장된 실행이 아닌 runId 라 세션 없음 안내가 열립니다
    expect(
      await screen.findByRole("heading", { name: "세션을 찾을 수 없어요" }),
    ).toBeInTheDocument();
  });

  it("재테스트 전후 비교(P18)를 /runs/:runId/retest 에서 연다", async () => {
    renderAt(buildPath("retest", { projectId, runId }));

    // 끝난 실행 목록에 없는 runId 라 비교할 실행 없음 안내가 열립니다
    expect(
      await screen.findByRole("heading", { name: "비교할 실행을 찾을 수 없어요" }),
    ).toBeInTheDocument();
  });

  it.each([
    ["projectHistory", "진단 기록"],
    ["projectIssues", "발견한 문제"],
  ] as const)("%s에 프로젝트 전용 화면을 표시한다", async (key, title) => {
    renderAt(buildPath(key, { projectId }));
    expect(await screen.findByRole("heading", { level: 1, name: title })).toBeInTheDocument();
  });

  it("실행 화면(P08~P11)을 /runs/:runId 에서 연다", async () => {
    renderAt(buildPath("testRun", { projectId, runId }));

    // 현재 실행이 아닌 runId 라 안내 화면이 열립니다
    expect(await screen.findByText("이 실행을 찾을 수 없어요")).toBeInTheDocument();
  });

  it("새 테스트(P02~P05c)를 /tests/new 에서 연다", async () => {
    renderAt(buildPath("newTest", { projectId }));

    expect(await screen.findByRole("heading", { level: 1, name: "새 테스트" })).toBeInTheDocument();
  });

  it("목록(/tests)은 새 테스트가 아니라 테스트 목록(P01)을 연다", async () => {
    renderAt(buildPath("testList", { projectId }));

    // 실행 기록이 없어 빈 상태(E02)가 열립니다
    expect(
      await screen.findByRole("heading", { level: 2, name: "아직 진행 중인 테스트가 없어요" }),
    ).toBeInTheDocument();
  });

  it.each([
    "/tests/new",
    "/runs/run-1",
    "/runs/run-1/report",
    "/runs/run-1/sessions/s1",
    "/runs/run-1/retest",
  ])("예전 경로 %s 는 찾을 수 없음 화면을 보여준다", (path) => {
    renderAt(path);

    expect(screen.getByRole("heading", { name: "페이지를 찾을 수 없습니다" })).toBeInTheDocument();
  });

  it("공유 리포트(P21)는 프로젝트 밖 경로에서 사이드바 없이 연다", async () => {
    renderAt(buildPath("sharedReport", { shareId: "abc" }));

    // 저장된 실행이 아닌 shareId 라 만료 안내(E17)가 열립니다
    expect(
      await screen.findByRole("heading", { name: "공유 링크가 만료됐거나 해제됐어요" }),
    ).toBeInTheDocument();
    expect(screen.getByText("읽기 전용")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "대시보드" })).not.toBeInTheDocument();
  });
});
