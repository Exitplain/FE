import { workspaceFixture } from "@/mocks/fixtures/workspace";
import { emptyProjectOverview, projectOverviewFixtures } from "@/mocks/fixtures/projects";
import { validateProjectInput } from "@/utils/projectInput";
import type { ProjectInput, ProjectOverview, ProjectRecord } from "@/types/project.type";
import { readCreatedProjects, saveCreatedProject } from "@/utils/projectRegistry";

export function readProjectRecords(): ProjectRecord[] {
  return [
    ...workspaceFixture.projects.map((project): ProjectRecord => ({
      ...project,
      journey:
        project.id === "banchan"
          ? "첫 주문 완료"
          : project.id === "studio"
            ? "예약 완료"
            : "매입 신청",
      lastTestStatus:
        project.id === "banchan" ? "completed" : project.id === "studio" ? "running" : "failed",
      updatedLabel:
        project.id === "banchan" ? "14:32" : project.id === "studio" ? "11월 6일" : "11월 3일",
      isSample: true,
    })),
    ...readCreatedProjects().map((project): ProjectRecord => ({
      id: project.id,
      name: project.name,
      url: project.url,
      journey: project.journey,
      stage: 0,
      stageLabel: "사전 테스트",
      stageDetail: "테스트 전",
      analytics: "실측 미연결",
      calibration: "보정 전",
      action: "첫 테스트 시작",
      actionTarget: "testList",
      lastTestStatus: null,
      updatedLabel: "방금",
      isSample: false,
    })),
  ];
}

export async function getProjects(): Promise<ProjectRecord[]> {
  return structuredClone(readProjectRecords());
}

export async function getProjectOverview(
  projectId: string,
  unconnected = false,
): Promise<ProjectOverview> {
  if (!readProjectRecords().some((project) => project.id === projectId))
    throw new Error("프로젝트를 찾을 수 없어요");
  const overview = structuredClone(projectOverviewFixtures[projectId] ?? emptyProjectOverview());
  if (unconnected) {
    overview.phase = overview.test.status === "completed" ? 2 : 1;
    overview.analytics = emptyProjectOverview().analytics;
    overview.calibration = emptyProjectOverview().calibration;
  }
  return overview;
}

export async function createProject(input: ProjectInput): Promise<ProjectRecord> {
  const result = validateProjectInput(input);
  if (!result.valid) throw new Error(Object.values(result.errors)[0]);
  const origin = new URL(result.value.url).origin;
  if (readProjectRecords().some((project) => new URL(project.url).origin === origin))
    throw new Error("이미 등록된 사이트예요. 기존 프로젝트를 확인해 주세요");
  const id = `project-${crypto.randomUUID()}`;
  try {
    saveCreatedProject({ ...result.value, id, createdAt: new Date().toISOString() });
  } catch {
    throw new Error("프로젝트를 저장하지 못했어요. 저장 공간을 확인하고 다시 시도해 주세요");
  }
  const created = readProjectRecords().find((project) => project.id === id);
  if (!created) throw new Error("프로젝트를 저장하지 못했어요. 다시 시도해 주세요");
  return created;
}
