import axiosInstance from "./axiosInstance";

/*
  W04 워크스페이스 설정 — GET·PATCH /api/v1/workspace. 기준: BE backend/accounts/views.WorkspaceView
  - 워크스페이스 이름은 관리(owner)만 바꿀 수 있습니다 (그 밖에는 403 FORBIDDEN)
  - 내 이름은 누구나 바꿀 수 있고, 이메일(로그인 이메일)은 바꿀 수 없습니다
  - 실행 기본값(run_defaults)은 보기 전용입니다
*/
export type WorkspaceRole = "owner" | "member" | "viewer";

export type RunDefaults = {
  viewport_width: number;
  concurrency: number;
  request_interval_seconds: number;
  seed_count: number;
  max_steps: number;
  timeout_seconds: number;
  /* 실행당 비용 상한 (USD). 정해지지 않았으면 null */
  cost_cap: number | null;
};

export type WorkspaceSettingsResponse = {
  workspace: { id: string; name: string; role: WorkspaceRole } | null;
  /* name 은 비어 있을 수 있습니다 */
  me: { id: number; email: string; name: string | null };
  run_defaults: RunDefaults;
};

/* 보낸 값만 바뀝니다. 정의 밖 필드를 보내면 422 (각 50자 이하) */
export type WorkspaceSettingsPatch = { workspace_name?: string; my_name?: string };

export async function getWorkspaceSettings(): Promise<WorkspaceSettingsResponse> {
  const { data } = await axiosInstance.get<WorkspaceSettingsResponse>("/api/v1/workspace");
  return data;
}

export async function updateWorkspaceSettings(
  body: WorkspaceSettingsPatch,
): Promise<WorkspaceSettingsResponse> {
  const { data } = await axiosInstance.patch<WorkspaceSettingsResponse>("/api/v1/workspace", body);
  return data;
}
