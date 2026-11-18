import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";

import RunStatus from "@/components/Workspace/RunStatus";
import { buildPath } from "@/constants/routes";
import type { WorkspaceRun } from "@/types/workspace.type";
import { formatRate } from "@/utils/workspaceRuns";

import "../history.css";

export default function HistoryTable({
  runs,
  selected,
  onToggle,
  onToggleAll,
  ascending,
  onSort,
  hideProject = false,
}: {
  runs: WorkspaceRun[];
  selected: string[];
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  ascending: boolean;
  onSort: () => void;
  hideProject?: boolean;
}) {
  const all = runs.length > 0 && runs.every((run) => selected.includes(run.id));
  const some = runs.some((run) => selected.includes(run.id));
  const checkbox = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (checkbox.current) checkbox.current.indeterminate = some && !all;
  }, [some, all]);
  return (
    <div className="overflow-x-auto">
      <table className="workspace-table history-table">
        <thead>
          <tr>
            <th>
              <input
                ref={checkbox}
                type="checkbox"
                aria-label="표시된 실행 모두 선택"
                checked={all}
                aria-checked={some && !all ? "mixed" : all}
                disabled={runs.length === 0}
                onChange={onToggleAll}
                className="size-4 accent-ink"
              />
            </th>
            <th>실행</th>
            {!hideProject && <th>프로젝트</th>}
            <th>유형</th>
            <th>상태</th>
            <th>목표 달성률 (예측 · 과업별)</th>
            <th aria-sort={ascending ? "ascending" : "descending"}>
              <button type="button" onClick={onSort} className="whitespace-nowrap text-ink">
                실행일 {ascending ? "↑" : "↓"}
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr key={run.id} data-selected={selected.includes(run.id)}>
              <td>
                <input
                  type="checkbox"
                  aria-label={`${run.title} 선택`}
                  checked={selected.includes(run.id)}
                  onChange={() => onToggle(run.id)}
                  className="size-4 accent-ink"
                />
              </td>
              <td>
                <Link
                  to={buildPath(
                    run.status === "running" || run.status === "queued" ? "testRun" : "report",
                    { projectId: run.projectId, runId: run.id },
                  )}
                  className="font-medium whitespace-nowrap hover:underline"
                >
                  {run.title}
                </Link>
              </td>
              {!hideProject && <td className="whitespace-nowrap">{run.projectName}</td>}
              <td className="whitespace-nowrap text-subtle">{run.type}</td>
              <td className="whitespace-nowrap">
                <RunStatus status={run.status} />
              </td>
              <td className="whitespace-nowrap">
                {run.predictions.length ? run.predictions.map(formatRate).join(" · ") : "—"}
              </td>
              <td className="text-right whitespace-nowrap">{run.dateLabel}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
