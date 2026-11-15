import type { ReactNode } from "react";

import ChoiceChip from "@/components/ChoiceChip/ChoiceChip";
import Icon from "@/components/Icon/Icon";
import type { PersonaSession } from "@/types/persona.type";
import { cn } from "@/utils/cn";

import {
  busiestStage,
  countSessions,
  formatClock,
  formatElapsed,
  lastUtterance,
  type RunPhase,
  sessionBadge,
  sessionCode,
  STAGE_LABELS,
  taskOptions,
} from "../utils/runView";

type RunProgressProps = {
  phase: RunPhase;
  sessions: PersonaSession[];
  taskId: string;
  onTaskChange: (taskId: string) => void;
  elapsedMs: number | null;
  /* 준비(P08)·분석(P10) 단계에서 경과 오른쪽에 붙는 "다음: …" 안내 */
  nextHint?: string;
  /* 준비·분석 단계 체크리스트 (경과 줄 아래) */
  checklist?: ReactNode;
};

/*
  Figma P08~P10 `Section/Progress` — 과업 탭, 진행 n/N + 상태 요약 + 막대.
  - 실행 중(P09): 최근 끝난 세션 · 경과 · 지금 가장 많은 단계 · 끝난 세션 3개
  - 준비(P08)·분석(P10): 경과 · 다음 안내 · 단계 체크리스트
  과업을 바꾸면 아래 진행·타일·발화가 그 과업 기준으로 바뀝니다.
*/
export default function RunProgress({
  phase,
  sessions,
  taskId,
  onTaskChange,
  elapsedMs,
  nextHint,
  checklist,
}: RunProgressProps) {
  const tasks = taskOptions(sessions);
  const taskSessions = sessions.filter((session) => session.task_id === taskId);
  const counts = countSessions(taskSessions);
  const percent = counts.all > 0 ? (counts.finished / counts.all) * 100 : 0;
  const busiest = busiestStage(taskSessions);
  /* 끝난 세션을 마지막 발화 시각 순으로 (시각이 없으면 목록 순서) */
  const recentFinished = taskSessions
    .filter((session) => !["queued", "running"].includes(session.status))
    .map((session, index) => ({ session, at: lastUtterance(session)?.at ?? "", index }))
    .sort((a, b) => b.at.localeCompare(a.at) || b.index - a.index)
    .slice(0, 3)
    .map(({ session }) => session);

  /* Figma: 준비 중에는 "완료 0 + 이탈 0" 만, 그 밖에는 0 이 아닌 상태를 덧붙입니다 */
  const summary = [`완료 ${counts.success} + 이탈 ${counts.dropout}`];
  if (counts.running > 0) summary.push(`진행 중 ${counts.running}`);
  if (counts.queued > 0 && phase !== "preparing") summary.push(`대기 ${counts.queued}`);
  if (counts.error > 0) summary.push(`오류 ${counts.error}`);

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
            과업을 바꾸면 아래 진행·타일·발화가 그 과업 기준으로 바뀌어요
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <p className="flex items-baseline gap-3">
          <span className="text-caption text-subtle">진행</span>
          <span className="text-base font-bold text-ink">
            {counts.finished} / {counts.all}
          </span>
          <span className="text-caption text-subtle">{summary.join(" · ")}</span>
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

      {phase === "running" ? (
        <>
          {recentFinished.length > 0 && (
            <p className="text-caption font-medium text-gray-800">최근 끝난 세션</p>
          )}
          <div className="flex flex-wrap items-center gap-6 pt-4 text-sm font-bold text-ink">
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
            <ul aria-label="최근 끝난 세션" className="flex flex-wrap gap-6">
              {recentFinished.map((session) => {
                const badge = sessionBadge(session.status);
                const alert = badge.tone === "danger" || badge.tone === "alert";
                return (
                  <li key={session.id} className="flex items-center gap-1 text-caption font-bold">
                    <Icon name={badge.icon} className={cn("size-5", alert && "text-danger")} />
                    {sessionCode(session)} · {badge.label}
                    {session.status === "simulated_dropout" && session.terminal_stage
                      ? ` · ${STAGE_LABELS[session.terminal_stage]}`
                      : ""}
                    <span className="ml-1 text-xs font-normal text-muted">
                      {formatClock(lastUtterance(session)?.at)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      ) : (
        <>
          <div className="flex items-center justify-between gap-4">
            {elapsedMs != null && (
              <p className="text-caption font-bold text-ink">경과 {formatElapsed(elapsedMs)}</p>
            )}
            {nextHint && <p className="ml-auto text-xs text-muted">{nextHint}</p>}
          </div>
          {checklist}
        </>
      )}
    </section>
  );
}
