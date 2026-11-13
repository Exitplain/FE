import { Link } from "react-router-dom";

import StatusBadge from "@/components/StatusBadge/StatusBadge";
import type { PersonaSession } from "@/types/persona.type";
import { cn } from "@/utils/cn";

import {
  countSessions,
  filterSessions,
  FILTER_LABELS,
  MAX_STEPS,
  sessionBadge,
  type SessionFilter,
  STAGE_LABELS,
} from "../utils/runView";

const FILTERS: SessionFilter[] = ["all", "running", "success", "dropout", "queued", "error"];

/*
  Figma P09 `Card/SessionTiles` — 상태 필터(SegmentedControl)와 세션 타일.
  타일을 누르면 세션 라이브(P11)로 갑니다. 타일에는 P09b 미리보기 내용(현재 단계·스텝)을 함께 적습니다.
*/
type SessionBoardProps = {
  sessions: PersonaSession[];
  /* 필터는 주소(?filter=)에 두어 세션 라이브에 갔다 와도 유지합니다 */
  filter: SessionFilter;
  onFilterChange: (filter: SessionFilter) => void;
  /* 세션 라이브 주소의 쿼리 (?session=… + 지금 과업·필터) */
  sessionSearch: (sessionId: string) => string;
};

export default function SessionBoard({
  sessions,
  filter,
  onFilterChange,
  sessionSearch,
}: SessionBoardProps) {
  const counts = countSessions(sessions);
  const visible = filterSessions(sessions, filter);

  return (
    <section aria-labelledby="session-board-title" className="flex flex-col gap-4">
      <h2 id="session-board-title" className="text-lg font-bold text-ink">
        세션 {counts.all}
      </h2>
      <div
        role="radiogroup"
        aria-label="세션 상태"
        className="flex w-fit flex-wrap gap-1 rounded-lg bg-line p-1"
      >
        {FILTERS.map((key) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={filter === key}
            onClick={() => onFilterChange(key)}
            className={cn(
              "min-h-10 rounded-md px-4 text-caption",
              filter === key ? "bg-surface font-bold text-ink" : "text-subtle hover:text-ink",
            )}
          >
            {FILTER_LABELS[key]} {counts[key]}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted">타일을 누르면 세션 라이브로 이동해요</p>

      {visible.length === 0 ? (
        <p className="rounded-xl bg-gray-50 p-6 text-sm text-muted">이 상태의 세션이 없어요</p>
      ) : (
        <ul aria-label="세션" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {visible.map((session) => {
            const badge = sessionBadge(session.status);
            return (
              <li key={session.id}>
                <Link
                  to={{ search: sessionSearch(session.id) }}
                  aria-label={`${session.name} · ${session.task_name} · ${badge.label} — 세션 라이브 보기`}
                  className="flex h-full flex-col gap-3 rounded-xl bg-gray-50 p-4 hover:bg-gray-100"
                >
                  <span className="flex flex-col gap-1">
                    <span className="text-sm font-bold text-ink">{session.name}</span>
                    <span className="text-xs text-subtle">{session.task_name}</span>
                  </span>
                  <StatusBadge {...badge} className="w-fit px-0 py-0" />
                  <span className="text-xs text-muted">
                    {session.terminal_stage ? STAGE_LABELS[session.terminal_stage] : "시작 전"} ·
                    스텝 {session.steps} / {MAX_STEPS}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
