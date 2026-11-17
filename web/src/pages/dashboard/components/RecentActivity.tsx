import { Link } from "react-router-dom";

import Icon from "@/components/Icon/Icon";
import { buildPath } from "@/constants/routes";
import type { WorkspaceRun } from "@/types/workspace.type";
import { formatRate } from "@/utils/workspaceRuns";

import type { DashboardIssue } from "../utils/dashboardData";

/*
  최근 발견한 문제 — 프로젝트별 최근 리포트의 주요 이탈 원인. 누르면 그 실행의 리포트로 갑니다.
  "발견한 문제" 화면(W03)은 아직 BE API 가 없어 전체 보기 링크는 두지 않습니다.
*/
export function RecentIssues({ issues }: { issues: DashboardIssue[] }) {
  return (
    <section className="space-y-3">
      <header className="flex flex-wrap items-baseline gap-3">
        <h2 className="text-lg font-bold">최근 발견한 문제</h2>
        <span className="text-xs text-muted">영향 = 이탈한 가상 세션 수</span>
      </header>
      {issues.length === 0 ? (
        <p className="py-4 text-caption text-subtle">아직 이탈 원인이 기록된 테스트가 없어요</p>
      ) : (
        <div>
          {issues.map((issue) => (
            <Link
              key={issue.id}
              to={buildPath("report", { projectId: issue.projectId, runId: issue.runId })}
              className="grid grid-cols-6 items-center gap-4 border-b border-line py-4 last:border-0 hover:bg-gray-50 sm:grid-cols-12"
            >
              <span className="col-span-4 min-w-0 sm:col-span-9">
                <span className="block text-sm font-medium">{issue.cause}</span>
                <span className="mt-1 block text-xs text-muted">
                  {issue.projectName} · {issue.runTitle}
                </span>
              </span>
              <span className="col-span-2 text-right text-caption tabular-nums sm:col-span-3">
                {issue.dropouts}명
              </span>
            </Link>
          ))}
        </div>
      )}
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
      {recent.length === 0 ? (
        <p className="text-caption text-subtle">아직 끝난 테스트가 없어요</p>
      ) : (
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
                        /* 값이 하나면 1% 너비의 점으로 */
                        width: `${Math.max(run.predictions[0][1] - run.predictions[0][0], 1)}%`,
                      }}
                    />
                  </span>
                  <span>{formatRate(run.predictions[0])}</span>
                </>
              )}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
