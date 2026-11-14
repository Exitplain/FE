import WorkspaceState, { WorkspaceRetry } from "@/components/Workspace/WorkspaceState";
import { useWorkspaceSettings } from "@/hooks/useWorkspaceData";

import WorkspaceSettingsForm from "./components/WorkspaceSettingsForm";

export default function SettingsPage() {
  const query = useWorkspaceSettings();
  if (query.isPending) return <WorkspaceState kind="loading" title="설정을 불러오는 중이에요" />;
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
