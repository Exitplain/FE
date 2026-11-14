import type { CreatedProject } from "@/types/project.type";
import { validateProjectInput } from "@/utils/projectInput";

export const PROJECT_STORAGE_KEY = "exitplain-project-demo-records";

/* 서버 API 전의 탭 단위 저장소. 다른 기능의 fixture·스토어는 수정하지 않습니다. */
export function readCreatedProjects(): CreatedProject[] {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(PROJECT_STORAGE_KEY) || "[]");
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is CreatedProject => {
      if (!item || typeof item !== "object") return false;
      const record = item as Record<string, unknown>;
      if (!(
        typeof record.id === "string" &&
        record.id.startsWith("project-") &&
        typeof record.name === "string" &&
        typeof record.url === "string" &&
        typeof record.journey === "string" &&
        typeof record.createdAt === "string"
      ))
        return false;
      return (
        validateProjectInput({
          name: record.name as string,
          url: record.url as string,
          journey: record.journey as string,
        }).valid && Number.isFinite(new Date(record.createdAt as string).getTime())
      );
    });
  } catch {
    return [];
  }
}

export function saveCreatedProject(project: CreatedProject) {
  sessionStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify([...readCreatedProjects(), project]));
}
