import StatusBadge from "@/components/StatusBadge/StatusBadge";
import type { WorkspaceRunStatus } from "@/types/workspace.type";

const statuses = {
  queued: { label: "준비 중", icon: "status-wait" },
  running: { label: "실행 중", icon: "status-running" },
  completed: { label: "완료", icon: "status-done" },
  failed: { label: "실패", icon: "status-fail" },
} as const;
export default function RunStatus({ status }: { status: WorkspaceRunStatus }) {
  return (
    <StatusBadge
      {...statuses[status]}
      tone={status === "failed" ? "alert" : "muted"}
      className="bg-transparent px-0 font-normal"
    />
  );
}
