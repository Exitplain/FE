import { Link } from "react-router-dom";

import Icon from "@/components/Icon/Icon";
import { buildPath } from "@/constants/routes";
import type { WorkspaceIssue, WorkspaceRun } from "@/types/workspace.type";

export function RecentIssues({ issues }: { issues: WorkspaceIssue[] }) {
  return (
    <section className="space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h2 className="text-lg font-bold">최근 발견한 문제</h2>
          <span className="text-xs text-muted">영향 = 가상 세션 수</span>
        </div>
        <Link to={buildPath("issues")} className="text-caption underline">
          문제 {issues.length}개 전체 보기
        </Link>
      </header>
      <div>
        {[issues[0], issues[1], issues[3]].filter(Boolean).map((issue) => (
          <Link
            key={issue.id}
            to={`${buildPath("issues")}?issue=${issue.id}`}
            className="grid grid-cols-6 items-center gap-4 border-b border-line py-4 last:border-0 hover:bg-gray-50 sm:grid-cols-12"
          >
            <span className="col-span-6 min-w-0 sm:col-span-7">
              <span className="block text-sm font-medium">
                {issue.cause} · {issue.stage}
              </span>
              <span className="mt-1 block text-xs text-muted">
                {issue.projectName} · {issue.task}
              </span>
            </span>
            <span className="col-span-2 text-center text-caption tabular-nums">
              {issue.impact.join("~")}
            </span>
            <span className="col-span-4 flex items-center gap-2 text-caption whitespace-nowrap text-subtle sm:col-span-3">
              <Icon name={issue.verdict === "계속 발생" ? "verdict-repeat" : "verdict-before"} />
              {issue.verdict}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function RecentGoals({ runs }: { runs: WorkspaceRun[] }) {
  const recent = runs
    .filter(
      (run) =>
        (run.status === "completed" && run.predictions.length > 0) || run.status === "failed",
    )
    .slice(0, 4);
  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-bold">최근 테스트별 목표 달성률</h2>
        <span className="rounded border border-line px-1 text-xs">예측</span>
      </header>
      <div className="space-y-4">
        {recent.map((run) => (
          <Link
            key={run.id}
            to={buildPath("report", { projectId: run.projectId, runId: run.id })}
            className="flex flex-wrap items-center gap-2 text-xs hover:underline"
          >
            <span className="flex-1 whitespace-nowrap">
              {run.projectName} {run.title.split(" · ")[0]}
            </span>
            <span className="text-muted">{run.dateLabel}</span>
            {run.status === "failed" ? (
              <span className="flex items-center gap-1 text-subtle">
                <Icon name="status-fail" className="text-danger" />
                실패 · 결과 없음
              </span>
            ) : (
              <>
                <span className="relative h-1.5 w-24 rounded bg-gray-200">
                  <span
                    className="absolute h-full rounded bg-muted"
                    style={{
                      left: `${run.predictions[0][0]}%`,
                      width: `${run.predictions[0][1] - run.predictions[0][0]}%`,
                    }}
                  />
                </span>
                <span>{run.predictions[0].join("~")}%</span>
              </>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
