import { Link } from "react-router-dom";

import Icon from "@/components/Icon/Icon";
import type { PersonaSession } from "@/types/persona.type";
import { cn } from "@/utils/cn";

import {
  countSessions,
  filterSessions,
  FILTER_LABELS,
  formatElapsed,
  lastUtterance,
  MAX_STEPS,
  sessionBadge,
  sessionCode,
  type SessionFilter,
  sessionSegment,
  STAGE_LABELS,
} from "../utils/runView";

const FILTERS: SessionFilter[] = ["all", "running", "success", "dropout", "queued", "error"];

/*
  Figma P08~P10 `Card/SessionTiles` — 세션 타일 5열 (P 코드 · 세그먼트 · 상태).
  - 실행 중(P09)에만 상태 필터(SegmentedControl)를 둡니다.
  - 타일에 마우스를 올리거나 포커스하면 미리보기(P09b: 현재 단계·스텝·좌절 점수·발화)를 띄웁니다.
  - 타일을 누르면 세션 라이브(P11)로 갑니다.
*/
type SessionBoardProps = {
  sessions: PersonaSession[];
  /* 상태 필터를 보여줄지 (P09 실행 중) */
  filterable: boolean;
  /* 필터는 주소(?filter=)에 두어 세션 라이브에 갔다 와도 유지합니다 */
  filter: SessionFilter;
  onFilterChange: (filter: SessionFilter) => void;
  /* 세션 라이브 주소의 쿼리 (?session=… + 지금 과업·필터) */
  sessionSearch: (sessionId: string) => string;
};

export default function SessionBoard({
  sessions,
  filterable,
  filter,
  onFilterChange,
  sessionSearch,
}: SessionBoardProps) {
  const counts = countSessions(sessions);
  const visible = filterable ? filterSessions(sessions, filter) : sessions;

  return (
    <section aria-labelledby="session-board-title" className="flex flex-col gap-4">
      <h2 id="session-board-title" className="text-lg font-bold text-ink">
        세션 {counts.all}
      </h2>
      {filterable && (
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
      )}
      <p className="text-xs text-muted">타일을 누르면 세션 상세로 이동해요</p>

      {visible.length === 0 ? (
        <p className="rounded-xl bg-gray-50 p-6 text-sm text-muted">이 상태의 세션이 없어요</p>
      ) : (
        <ul aria-label="세션" className="grid grid-cols-3 gap-2 md:grid-cols-5">
          {visible.map((session) => (
            <SessionTile key={session.id} session={session} search={sessionSearch(session.id)} />
          ))}
        </ul>
      )}
    </section>
  );
}

function SessionTile({ session, search }: { session: PersonaSession; search: string }) {
  const badge = sessionBadge(session.status);
  const queued = session.status === "queued";
  const alert = badge.tone === "danger" || badge.tone === "alert";
  const code = sessionCode(session);
  const segment = sessionSegment(session);

  return (
    <li className="group relative">
      <Link
        to={{ search }}
        aria-label={`${code} · ${segment} · ${badge.label} — 세션 라이브 보기`}
        className="flex h-full flex-col gap-1 rounded-lg bg-gray-50 p-3 hover:bg-gray-100"
      >
        <span className={cn("text-caption font-bold", queued ? "text-muted" : "text-ink")}>
          {code}
        </span>
        <span className="text-xs text-subtle">{segment}</span>
        <span
          className={cn(
            "mt-2 flex items-center gap-1 text-xs",
            alert ? "font-bold text-danger" : queued ? "text-subtle" : "font-bold text-ink",
          )}
        >
          <Icon name={badge.icon} className="size-4" />
          {badge.label}
        </span>
      </Link>
      {!queued && <TilePreview session={session} />}
    </li>
  );
}

/* P09b 타일 미리보기 — 화면 읽기 도구에는 타일 이름과 세션 라이브가 같은 내용을 주므로 숨깁니다 */
function TilePreview({ session }: { session: PersonaSession }) {
  const last = session.trace.at(-1);
  const said = lastUtterance(session);
  const rows = [
    ["현재 단계", session.terminal_stage ? STAGE_LABELS[session.terminal_stage] : "시작 전"],
    [
      "스텝",
      `${session.steps} / ${MAX_STEPS}${session.elapsed_ms != null ? ` · ${formatElapsed(session.elapsed_ms)}` : ""}`,
    ],
    ["좌절 점수", last ? `${last.score} · 임계치 ${last.threshold}` : "—"],
  ];
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute top-full left-0 z-20 mt-2 hidden w-60 flex-col gap-3 rounded-xl bg-surface p-4 shadow-tooltip group-focus-within:flex group-hover:flex"
    >
      <p className="flex items-baseline gap-2">
        <span className="text-caption font-bold text-ink">{sessionCode(session)}</span>
        <span className="text-xs text-muted">{sessionSegment(session)}</span>
      </p>
      <dl className="flex flex-col gap-2 text-xs">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4">
            <dt className="text-subtle">{label}</dt>
            <dd className="font-bold text-ink">{value}</dd>
          </div>
        ))}
      </dl>
      {said && <p className="text-caption text-gray-800">“{said.text}”</p>}
      <p className="flex items-center gap-1 text-caption font-bold text-ink">
        라이브 보기
        <Icon name="chevron-right" className="size-4" />
      </p>
    </div>
  );
}
