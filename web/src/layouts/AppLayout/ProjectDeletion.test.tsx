import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import { getProjectDetail } from "@/apis/project.v1.api";
import { queryKeys } from "@/apis/queryKeys";
import ProjectRoute from "@/components/Projects/ProjectRoute";
import { server } from "@/mocks/node";
import { useToastStore } from "@/stores/useToastStore";
import { createTestProject } from "@/test/projects";
import { createTestQueryClient, renderWithProviders } from "@/test/renderWithProviders";

import Sidebar from "./Sidebar";

function LocationProbe() {
  const location = useLocation();
  return (
    <output aria-label="현재 주소">
      {location.pathname}
      {location.search}
      {location.hash}
    </output>
  );
}

afterEach(() =>
  useToastStore.getState().toasts.forEach((toast) => useToastStore.getState().dismiss(toast.id)),
);

async function openDelete(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: "스튜디오 예약 프로젝트 메뉴" }));
  await user.click(screen.getByRole("menuitem", { name: "프로젝트 삭제" }));
  return screen.getByRole("dialog", { name: "프로젝트를 삭제하시겠습니까?" });
}

describe("사이드바 프로젝트 삭제 연결", () => {
  it("보고 있던 프로젝트를 삭제하면 목록으로 이동하고 프로젝트 캐시와 항목을 제거한다", async () => {
    const id = await createTestProject();
    const user = userEvent.setup();
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(
      queryKeys.projectsV1.detail(Number(id)),
      await getProjectDetail(Number(id)),
    );
    renderWithProviders(
      <>
        <Sidebar />
        <LocationProbe />
        <Routes>
          <Route
            path="/projects/:projectId/tests"
            element={
              <ProjectRoute>
                <input aria-label="프로젝트 작업" />
              </ProjectRoute>
            }
          />
          <Route path="/projects" element={<h1>프로젝트 목록</h1>} />
        </Routes>
      </>,
      { route: `/projects/${id}/tests`, queryClient },
    );
    const dialog = await openDelete(user);
    await user.click(within(dialog).getByRole("button", { name: "삭제" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() =>
      expect(screen.getByLabelText("현재 주소")).toHaveTextContent(/^\/projects$/),
    );
    expect(screen.getByRole("heading", { name: "프로젝트 목록" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "스튜디오 예약" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "반찬로드" })).toBeInTheDocument();
    expect(queryClient.getQueryData(queryKeys.projectsV1.detail(Number(id)))).toBeUndefined();
  });

  it("다른 화면에서 삭제하면 그 화면의 주소와 작성 중인 입력을 유지한다", async () => {
    await createTestProject();
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <Sidebar />
        <LocationProbe />
        <input aria-label="작업 메모" />
      </>,
      {
        route: "/history?status=completed#work",
      },
    );
    await user.type(screen.getByLabelText("작업 메모"), "보존할 입력");
    const dialog = await openDelete(user);
    await user.click(within(dialog).getByRole("button", { name: "삭제" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByLabelText("현재 주소")).toHaveTextContent("/history?status=completed#work");
    expect(screen.getByLabelText("작업 메모")).toHaveValue("보존할 입력");
    expect(screen.queryByRole("link", { name: "스튜디오 예약" })).not.toBeInTheDocument();
  });

  it.each([
    [409, "RUN_IN_PROGRESS", "진행 중인 테스트가 있어요"],
    [403, "FORBIDDEN", "삭제할 권한이 없어요"],
    [401, "AUTH_REQUIRED", "다시 로그인한 뒤 삭제해 주세요"],
    [404, "NOT_FOUND", "프로젝트를 찾을 수 없어요"],
  ])("실패 응답 %s %s는 확인창에 안내하고 프로젝트를 유지한다", async (status, code, message) => {
    const id = await createTestProject();
    server.use(
      http.delete(`*/api/v1/projects/${id}`, () =>
        HttpResponse.json(
          { error: { code, message: "삭제 실패", fields: {} }, request_id: "req_delete_test" },
          { status: Number(status) },
        ),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <Sidebar />
        <LocationProbe />
      </>,
      { route: `/projects/${id}/tests` },
    );
    const dialog = await openDelete(user);
    await user.click(within(dialog).getByRole("button", { name: "삭제" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(String(message));
    expect(screen.getByRole("link", { name: "스튜디오 예약" })).toBeInTheDocument();
    expect(screen.getByLabelText("현재 주소")).toHaveTextContent(`/projects/${id}/tests`);
    expect(within(dialog).getByRole("button", { name: "취소" })).toBeEnabled();
  });
});
