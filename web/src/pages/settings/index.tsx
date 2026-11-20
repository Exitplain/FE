import WorkspaceState, { WorkspaceRetry } from "@/components/Workspace/WorkspaceState";
import { useWorkspaceSettings } from "@/hooks/useWorkspaceSettings";
import { ApiError } from "@/types/api.type";

import WorkspaceSettingsForm from "./components/WorkspaceSettingsForm";

/* W04 워크스페이스 설정 — GET·PATCH /api/v1/workspace */
export default function SettingsPage() {
  const query = useWorkspaceSettings();
  if (query.isPending) return <WorkspaceState kind="loading" title="설정을 불러오는 중이에요" />;
  if (query.error instanceof ApiError && query.error.status === 401)
    return (
      <WorkspaceState
        kind="error"
        title="로그인이 필요해요"
        description="로그인하면 워크스페이스 이름과 내 이름을 바꿀 수 있어요"
      />
    );
  if (query.isError)
    return (
      <WorkspaceState
        kind="error"
        title="설정을 불러오지 못했어요"
        action={<WorkspaceRetry onClick={() => void query.refetch()} />}
      />
    );
  return <WorkspaceSettingsForm initial={query.data} save={query.save.mutateAsync} />;
}
