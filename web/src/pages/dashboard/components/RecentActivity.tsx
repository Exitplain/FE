import { Link } from "react-router-dom";

import Icon from "@/components/Icon/Icon";
import { buildPath } from "@/constants/routes";
import { formatDay } from "@/pages/report/utils/reportView";
import type { WorkspaceIssue, WorkspaceRun } from "@/types/workspace.type";
import { formatRate } from "@/utils/workspaceRuns";

/* 대시보드에 보여 줄 최근 문제 수 (BE 가 판정 · 이탈 수 순서로 줍니다) */
const RECENT_ISSUES = 3;

const verdictIcon = (verdict: WorkspaceIssue["verdict"]) =>
  verdict === "계속 발생"
    ? "verdict-repeat"
    : verdict === "새로 발견"
      ? "verdict-new"
      : "verdict-before";

/*
  Figma W01 최근 발견한 문제 — GET /api/v1/issues 의 앞 3개. 누르면 발견한 문제(W03)에서 그 문제를 엽니다.
  행: 원인 · 단계 14px Medium / 프로젝트 · 과업 12px 회색 · 영향 14px · 판정 아이콘 + 14px
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
  const notice = loggedOut
    ? "로그인하면 내 프로젝트에서 발견한 문제를 모아 보여 줘요"
    : failed
      ? "발견한 문제를 불러오지 못했어요"
      : !issues
        ? "불러오는 중이에요"
        : issues.length === 0
          ? "아직 발견한 문제가 없어요"
          : null;
  return (
    <section className="flex flex-col gap-2">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h2 className="text-lg leading-[26px] font-bold">최근 발견한 문제</h2>
          <span className="text-xs text-muted">영향 = 가상 세션 수</span>
        </div>
        {issues && issues.length > 0 && (
          <Link
            to={buildPath("issues")}
            className="px-2 text-sm font-medium text-ink underline underline-offset-4"
          >
            문제 {issues.length}개 전체 보기
          </Link>
        )}
      </header>
      {notice || !issues ? (
        <p className="py-4 text-sm text-subtle">{notice}</p>
      ) : (
        <div>
          {issues.slice(0, RECENT_ISSUES).map((issue) => (
            <Link
              key={issue.id}
              to={`${buildPath("issues")}?issue=${encodeURIComponent(issue.id)}`}
              className="grid grid-cols-[minmax(0,1fr)_144px_104px] items-center border-b border-line py-3 last:border-0 hover:bg-gray-50"
            >
              <span className="flex min-w-0 flex-col gap-1">
                <span className="truncate text-sm leading-5 font-medium text-ink">
                  {issue.cause} · {issue.stage}
                </span>
                <span className="truncate text-xs leading-4 text-muted">
                  {issue.projectName} · {issue.task}
                </span>
              </span>
              <span className="text-sm leading-5 text-gray-800 tabular-nums">
                {issue.impact[0] === issue.impact[1] ? issue.impact[0] : issue.impact.join("~")}
              </span>
              <span className="flex items-center gap-2 text-sm leading-5 whitespace-nowrap text-gray-800">
                <Icon name={verdictIcon(issue.verdict)} className="size-4" />
                {issue.verdict}
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

/*
  Figma W01 최근 테스트별 목표 달성률 — 이름 13px · 날짜 12px 회색 · 범위 막대 96×6 · 값 13px Medium.
  프로젝트 이름이 길 수 있어 이름 칸만 늘고 줄어들며(말줄임), 날짜(56)·막대+값(142) 칸은 폭을 고정해 행끼리 맞춥니다.
  달성률은 범위가 아니라 값 하나라, 그 자리에 짧은 구간(최소 6px)을 그립니다.
*/
export function RecentGoals({ runs }: { runs: WorkspaceRun[] }) {
  const recent = runs
    .filter(
      (run) =>
        (run.status === "completed" && run.predictions.length > 0) || run.status === "failed",
    )
    .slice(0, 4);
  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg leading-[26px] font-bold">최근 테스트별 목표 달성률</h2>
        <span className="rounded-md border border-gray-300 p-2 text-xs leading-none font-medium text-ink">
          예측
        </span>
      </header>
      {recent.length === 0 ? (
        <p className="text-sm text-subtle">아직 끝난 테스트가 없어요</p>
      ) : (
        <div className="flex flex-col">
          {recent.map((run) => {
            const [min, max] = run.predictions[0] ?? [0, 0];
            const order = run.title.split(/\s*·\s*/)[0];
            const result = run.status === "failed" ? "실패 · 결과 없음" : formatRate([min, max]);
            return (
              <Link
                key={run.id}
                /* 이름과 차수를 따로 그려(말줄임) 읽기 도구에는 한 문장으로 알려 줍니다 */
                aria-label={`${run.projectName} ${order} · ${formatDay(run.date)} · ${result}`}
                to={buildPath("report", { projectId: run.projectId, runId: run.id })}
                className="grid h-8 grid-cols-[minmax(0,1fr)_56px_142px] items-center gap-x-2 rounded px-1 hover:bg-gray-50"
              >
                {/* 프로젝트 이름만 말줄임하고 차수는 늘 보입니다 ("반찬로드 테… 4차") */}
                <span className="flex min-w-0 gap-1 text-caption text-gray-800">
                  <span className="truncate">{run.projectName}</span>
                  <span className="shrink-0">{order}</span>
                </span>
                <span className="text-xs text-muted">{formatDay(run.date)}</span>
                {run.status === "failed" ? (
                  <span className="flex items-center gap-1.5 text-caption text-subtle">
                    <Icon name="status-fail" className="size-3.5 text-danger" />
                    실패 · 결과 없음
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <span className="relative h-1.5 w-24 shrink-0 overflow-hidden rounded-[3px] bg-gray-200">
                      <span
                        className="absolute inset-y-0 rounded-[3px] bg-muted"
                        style={{
                          left: `min(${min}%, calc(100% - 6px))`,
                          width: `max(${max - min}%, 6px)`,
                        }}
                      />
                    </span>
                    <span className="w-10 text-right text-caption font-medium text-ink">
                      {formatRate([min, max])}
                    </span>
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
