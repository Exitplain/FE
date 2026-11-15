import Icon from "@/components/Icon/Icon";
import type { IconName } from "@/components/Icon/iconNames";
import { cn } from "@/utils/cn";

import { HYPOTHESES, REPRODUCE_SEGMENTS, type ReproduceStatus } from "../data/analyticsMock";

/* R09 원인 재현 설정 — 차이 구간, 시작 지점, 재현할 세그먼트 */
export function ReproduceSetup({
  stage,
  gapText,
  selected,
  onToggle,
}: {
  stage: string;
  gapText: string;
  selected: string[];
  onToggle: (segmentId: string) => void;
}) {
  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="gap-title" className="flex flex-col gap-3">
        <h2 id="gap-title" className="text-lg font-bold text-ink">
          차이 구간
        </h2>
        <p className="flex items-center gap-2 rounded-lg bg-gray-50 p-3 text-caption font-bold text-ink">
          <Icon name="status-error" className="size-5 text-danger" />
          {gapText}
        </p>
        <p className="text-caption text-subtle">실측은 위치를, 재현은 원인 가설을 보여줘요</p>
      </section>

      <div className="grid grid-cols-1 gap-12 md:grid-cols-2">
        <section aria-labelledby="start-title" className="flex flex-col gap-3 p-4">
          <h2 id="start-title" className="font-bold text-ink">
            시작 지점
          </h2>
          <dl className="flex flex-col text-caption">
            {[
              ["시작 단계", `3. 상세 (${stage} 직전)`],
              ["패널", "3차와 동일 · 20명"],
              ["반복", "시드 3회"],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex justify-between gap-4 border-b border-line py-3 last:border-b-0"
              >
                <dt className="text-subtle">{label}</dt>
                <dd className="font-bold text-ink">{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <fieldset className="flex flex-col gap-3 p-4">
          <legend className="font-bold text-ink">세그먼트</legend>
          <p className="text-xs text-subtle">실측에서 이탈이 많았던 세그먼트만 골라도 돼요</p>
          {REPRODUCE_SEGMENTS.map((segment) => (
            <label
              key={segment.id}
              className="flex min-h-10 items-center gap-3 text-caption text-ink"
            >
              <input
                type="checkbox"
                checked={selected.includes(segment.id)}
                onChange={() => onToggle(segment.id)}
                className="size-5 accent-ink"
              />
              {segment.name} · {segment.count}명
            </label>
          ))}
        </fieldset>
      </div>
    </div>
  );
}

const TILE_STATUS: Record<ReproduceStatus, { icon: IconName; label: string }> = {
  queued: { icon: "circle", label: "대기" },
  running: { icon: "play", label: "진행 중" },
  success: { icon: "check", label: "완료" },
  dropout: { icon: "status-exit", label: "이탈" },
};

/* R10 원인 재현 중 — 진행 막대와 세션 타일 20개 */
export type ReproduceSession = { code: string; segment: string; status: ReproduceStatus };

export function ReproduceRunning({ sessions }: { sessions: ReproduceSession[] }) {
  const statuses = sessions.map((session) => session.status);
  const count = (status: ReproduceStatus) => statuses.filter((item) => item === status).length;
  const finished = count("success") + count("dropout");

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-2">
        <p className="flex items-baseline gap-3">
          <span className="text-caption text-subtle">진행</span>
          <span className="text-base font-bold text-ink">
            {finished} / {statuses.length}
          </span>
          <span className="text-caption text-subtle">
            완료 {count("success")} + 이탈 {count("dropout")} · 진행 중 {count("running")} · 대기{" "}
            {count("queued")}
          </span>
        </p>
        <div
          role="progressbar"
          aria-label="재현 진행률"
          aria-valuemin={0}
          aria-valuemax={statuses.length}
          aria-valuenow={finished}
          className="h-2 overflow-hidden rounded-full bg-line"
        >
          <div
            className="h-full bg-ink"
            style={{ width: `${(finished / statuses.length) * 100}%` }}
          />
        </div>
      </div>

      <section aria-labelledby="reproduce-sessions-title" className="flex flex-col gap-4">
        <h2 id="reproduce-sessions-title" className="text-lg font-bold text-ink">
          세션 {statuses.length}
        </h2>
        <ul aria-label="재현 세션" className="grid grid-cols-3 gap-2 md:grid-cols-5">
          {sessions.map(({ code, segment, status }) => {
            const tile = TILE_STATUS[status];
            return (
              <li
                key={code}
                aria-label={`${code} · ${segment} · ${tile.label}`}
                className="flex flex-col gap-1 rounded-lg bg-gray-50 p-3"
              >
                <span
                  className={cn(
                    "text-caption font-bold",
                    status === "queued" ? "text-muted" : "text-ink",
                  )}
                >
                  {code}
                </span>
                <span className="text-xs text-subtle">{segment}</span>
                <span
                  className={cn(
                    "mt-2 flex items-center gap-1 text-xs",
                    status === "dropout"
                      ? "font-bold text-danger"
                      : status === "queued"
                        ? "text-subtle"
                        : "font-bold text-ink",
                  )}
                >
                  <Icon name={tile.icon} className="size-4" />
                  {tile.label}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

/* R11 원인 재현 결과 — 원인 가설과 근거 발화 (가설이라 재테스트로 확인해야 합니다) */
export function ReproduceResult() {
  return (
    <div className="flex flex-col gap-10">
      <p className="flex items-center gap-2 rounded-lg bg-gray-50 p-3 text-caption font-bold text-ink">
        <Icon name="search" className="size-5" />
        실측은 위치를, 재현은 원인 가설을 보여줘요. 아래는 가설이에요
      </p>
      <section aria-labelledby="hypothesis-title" className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h2 id="hypothesis-title" className="text-lg font-bold text-ink">
            원인 가설
          </h2>
          <span className="text-xs text-muted">재현 세션 기준 · 범위</span>
        </div>
        <ol className="flex flex-col">
          {HYPOTHESES.map((item) => (
            <li key={item.rank} className="flex gap-4 border-b border-line py-4 last:border-b-0">
              <span className="w-4 font-bold text-ink">{item.rank}</span>
              <div className="flex flex-1 flex-col gap-3">
                <p className="flex items-baseline gap-3">
                  <span className="font-bold text-ink">{item.title}</span>
                  <span className="text-xs text-subtle">{item.range}</span>
                </p>
                <p className="-mt-2 text-caption text-gray-800">{item.summary}</p>
                <ul className="flex flex-col gap-1 rounded-lg bg-gray-50 p-3 text-caption text-gray-800">
                  {item.quotes.map((quote) => (
                    <li key={quote.code}>
                      “{quote.text}” · {quote.code}
                    </li>
                  ))}
                </ul>
                {/* 임시: 재현 세션 상세는 API 연동 후 열립니다 */}
                <p className="flex gap-6">
                  {item.quotes.map((quote) => (
                    <button
                      key={quote.code}
                      type="button"
                      disabled
                      title="재현 세션 상세는 API 연동 후 열려요"
                      className="flex items-center gap-1 text-caption font-bold text-ink disabled:cursor-not-allowed"
                    >
                      세션 {quote.code} 보기
                      <Icon name="chevron-right" className="size-4" />
                    </button>
                  ))}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
