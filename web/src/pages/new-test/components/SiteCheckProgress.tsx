import { useEffect, useId, useRef, useState } from "react";

import Icon from "@/components/Icon/Icon";

import type { DiscoverPhase } from "@/stores/useSiteCheckStore";
import type { DiscoveryProgressEvent } from "@/types/plan.type";

/* 이 시간이 지나면 "평소보다 오래 걸려요" 로 바꿉니다 (보통 1~2분) */
const SLOW_AFTER_SECONDS = 120;

const PHASE_TEXT: Record<DiscoverPhase, string> = {
  check: "사이트 주소에 접속하는 중이에요",
  /* Figma P02b 문구 */
  discover: "시작 화면의 메뉴와 기능을 읽는 중이에요",
  plan: "테스트 계획을 만드는 중이에요",
};

/* "0:42" */
const formatElapsed = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

/*
  P02b 사이트 확인 중 상태 띠 (Figma: 회색 띠 · 아이콘 + 13px 문구).
  탐색이 1~2분 걸려 멈춘 것처럼 보이지 않게
  - 회전하는 로딩 아이콘과 흐르는 진행 막대 (동작 줄이기 설정이면 멈춤)
  - 실제 단계(주소 확인 → 기능 탐색 → 계획 만들기) 문구
  - 지난 시간, 2분이 넘으면 오래 걸린다는 안내
  를 보여 줍니다. 단계가 바뀌면 화면 읽기 도구에도 알립니다(role=status).
  시간은 확인을 시작한 시각(startedAt)부터 셉니다. 다른 화면에 갔다 와도 이어서 셉니다.

  서버가 진행 사건(events)을 주면 마지막 사건 한 줄을 단계 문구 아래에 두고,
  "자세히 보기"로 전체 기록(서버가 남긴 최근 100줄)을 펼칩니다. 사건이 없으면(이전 BE) 띠만 그립니다.
  사건 문구는 화면 읽기 도구에 하나하나 읽히지 않게 합니다 (1초마다 바뀌어 단계 안내를 가립니다).
*/
export default function SiteCheckProgress({
  phase,
  startedAt,
  events = [],
}: {
  phase: DiscoverPhase | null;
  /* 확인을 시작한 시각. 다른 화면에 갔다 와도 처음부터 다시 세지 않게 받습니다 (없으면 그릴 때부터) */
  startedAt?: number | null;
  /* 기능 탐색 진행 사건 (오래된 것부터) */
  events?: DiscoveryProgressEvent[];
}) {
  const [from] = useState(() => startedAt ?? Date.now());
  const since = () => Math.max(0, Math.floor((Date.now() - from) / 1000));
  const [elapsed, setElapsed] = useState(since);
  const [open, setOpen] = useState(false);
  const listId = useId();
  const listRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const timer = window.setInterval(() => setElapsed(since()), 1000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 시작 시각은 그릴 때 한 번만 정합니다
  }, []);
  /* 펼쳐 둔 기록은 새 줄이 오면 맨 아래(최신)로 내립니다 */
  const latest = events.at(-1);
  useEffect(() => {
    const list = listRef.current;
    if (open && list) list.scrollTop = list.scrollHeight;
  }, [open, latest?.seq]);
  const slow = elapsed >= SLOW_AFTER_SECONDS;

  return (
    <div className="overflow-hidden rounded-lg bg-gray-50">
      <div className="flex items-start gap-2 p-3 text-caption">
        <Icon
          name="status-running"
          className="size-5 shrink-0 text-subtle motion-safe:animate-spin"
        />
        <div className="min-w-0 flex-1">
          <span role="status" className="block font-bold text-ink">
            {PHASE_TEXT[phase ?? "check"]}
            {/* 2분이 넘으면 읽기 도구에도 한 번 알립니다 (보이는 문구는 오른쪽에) */}
            {slow && <span className="sr-only"> · 평소보다 오래 걸려요</span>}
          </span>
          {latest && (
            <span className="mt-0.5 block truncate text-xs text-muted" title={latest.message}>
              {latest.message}
            </span>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <span className="text-xs text-muted tabular-nums">
            {formatElapsed(elapsed)} 지남 · {slow ? "평소보다 오래 걸려요" : "보통 1~2분 걸려요"}
          </span>
          {events.length > 0 && (
            <button
              type="button"
              aria-expanded={open}
              aria-controls={listId}
              onClick={() => setOpen((value) => !value)}
              className="flex items-center gap-0.5 rounded text-xs font-bold text-subtle hover:text-ink focus-visible:outline-2"
            >
              {open ? "접기" : "자세히 보기"}
              <Icon
                name="chevron-down"
                className={`size-3.5 transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
              />
            </button>
          )}
        </div>
      </div>
      {slow && (
        <p className="px-3 pb-3 pl-10 text-xs text-muted">
          메뉴가 많거나 사이트 응답이 느리면 더 걸릴 수 있어요. 이 화면을 그대로 두면 이어서
          진행돼요.
        </p>
      )}
      {open && events.length > 0 && (
        <ol
          id={listId}
          ref={listRef}
          aria-label="사이트 확인 기록"
          className="mx-3 mb-3 max-h-48 space-y-1 overflow-y-auto rounded-md bg-white p-2 text-xs"
        >
          {events.map((event) => (
            <li key={event.seq} className="flex gap-2">
              <span className="w-9 shrink-0 text-right text-muted tabular-nums">
                {event.t == null ? "" : formatElapsed(Math.floor(event.t))}
              </span>
              <span className="min-w-0 flex-1 break-words text-ink">
                {event.kind === "write_blocked" && (
                  <span className="mr-1 rounded bg-gray-100 px-1 font-bold text-subtle">차단</span>
                )}
                {event.message}
              </span>
            </li>
          ))}
        </ol>
      )}
      {/* 끝을 알 수 없는 작업이라 흐르는 막대로 진행 중임만 보여 줍니다 */}
      <div aria-hidden className="relative h-0.5 bg-gray-200">
        <span className="absolute inset-y-0 left-0 w-1/3 bg-subtle motion-safe:animate-[site-check-progress_1.6s_ease-in-out_infinite]" />
      </div>
    </div>
  );
}
