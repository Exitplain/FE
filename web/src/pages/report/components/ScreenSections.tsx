import { apiAssetUrl } from "@/apis/run.api";
import Icon from "@/components/Icon/Icon";
import type { ReportScreensTask, ScreenFriction } from "@/types/report.type";
import { cn } from "@/utils/cn";

/*
  P12 리포트 · 화면 둘러보기 (Figma 시안 "리포트 · 화면 둘러보기")
  - 에이전트가 실제로 거쳐 간 화면 캡처를 순서대로 넘겨 보고, 화면마다 도달·이탈과 감지된 마찰을 보여 줍니다.
  - 마찰은 목표에 도달한 세션이 겪은 것도 셉니다 (BE reports/screens.py). 모두 가상 페르소나의 모의 결과입니다.
*/

function Shot({ url, alt, className }: { url: string | null; alt: string; className?: string }) {
  const src = apiAssetUrl(url);
  return src ? (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={cn(
        "w-full rounded-lg border border-gray-200 bg-gray-50 object-contain",
        className,
      )}
    />
  ) : (
    <div
      role="img"
      aria-label={`${alt} 없음`}
      className={cn(
        "flex w-full items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-xs text-muted",
        className,
      )}
    >
      캡처 없음
    </div>
  );
}

function FrictionChip({ friction }: { friction: ScreenFriction }) {
  return (
    <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-danger">
      {friction.name} · {friction.sessions}세션
    </span>
  );
}

