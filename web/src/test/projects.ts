import { screen, waitFor } from "@testing-library/react";
import { expect } from "vitest";

import { createProjectV1 } from "@/apis/project.v1.api";

/*
  /projects/:projectId 화면 테스트 도우미.
  - waitForProject: ProjectRoute 가 GET /api/v1/projects/{id} 를 받아 화면을 그릴 때까지 기다립니다
  - createTestProject: mock 에 내 프로젝트를 하나 만들고 주소에 쓸 id 를 돌려줍니다 (샘플 반찬로드는 "1")
*/
export async function waitForProject() {
  await waitFor(() =>
    expect(
      screen.queryByRole("status", { name: "프로젝트를 불러오는 중이에요" }),
    ).not.toBeInTheDocument(),
  );
}

export async function createTestProject(
  name = "스튜디오 예약",
  entryUrl = "https://studio.example/",
): Promise<string> {
  const project = await createProjectV1({ name, entry_url: entryUrl });
  return String(project.id);
}
