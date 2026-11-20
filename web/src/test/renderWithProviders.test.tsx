import { screen } from "@testing-library/react";
import { useParams } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { renderWithProviders } from "./renderWithProviders";

function ProjectIdProbe() {
  const { projectId } = useParams();
  return <p>{projectId ?? "없음"}</p>;
}

describe("renderWithProviders", () => {
  it("path 를 넘기면 route 의 파라미터를 useParams 로 읽을 수 있다", async () => {
    renderWithProviders(<ProjectIdProbe />, {
      route: "/projects/1/tests",
      path: "/projects/:projectId/tests",
    });

    /* :projectId 가 있으면 ProjectRoute 가 프로젝트를 받은 뒤 화면을 그립니다 */
    expect(await screen.findByText("1")).toBeInTheDocument();
  });

  it("path 가 없으면 파라미터 없이 렌더링한다", () => {
    renderWithProviders(<ProjectIdProbe />, { route: "/projects/1/tests" });

    expect(screen.getByText("없음")).toBeInTheDocument();
  });
});