export function ScreenWalkthrough({
  task,
  selected,
  onSelect,
}: {
  task: ReportScreensTask;
  selected: number;
  onSelect: (index: number) => void;
}) {
  const screens = task.screens;
  if (screens.length === 0) {
    return <p className="text-sm text-subtle">이 과업은 둘러볼 화면 기록이 없어요.</p>;
  }
  const index = Math.min(selected, screens.length - 1);
  const screen = screens[index];
  const go = (next: number) => onSelect((next + screens.length) % screens.length);

  return (
    <div
      className="flex flex-col gap-4"
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") go(index - 1);
        if (event.key === "ArrowRight") go(index + 1);
      }}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_320px] items-start gap-5">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-ink px-2.5 py-0.5 text-xs font-bold text-white tabular-nums">
              {index + 1} / {screens.length}
            </span>
            <span className="text-sm font-bold text-ink">{screen.name}</span>
            <span className="text-xs text-muted">{screen.screen_id}</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="이전 화면"
              onClick={() => go(index - 1)}
              className="flex size-9 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-lg font-bold text-ink hover:bg-gray-50"
            >
              ‹
            </button>
            <Shot
              url={screen.screenshot_url}
              alt={`${screen.name} 화면 캡처`}
              className="max-h-[480px]"
            />
            <button
              type="button"
              aria-label="다음 화면"
              onClick={() => go(index + 1)}
              className="flex size-9 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-lg font-bold text-ink hover:bg-gray-50"
            >
              ›
            </button>
          </div>
        </div>
        <div
          aria-live="polite"
          className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5"
        >
          <h3 className="text-base font-bold text-ink">{screen.name}</h3>
          <p
            className={cn(
              "text-caption font-medium",
              screen.dropouts_here > 0 ? "text-danger" : "text-subtle",
            )}
          >
            도달 {screen.reached}세션 · 여기서 이탈 {screen.dropouts_here}세션
          </p>
          <h4 className="text-caption font-bold text-ink">감지된 마찰</h4>
          {screen.frictions.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {screen.frictions.map((friction) => (
                <li key={friction.category} className="flex flex-col gap-1">
                  <FrictionChip friction={friction} />
                  {friction.detail && (
                    <span className="text-xs text-subtle">{friction.detail}</span>
                  )}
                  {friction.dropouts > 0 && (
                    <span className="text-xs text-muted">
                      이 원인으로 이탈 {friction.dropouts}세션
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-caption text-subtle">이 화면에서 감지된 마찰이 없어요</p>
          )}
        </div>
      </div>

      <ol aria-label="화면 순서" className="flex items-start gap-2 overflow-x-auto pb-1">
        {screens.map((item, i) => (
          <li key={item.screen_id} className="flex items-start gap-2">
            {i > 0 && (
              <span aria-hidden className="mt-12 text-muted">
                →
              </span>
            )}
            <button
              type="button"
              aria-pressed={i === index}
              aria-label={`${item.name} 화면 보기`}
              onClick={() => onSelect(i)}
              className="flex w-44 flex-col gap-1.5 text-left"
            >
              <Shot
                url={item.screenshot_url}
                alt={`${item.name} 썸네일`}
                className={cn("h-40", i === index && "outline-3 outline-ink")}
              />
              <span className="flex items-center gap-1.5">
                <span
                  className={cn("text-caption text-ink", i === index ? "font-bold" : "font-medium")}
                >
                  {item.name}
                </span>
                {item.frictions.length > 0 && (
                  <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-danger">
                    문제 {item.frictions.length}
                  </span>
                )}
              </span>
              <span className="text-xs text-muted">
                도달 {item.reached}
                {item.dropouts_here > 0 ? ` · 이탈 ${item.dropouts_here}` : ""}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function ProblemScreens({
  task,
  onOpen,
}: {
  task: ReportScreensTask;
  onOpen: (screenId: string) => void;
}) {
  if (task.problems.length === 0) {
    return (
      <p className="flex items-center gap-2 text-sm text-subtle">
        <Icon name="check" className="size-4" />
        마찰이 감지된 화면이 없어요
      </p>
    );
  }
  return (
    <ul className="grid grid-cols-3 gap-4">
      {task.problems.map((problem) => (
        <li key={problem.screen_id}>
          <button
            type="button"
            onClick={() => onOpen(problem.screen_id)}
            className="flex w-full flex-col gap-2.5 rounded-xl border border-gray-200 bg-white p-4 text-left hover:border-gray-300"
          >
            <Shot url={problem.screenshot_url} alt={`${problem.name} 화면 캡처`} className="h-40" />
            <span className="flex items-baseline gap-1.5">
              <span className="text-sm font-bold text-ink">{problem.name}</span>
              <span className="text-xs text-muted">{problem.screen_id}</span>
            </span>
            {problem.top[0] && (
              <span className="flex flex-wrap items-center gap-1.5">
                <FrictionChip friction={problem.top[0]} />
                {problem.dropouts_here > 0 && (
                  <span className="text-xs font-medium text-danger">
                    이탈 {problem.dropouts_here}
                  </span>
                )}
              </span>
            )}
            {problem.top[0]?.detail && (
              <span className="text-caption text-subtle">{problem.top[0].detail}</span>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}

export function FrictionCauses({
  task,
  onOpen,
}: {
  task: ReportScreensTask;
  onOpen: (screenId: string) => void;
}) {
  if (task.causes.length === 0) {
    return <p className="text-sm text-subtle">감지된 마찰이 없어요.</p>;
  }
  const max = Math.max(task.valid_sessions, ...task.causes.map((c) => c.sessions), 1);
  return (
    <ul aria-label="감지된 마찰 분포" className="flex flex-col gap-3">
      {task.causes.map((cause) => {
        const where = cause.screens[0];
        return (
          <li
            key={cause.category}
            className="grid grid-cols-[88px_minmax(0,1fr)_96px_auto] items-center gap-3"
          >
            <span className="text-caption font-medium text-ink">{cause.name}</span>
            <span className="h-3 overflow-hidden rounded-full bg-gray-100" aria-hidden>
              <span
                className="block h-full rounded-full bg-danger"
                style={{ width: `${Math.round((cause.sessions / max) * 100)}%` }}
              />
            </span>
            <span className="text-caption text-ink tabular-nums">
              <b>{cause.sessions}세션</b>
              {cause.dropouts > 0 && (
                <span className="text-xs text-muted"> · 이탈 {cause.dropouts}</span>
              )}
            </span>
            {where ? (
              <button
                type="button"
                onClick={() => onOpen(where.screen_id)}
                aria-label={`${cause.name}: ${where.name} 화면 보기`}
                className="flex items-center gap-2 text-xs text-muted hover:text-ink"
              >
                <Shot
                  url={where.screenshot_url}
                  alt={`${where.name} 썸네일`}
                  className="h-10 w-16"
                />
                {where.name} ›
              </button>
            ) : (
              <span />
            )}
          </li>
        );
      })}
    </ul>
  );
}
