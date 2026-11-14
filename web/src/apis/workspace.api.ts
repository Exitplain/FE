import { defaultWorkspaceSettings, workspaceFixture } from "@/mocks/fixtures/workspace";
import type { WorkspaceSettings, WorkspaceSnapshot } from "@/types/workspace.type";

import { getProjects } from "./project.api";

const SETTINGS_KEY = "exitplain-workspace-demo-settings";

/* API 연결 지점. persona API·MSW 핸들러는 변경하지 않습니다. 실제 API 응답은 이 타입으로 변환합니다. */
export async function getWorkspaceSnapshot(): Promise<WorkspaceSnapshot> {
  return { ...structuredClone(workspaceFixture), projects: await getProjects() };
}

export async function getWorkspaceSettings(): Promise<WorkspaceSettings> {
  try {
    const saved: unknown = JSON.parse(sessionStorage.getItem(SETTINGS_KEY) || "null");
    if (
      saved &&
      typeof saved === "object" &&
      "workspaceName" in saved &&
      typeof saved.workspaceName === "string" &&
      "displayName" in saved &&
      typeof saved.displayName === "string" &&
      "notificationEmail" in saved &&
      typeof saved.notificationEmail === "string"
    )
      return {
        workspaceName: saved.workspaceName,
        displayName: saved.displayName,
        notificationEmail: saved.notificationEmail,
      };
  } catch {
    /* 오래된 데모 설정은 기본값으로 복원합니다. */
  }
  return { ...defaultWorkspaceSettings };
}

export async function saveWorkspaceSettings(
  settings: WorkspaceSettings,
): Promise<WorkspaceSettings> {
  const saved = {
    ...settings,
    workspaceName: settings.workspaceName.trim(),
    displayName: settings.displayName.trim(),
    notificationEmail: settings.notificationEmail.trim(),
  };
  sessionStorage.setItem(SETTINGS_KEY, JSON.stringify(saved));
  return saved;
}
