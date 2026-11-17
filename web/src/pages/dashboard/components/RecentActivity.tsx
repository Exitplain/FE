import { Link } from "react-router-dom";

import Icon from "@/components/Icon/Icon";
import { buildPath } from "@/constants/routes";
import type { WorkspaceIssue, WorkspaceRun } from "@/types/workspace.type";
import { formatRate } from "@/utils/workspaceRuns";

/* 대시보드에 보여 줄 최근 문제 수 (BE 가 판정 · 이탈 수 순서로 줍니다) */
const RECENT_ISSUES = 3;

/*
  최근 발견한 문제 — GET /api/v1/issues 의 앞 3개. 누르면 발견한 문제(W03)에서 그 문제를 엽니다.
  불러오지 못하면(로그인 전 401 등) 짧게 안내만 하고 대시보드의 다른 부분은 그대로 둡니다.
*/
export function RecentIssues({
  issues,
  failed = false,
  loggedOut = false,
}: {
  issues: WorkspaceIssue[] | undefined;
  failed?: boolean;
  /* 로그인 전(401): 오류가 아니라 안내 */
  loggedOut?: boolean;
}) {
  return (
    <section className="space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h2 className="text-lg font-bold">최근 발견한 문제</h2>
          <span className="text-xs text-muted">영향 = 가상 세션 수</span>
        </div>
        {issues && issues.length > 0 && (
          <Link to={buildPath("issues")} className="text-caption underline">
            문제 {issues.length}개 전체 보기
          </Link>
        )}
      </header>
      {loggedOut ? (
        <p className="py-4 text-caption text-subtle">
          로그인하면 내 프로젝트에서 발견한 문제를 모아 보여 줘요
        </p>
      ) : failed ? (
        <p className="py-4 text-caption text-subtle">발견한 문제를 불러오지 못했어요</p>
      ) : !issues ? (
        <p className="py-4 text-caption text-subtle">불러오는 중이에요</p>
      ) : issues.length === 0 ? (
        <p className="py-4 text-caption text-subtle">아직 발견한 문제가 없어요</p>
      ) : (
        <div>
          {issues.slice(0, RECENT_ISSUES).map((issue) => (
            <Link
              key={issue.id}
              to={`${buildPath("issues")}?issue=${encodeURIComponent(issue.id)}`}
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
                {issue.impact[0] === issue.impact[1] ? issue.impact[0] : issue.impact.join("~")}
              </span>
              <span className="col-span-4 flex items-center gap-2 text-caption whitespace-nowrap text-subtle sm:col-span-3">
                <Icon
                  name={
                    issue.verdict === "계속 발생"
                      ? "verdict-repeat"
                      : issue.verdict === "새로 발견"
                        ? "verdict-new"
                        : "verdict-before"
                  }
                />
                {issue.verdict}
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
                {run.projectName} {run.title.split(/\s*·\s*/)[0]}
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
