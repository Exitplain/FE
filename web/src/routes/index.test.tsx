import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { buildPath, ROUTES, type RouteKey } from "@/constants/routes";
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

/*
  아직 화면이 없는 라우트는 PagePlaceholder 가 제목과 경로 패턴을 보여줍니다.
  화면을 구현해 PagePlaceholder 를 지우면 해당 케이스의 확인 대상(제목 등)도 같이 바꿉니다.
*/
function expectPlaceholder(key: RouteKey) {
  expect(screen.getByRole("heading", { level: 1, name: ROUTES[key].title })).toBeInTheDocument();
  expect(screen.getByText(ROUTES[key].path)).toBeInTheDocument();
}

const projectId = "banchan";
const runId = "run-1";

describe("라우트 — 사전 테스트 흐름은 프로젝트 아래", () => {
  it.each([
    ["report", buildPath("report", { projectId, runId })],
    ["sessionDetail", buildPath("sessionDetail", { projectId, runId, sessionId: "quick_order" })],
    ["retest", buildPath("retest", { projectId, runId })],
  ] as const)("%s 화면을 %s 에서 연다", (key, path) => {
    renderAt(path);

    expectPlaceholder(key);
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

    expect(
      await screen.findByRole("heading", { level: 2, name: "사전 테스트" }),
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

  it("공유 리포트는 프로젝트 밖 경로를 유지한다", () => {
    renderAt(buildPath("sharedReport", { shareId: "abc" }));

    expectPlaceholder("sharedReport");
  });
});
