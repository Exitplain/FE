import { apiAssetUrl } from "@/apis/run.api";
import type { ReportCounts, ReportScreensTask, ReportTaskV1 } from "@/types/report.type";
import { cn } from "@/utils/cn";

import {
  formatMinMax,
  formatSeconds,
  percentRange,
  sortTasksByDropout,
  toPercent,
  worstDropV1,
} from "../utils/reportData";

/*
  P12 리포트 · 과업 "전체" (시안 C 과업 카드)
  - 과업마다 카드 한 장: 목표 달성률(시드별 범위)·최대 이탈 구간·중앙 소요 시간·가장 큰 문제 화면
  - 퍼널·히트맵·화면 둘러보기는 과업마다 단계가 달라 합치지 않습니다. 카드를 누르면 그 과업 리포트로 갑니다.
  - 문제 화면은 화면 둘러보기 응답이 있을 때만 보여 줍니다 (캡처가 없는 예전·샘플 리포트는 숨김)
*/
export default function TaskOverview({
  tasks,
  summary,
  screenTasks,
  onOpen,
}: {
  tasks: ReportTaskV1[];
  summary: ReportCounts;
  /* GET /api/v1/reports/{id}/screens 의 tasks. 아직 없거나 쓸 수 없으면 undefined */
  screenTasks: ReportScreensTask[] | undefined;
  onOpen: (taskId: string) => void;
}) {
  const withDropout = tasks.filter((task) => task.dropout > 0).length;
  const overall = toPercent(summary.achievement_rate);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl bg-gray-50 px-5 py-4 text-sm text-subtle">
        <p className="text-ink">
          <b>{tasks.length}개</b> 과업 중{" "}
          {withDropout > 0 ? (
            <>
              <b className="text-danger">{withDropout}개</b>에서 이탈이 있었어요
            </>
          ) : (
            "이탈이 없었어요"
          )}
        </p>
        <p>
          전체 달성률 <b className="text-ink">{overall == null ? "—" : `${overall}%`}</b>
        </p>
        <p>
          기록 세션{" "}
          <b className="text-ink">
            {summary.recorded_sessions}/{summary.expected_sessions}
          </b>
        </p>
        <p className="ml-auto text-xs text-muted">이탈 많은 순으로 정렬</p>
      </div>

      <ul aria-label="과업별 결과" className="grid grid-cols-3 gap-4">
        {sortTasksByDropout(tasks).map((task) => (
          <li key={task.task_id}>
            <TaskCard
              task={task}
              screenTask={screenTasks?.find((item) => item.task_id === task.task_id)}
              showProblem={screenTasks !== undefined}
              onOpen={() => onOpen(task.task_id)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function TaskCard({
  task,
  screenTask,
  showProblem,
  onOpen,
}: {
  task: ReportTaskV1;
  screenTask: ReportScreensTask | undefined;
  showProblem: boolean;
  onOpen: () => void;
}) {
  const hasDropout = task.dropout > 0;
  const drop = worstDropV1(task);
  const rate =
    task.valid_sessions > 0
      ? formatMinMax(percentRange(task.seed_ranges.achievement_rate), "%")
      : "—";
  const bar = toPercent(task.achievement_rate) ?? 0;
  const problem = screenTask?.problems[0];
  const shot = apiAssetUrl(problem?.screenshot_url ?? null);

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${task.name} 리포트 보기`}
      className={cn(
        "flex h-full w-full flex-col gap-3.5 rounded-xl border bg-white p-5 text-left hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-ink",
        hasDropout ? "border-danger" : "border-line",
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="text-base font-bold text-ink">{task.name}</span>
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-0.5 text-xs",
            hasDropout ? "bg-red-50 font-bold text-danger" : "bg-gray-100 font-medium text-subtle",
          )}
        >
          {hasDropout ? `이탈 ${task.dropout}` : "이탈 없음"}
        </span>
      </span>

      <span className="flex items-baseline gap-2">
        <span className="text-display font-bold text-ink">{rate}</span>
        <span className="text-caption text-subtle">목표 달성</span>
      </span>
      <span className="h-2 overflow-hidden rounded-full bg-gray-100" aria-hidden>
        <span
          className={cn("block h-full rounded-full", hasDropout ? "bg-danger" : "bg-ink")}
          style={{ width: `${bar}%` }}
        />
      </span>

      <span className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-caption">
        <span className="text-subtle">최대 이탈</span>
        <span className={drop ? "font-medium text-danger" : "text-ink"}>
          {drop ? drop.label : "없음"}
        </span>
        <span className="text-subtle">중앙 시간</span>
        <span className="text-ink">{formatSeconds(task.kpis.median_duration_seconds)}</span>
      </span>

      {showProblem && (
        <span className="flex items-center gap-3 border-t border-line pt-3">
          {problem ? (
            <>
              {shot ? (
                <img
                  src={shot}
                  alt=""
                  loading="lazy"
                  className="h-18 w-14 shrink-0 rounded-md border border-line bg-gray-50 object-contain"
                />
              ) : (
                <span
                  aria-hidden
                  className="h-18 w-14 shrink-0 rounded-md border border-line bg-gray-50"
                />
              )}
              <span className="flex min-w-0 flex-col gap-1">
                <span className="truncate text-caption font-bold text-ink">{problem.name}</span>
                {problem.top[0] && (
                  <span className="text-xs text-danger">
                    {problem.top[0].name} · {problem.top[0].sessions}세션
                  </span>
                )}
              </span>
            </>
          ) : (
            <span className="text-xs text-subtle">마찰이 감지된 화면이 없어요</span>
          )}
        </span>
      )}

      <span className="mt-auto text-caption font-medium text-ink">리포트 보기 ›</span>
    </button>
  );
}
