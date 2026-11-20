import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { projectErrorHandlers } from "@/mocks/handlers/projects";
import { server } from "@/mocks/node";
import { useDemoSessionStore } from "@/stores/useDemoSessionStore";
import { renderWithProviders } from "@/test/renderWithProviders";

import { parseProjectId, useCurrentProject } from "./currentProject";

function ProjectProbe() {
  const project = useCurrentProject();
  return (
    <p>
      {project.name} · {project.v1Id} · {project.isSample ? "샘플" : "내 프로젝트"}
    </p>
  );
}

function renderAt(projectId: string) {
  return renderWithProviders(<ProjectProbe />, {
    route: `/projects/${projectId}/tests`,
    path: "/projects/:projectId/tests",
  });
}

describe("ProjectRoute (/projects/:projectId 공통)", () => {
  it("주소의 숫자 id 로 프로젝트를 받아 안쪽 화면에 넘긴다", async () => {
    renderAt("1");

    expect(
      screen.getByRole("status", { name: "프로젝트를 불러오는 중이에요" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("반찬로드 · 1 · 샘플")).toBeInTheDocument();
  });

  it("숫자가 아닌 주소(예전 slug)는 묻지 않고 찾을 수 없다고 알린다", async () => {
    let requests = 0;
    server.use(
      http.get("*/api/v1/projects/:projectId", () => {
        requests += 1;
        return HttpResponse.json({});
      }),
    );
    renderAt("banchan");

    expect(screen.getByText("프로젝트를 찾을 수 없어요")).toBeInTheDocument();
    expect(requests).toBe(0);
  });

  it("없는 프로젝트(404)면 찾을 수 없다고 알린다", async () => {
    renderAt("999");

    expect(await screen.findByText("프로젝트를 찾을 수 없어요")).toBeInTheDocument();
  });

  it("로그인이 필요하면(401) 로그인 창을 열 수 있다", async () => {
    server.use(projectErrorHandlers.projectUnauthorized);
    const user = userEvent.setup();
    renderAt("101");

    expect(await screen.findByRole("heading", { name: "로그인이 필요해요" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "로그인" }));
    expect(useDemoSessionStore.getState().dialog).toBe("login");
  });

  it("남의 프로젝트(403)면 권한이 없다고 알린다", async () => {
    server.use(projectErrorHandlers.projectForbidden);
    renderAt("101");

    expect(
      await screen.findByRole("heading", { name: "이 프로젝트를 볼 권한이 없어요" }),
    ).toBeInTheDocument();
  });

  it("받지 못하면 다시 시도할 수 있다", async () => {
    server.use(http.get("*/api/v1/projects/:projectId", () => HttpResponse.error()));
    const user = userEvent.setup();
    renderAt("1");

    /* 네트워크 오류는 한 번 더 물은 뒤(약 1초) 오류를 보여 줍니다 */
    const retry = await screen.findByRole("button", { name: "다시 시도" }, { timeout: 3000 });
    server.resetHandlers();
    await user.click(retry);

    expect(await screen.findByText("반찬로드 · 1 · 샘플")).toBeInTheDocument();
  });
});

describe("parseProjectId", () => {
  it("양의 정수만 받는다", () => {
    expect(parseProjectId("12")).toBe(12);
    expect(parseProjectId("0")).toBeUndefined();
    expect(parseProjectId("012")).toBeUndefined();
    expect(parseProjectId("1.5")).toBeUndefined();
    expect(parseProjectId("banchan")).toBeUndefined();
    expect(parseProjectId(undefined)).toBeUndefined();
    expect(parseProjectId("99999999999999999999")).toBeUndefined();
  });
});
