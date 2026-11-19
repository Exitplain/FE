import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Link } from "react-router-dom";

import { queryKeys } from "@/apis/queryKeys";
import { apiAssetUrl, getRunSessions } from "@/apis/run.api";
import Icon from "@/components/Icon/Icon";
import type { IconName } from "@/components/Icon/iconNames";
import { POLLING_INTERVAL_MS } from "@/constants/polling";
import { buildPath } from "@/constants/routes";
import { useReportScreens, useRunDetail, useRunReport } from "@/pages/report/hooks/useRunReport";
import type { MeasurementFunnel } from "@/types/measurement.type";
import type { ScreenFriction } from "@/types/report.type";
import { ACTIVE_RUN_STATUSES, type RunSessionStatus } from "@/types/run.type";
import { cn } from "@/utils/cn";

type Segment = NonNullable<MeasurementFunnel["report"]>["segments"][number];

/* R09 원인 재현 설정 — 차이 구간과 재현할 세그먼트. 그 과업만, 고른 세그먼트만 시드 1회 실제로 돌립니다 */
export function ReproduceSetup({
  gapText,
  taskName,
  baseLabel,
  segments,
  selected,
  onToggle,
  blocked,
}: {
  gapText: string;
  taskName: string;
  baseLabel: string;
  segments: Segment[];
  selected: string[];
  onToggle: (segmentId: string) => void;
  /* 재현할 수 없는 이유 (비교한 리포트에 실행이 없는 경우 등) */
  blocked: string | null;
}) {
  const people = segments
    .filter((segment) => selected.includes(segment.id))
    .reduce((sum, segment) => sum + segment.count, 0);
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
        <p className="text-caption text-subtle">
          실제 고객 데이터는 위치를, 재현은 원인 가설을 보여줘요
        </p>
        {blocked && (
          <p role="alert" className="text-caption font-bold text-danger">
            {blocked}
          </p>
        )}
      </section>

      <div className="grid grid-cols-1 gap-12 md:grid-cols-2">
        <section aria-labelledby="start-title" className="flex flex-col gap-3 p-4">
          <h2 id="start-title" className="font-bold text-ink">
            재현 범위
          </h2>
          <dl className="flex flex-col text-caption">
            {[
              ["과업", `${taskName} (처음부터)`],
              ["기준 사전 테스트", baseLabel],
              ["패널", `고른 세그먼트 · ${people}명`],
              ["반복", "반복 1회"],
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
          <p className="text-xs text-subtle">
            실제 고객 데이터에서 이탈이 많았던 세그먼트만 골라도 돼요
          </p>
          {segments.map((segment) => (
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

type TileStatus = "queued" | "running" | "success" | "dropout" | "failed";

const TILE_STATUS: Record<TileStatus, { icon: IconName; label: string }> = {
  queued: { icon: "circle", label: "대기" },
  running: { icon: "play", label: "진행 중" },
  success: { icon: "check", label: "완료" },
  dropout: { icon: "status-exit", label: "이탈" },
  failed: { icon: "status-error", label: "실패" },
};

function tileOf(status: RunSessionStatus): TileStatus {
  if (status === "running") return "running";
  if (status === "success") return "success";
  if (status === "simulated_dropout") return "dropout";
  return "failed";
}

/* R10 원인 재현 중 — 실제 실행 진행과 세션 타일. 실행이 끝나면 onDone 으로 결과(R11)로 넘어갑니다 */
export function ReproduceRunning({ runId, onDone }: { runId: string; onDone: () => void }) {
  const run = useRunDetail(runId);
  const active = !run.data || ACTIVE_RUN_STATUSES.includes(run.data.status);
  const sessions = useQuery({
    queryKey: queryKeys.runs.sessions(runId),
    queryFn: () => getRunSessions(runId, { limit: 200 }),
    refetchInterval: active ? POLLING_INTERVAL_MS : false,
  });
  const finishedRun = run.data && !active;
  useEffect(() => {
    if (finishedRun) onDone();
  }, [finishedRun, onDone]);

  if (run.isError) {
    return (
      <p role="alert" className="rounded-xl bg-gray-50 p-6 text-sm text-subtle">
        {run.error.message}
      </p>
    );
  }
  const expected = run.data?.progress.expected_sessions ?? 0;
  const tiles = (sessions.data?.items ?? []).map((session) => ({
    code: session.persona.code,
    segment: session.persona.segment_name,
    status: tileOf(session.status),
  }));
  const count = (status: TileStatus) => tiles.filter((tile) => tile.status === status).length;
  const finished = count("success") + count("dropout") + count("failed");
  const waiting = Math.max(0, expected - tiles.length);

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-2">
        <p className="flex items-baseline gap-3">
          <span className="text-caption text-subtle">진행</span>
          <span className="text-base font-bold text-ink">
            {finished} / {expected || "…"}
          </span>
          <span className="text-caption text-subtle">
            완료 {count("success")} + 이탈 {count("dropout")} · 진행 중 {count("running")} · 대기{" "}
            {waiting}
          </span>
        </p>
        <div
          role="progressbar"
          aria-label="재현 진행률"
          aria-valuemin={0}
          aria-valuemax={expected}
          aria-valuenow={finished}
          className="h-2 overflow-hidden rounded-full bg-line"
        >
          <div
            className="h-full bg-ink"
            style={{ width: `${expected ? (finished / expected) * 100 : 0}%` }}
          />
        </div>
      </div>

      <section aria-labelledby="reproduce-sessions-title" className="flex flex-col gap-4">
        <h2 id="reproduce-sessions-title" className="text-lg font-bold text-ink">
          방문 {expected || tiles.length}
        </h2>
        <ul aria-label="재현 방문" className="grid grid-cols-3 gap-2 md:grid-cols-5">
          {tiles.map(({ code, segment, status }) => {
            const tile = TILE_STATUS[status];
            return (
              <li
                key={code}
                aria-label={`${code} · ${segment} · ${tile.label}`}
                className="flex flex-col gap-1 rounded-lg bg-gray-50 p-3"
              >
                <span className="text-caption font-bold text-ink">{code}</span>
                <span className="text-xs text-subtle">{segment}</span>
                <span
                  className={cn(
                    "mt-2 flex items-center gap-1 text-xs font-bold",
                    status === "dropout" || status === "failed" ? "text-danger" : "text-ink",
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

/*
  R11 원인 재현 결과 — 재현 실행 리포트에서 차이 구간 화면에 감지된 마찰을 원인 가설로 보여줍니다.
  모두 가상 페르소나의 모의 결과라 가설이고, 재테스트·실측으로 확인해야 합니다.
*/
export function ReproduceResult({
  projectId,
  runId,
  taskId,
  stageId,
  stageName,
}: {
  projectId: string;
  runId: string;
  taskId: string;
  stageId: string;
  stageName: string;
}) {
  const report = useRunReport(runId);
  const screens = useReportScreens(report.data?.report_id);
  const task = screens.data?.tasks.find((item) => item.task_id === taskId);
  const screen = task?.screens.find((item) => item.screen_id === stageId);
  /* 차이 구간 화면에서 감지된 마찰. 그 화면에 아무도 닿지 않았거나 마찰이 없으면 과업 전체 원인을 씁니다 */
  const hypotheses: (ScreenFriction & { where?: string })[] =
    screen && screen.frictions.length > 0
      ? [...screen.frictions].sort((a, b) => b.sessions - a.sessions)
      : (task?.causes ?? []).map((cause) => ({
          category: cause.category,
          name: cause.name,
          sessions: cause.sessions,
          dropouts: cause.dropouts,
          detail: "",
          screenshot_url: cause.screens[0]?.screenshot_url ?? null,
          where: cause.screens[0]?.name,
        }));
  const reportLink = buildPath("report", { projectId, runId });

  if (report.isError || screens.isError) {
    return (
      <p role="alert" className="rounded-xl bg-gray-50 p-6 text-sm text-subtle">
        {(report.error ?? screens.error)?.message}
      </p>
    );
  }
  if (!task) {
    return <p className="text-sm text-subtle">재현 결과를 불러오는 중이에요…</p>;
  }

  return (
    <div className="flex flex-col gap-10">
      <p className="flex items-center gap-2 rounded-lg bg-gray-50 p-3 text-caption font-bold text-ink">
        <Icon name="search" className="size-5" />
        실제 고객 데이터는 위치를, 재현은 원인 가설을 보여줘요. 아래는 가상 페르소나로 다시 돌려 본
        가설이에요
      </p>
      <dl className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {[
          ["재현 방문", `${task.valid_sessions}명`],
          [`${stageName} 도달`, screen ? `${screen.reached}명` : "도달 없음"],
          [`${stageName}에서 이탈`, screen ? `${screen.dropouts_here}명` : "—"],
        ].map(([label, value]) => (
          <div key={label} className="flex flex-col gap-1 p-4">
            <dt className="text-xs text-subtle">{label}</dt>
            <dd className="text-lg font-bold text-ink">{value}</dd>
          </div>
        ))}
      </dl>
      <section aria-labelledby="hypothesis-title" className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h2 id="hypothesis-title" className="text-lg font-bold text-ink">
            원인 가설
          </h2>
          <span className="text-xs text-muted">
            {screen && screen.frictions.length > 0
              ? `${stageName} 화면에서 감지된 불편한 점`
              : `${stageName} 화면 불편한 점이 없어 과업 전체 불편한 점으로 보여줘요`}
          </span>
        </div>
        {hypotheses.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-subtle">
            <Icon name="check" className="size-4" />
            재현에서 감지된 불편한 점이 없어요 · 좌절 모델 예측 맞추기가 필요할 수 있어요
          </p>
        ) : (
          <ol aria-label="원인 가설 목록" className="flex flex-col">
            {hypotheses.map((item, index) => {
              const shot = apiAssetUrl(item.screenshot_url);
              return (
                <li
                  key={item.category}
                  className="flex gap-4 border-b border-line py-4 last:border-b-0"
                >
                  <span className="w-4 font-bold text-ink">{index + 1}</span>
                  <div className="flex flex-1 flex-col gap-2">
                    <p className="flex items-baseline gap-3">
                      <span className="font-bold text-ink">{item.name}</span>
                      <span className="text-xs text-subtle">
                        {task.valid_sessions}명 중 {item.sessions}명
                        {item.dropouts > 0 ? ` · 이 원인으로 이탈 ${item.dropouts}명` : ""}
                        {item.where ? ` · ${item.where}` : ""}
                      </span>
                    </p>
                    {item.detail && <p className="text-caption text-gray-800">{item.detail}</p>}
                  </div>
                  {shot && (
                    <img
                      src={shot}
                      alt={`${item.name} 화면 캡처`}
                      loading="lazy"
                      className="aspect-[16/10] w-40 rounded-lg border border-gray-200 object-cover object-top"
                    />
                  )}
                </li>
              );
            })}
          </ol>
        )}
        <Link
          to={reportLink}
          className="mt-2 flex items-center gap-1 self-start text-caption font-bold text-ink"
        >
          재현 리포트 전체 보기
          <Icon name="chevron-right" className="size-4" />
        </Link>
      </section>
    </div>
  );
}
