import ChoiceChip from "@/components/ChoiceChip/ChoiceChip";
import Icon from "@/components/Icon/Icon";
import type { PersonaSession } from "@/types/persona.type";

import {
  busiestStage,
  countSessions,
  formatElapsed,
  sessionBadge,
  STAGE_LABELS,
  taskOptions,
} from "../utils/runView";

type RunProgressProps = {
  sessions: PersonaSession[];
  taskId: string;
  onTaskChange: (taskId: string) => void;
  elapsedMs: number | null;
};

/*
  Figma P09 `Section/Progress` — 과업 탭, 진행 n/N + 상태 요약 + 막대, 경과 시간·가장 많은 단계, 최근 끝난 세션.
  과업을 바꾸면 아래 진행·타일이 그 과업 기준으로 바뀝니다.
*/
export default function RunProgress({
  sessions,
  taskId,
  onTaskChange,
  elapsedMs,
}: RunProgressProps) {
  const tasks = taskOptions(sessions);
  const taskSessions = sessions.filter((session) => session.task_id === taskId);
  const counts = countSessions(taskSessions);
  const percent = counts.all > 0 ? (counts.finished / counts.all) * 100 : 0;
  const busiest = busiestStage(taskSessions);
  /* BE 에 세션 종료 시각이 없어 끝난 세션 중 마지막 3개를 보여줍니다 */
  const recentFinished = taskSessions
    .filter((session) => !["queued", "running"].includes(session.status))
    .slice(-3)
    .reverse();

  return (
    <section aria-label="진행" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-4">
        <div role="radiogroup" aria-label="과업" className="flex gap-2">
          {tasks.map((task) => (
            <ChoiceChip
              key={task.id}
              kind="radio"
              selected={task.id === taskId}
              onClick={() => onTaskChange(task.id)}
            >
              {task.name}
            </ChoiceChip>
          ))}
        </div>
        {tasks.length > 1 && (
          <p className="text-xs text-muted">
            과업을 바꾸면 아래 진행·타일이 그 과업 기준으로 바뀌어요
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <p className="flex items-baseline gap-3">
          <span className="text-caption text-subtle">진행</span>
          <span className="text-base font-bold text-ink">
            {counts.finished} / {counts.all}
          </span>
          <span className="text-caption text-subtle">
            완료 {counts.success} + 이탈 {counts.dropout} · 진행 중 {counts.running} · 대기{" "}
            {counts.queued} · 오류 {counts.error}
          </span>
        </p>
        <div
          role="progressbar"
          aria-label="진행률"
          aria-valuemin={0}
          aria-valuemax={Math.max(counts.all, 1)}
          aria-valuenow={counts.finished}
          aria-valuetext={`${counts.finished} / ${counts.all} 세션 끝남`}
          className="h-2 overflow-hidden rounded-full bg-line"
        >
          {/* 막대 길이는 진행 값이라 style 로 둡니다 */}
          <div className="h-full bg-ink" style={{ width: `${percent}%` }} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-6 text-sm font-bold text-ink">
        {elapsedMs != null && (
          <p className="flex items-center gap-2">
            <Icon name="status-wait" className="size-5" />
            경과 {formatElapsed(elapsedMs)}
          </p>
        )}
        {busiest && (
          <p className="flex items-center gap-2">
            <Icon name="play" className="size-5" />
            지금 가장 많은 단계: {STAGE_LABELS[busiest.stage]} · {busiest.count}세션
          </p>
        )}
      </div>

      {recentFinished.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-caption font-medium text-gray-800">최근 끝난 세션</p>
          <ul className="flex flex-wrap gap-6">
            {recentFinished.map((session) => {
              const badge = sessionBadge(session.status);
              return (
                <li key={session.id} className="flex items-center gap-1 text-caption font-bold">
                  <Icon
                    name={badge.icon}
                    className={
                      badge.tone === "danger" || badge.tone === "alert"
                        ? "size-5 text-danger"
                        : "size-5"
                    }
                  />
                  {session.name} · {badge.label}
                  {session.terminal_stage ? ` · ${STAGE_LABELS[session.terminal_stage]}` : ""}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
