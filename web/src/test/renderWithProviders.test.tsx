import { screen } from "@testing-library/react";
import { useParams } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { renderWithProviders } from "./renderWithProviders";

function ProjectIdProbe() {
  const { projectId } = useParams();
  return <p>{projectId ?? "없음"}</p>;
}

describe("renderWithProviders", () => {
  it("path 를 넘기면 route 의 파라미터를 useParams 로 읽을 수 있다", () => {
    renderWithProviders(<ProjectIdProbe />, {
      route: "/projects/banchan/tests",
      path: "/projects/:projectId/tests",
    });

    expect(screen.getByText("banchan")).toBeInTheDocument();
  });

  it("path 가 없으면 파라미터 없이 렌더링한다", () => {
    renderWithProviders(<ProjectIdProbe />, { route: "/projects/banchan/tests" });

    expect(screen.getByText("없음")).toBeInTheDocument();
  });
});
