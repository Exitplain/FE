import { Link } from "react-router-dom";

import Icon from "@/components/Icon/Icon";
import type { IconName } from "@/components/Icon/iconNames";
import { buildPath } from "@/constants/routes";
import type { WorkspaceSnapshot } from "@/types/workspace.type";
import { cn } from "@/utils/cn";

export default function RunningTestCard({ run }: { run: WorkspaceSnapshot["activeRun"] }) {
  const counts: { label: string; value: number; icon: IconName; danger?: boolean }[] = [
    { label: "진행 중", value: run.running, icon: "status-running" },
    { label: "대기", value: run.queued, icon: "status-wait" },
    { label: "완료", value: run.completed, icon: "status-done" },
    { label: "이탈", value: run.exited, icon: "status-exit", danger: true },
    { label: "오류", value: run.errors, icon: "status-error", danger: true },
  ];
  return (
    <section
      aria-labelledby="running-test-title"
      className="overflow-hidden rounded-2xl border border-line shadow-sm"
    >
      <header className="workspace-running-heading space-y-2 p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 id="running-test-title" className="text-base font-bold">
            지금 실행 중
          </h2>
          <Link
            className="text-xs hover:underline"
            to={buildPath("testRun", { projectId: run.projectId, runId: run.id })}
          >
            실시간 보기
          </Link>
        </div>
        <p className="text-sm font-medium">
          {run.name} ({run.seed})
        </p>
      </header>
      <div className="space-y-4 p-4">
        <div className="space-y-2">
          <p className="text-xs">
            세션 {run.completed + run.exited + run.errors} / {run.total} 종료
          </p>
          <div
            className="flex h-1.5 overflow-hidden rounded-full bg-gray-200"
            aria-label="세션 결과 분포"
          >
            <span
              className="bg-subtle"
              style={{ width: `${(run.completed / run.total) * 100}%` }}
            />
            <span className="bg-danger" style={{ width: `${(run.exited / run.total) * 100}%` }} />
            <span className="bg-muted" style={{ width: `${(run.errors / run.total) * 100}%` }} />
          </div>
        </div>
        <dl className="space-y-2">
          {counts.map((item) => (
            <div key={item.label} className="flex items-center justify-between text-caption">
              <dt className="flex items-center gap-2">
                <Icon name={item.icon} className={cn("size-4", item.danger && "text-danger")} />
                {item.label}
              </dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
