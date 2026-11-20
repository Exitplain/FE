import Button from "@/components/Button/Button";
import Icon from "@/components/Icon/Icon";
import SegmentedTabs from "@/components/SegmentedTabs/SegmentedTabs";
import type {
  FunnelDays,
  FunnelStageCompare,
  FunnelTaskCompare,
  MeasurementFunnel,
} from "@/types/measurement.type";
import { cn } from "@/utils/cn";

import { ALL_TASKS, formatError, PERIODS, periodText, reportLabel } from "../utils/funnel";
import { TaskChips } from "./FunnelView";

/*
  R08 예측 vs 실측 — 기간·과업을 고르고, 단계별로 예측 범위와 실측 단일값을 비교합니다.
  예측 범위는 사전 테스트 도달 비율의 95% 구간이고, 실측이 범위 밖이면 차이 구간입니다.
  차이 구간은 원인 재현(R09)으로 넘어갈 수 있습니다.
  과업 "전체"(allTasks)면 과업마다 요약·단계별 비교를 위아래로 이어 보여 줍니다 (단계가 달라 합치지 않음).
*/
export default function CompareView({
  funnel,
  task,
  period,
  allTasks = false,
  onPeriodChange,
  onTaskChange,
  onReproduce,
}: {
  funnel: MeasurementFunnel;
  task: FunnelTaskCompare;
  period: FunnelDays;
  allTasks?: boolean;
  onPeriodChange: (period: FunnelDays) => void;
  onTaskChange: (taskId: string) => void;
  onReproduce: (stage: FunnelStageCompare, task: FunnelTaskCompare) => void;
}) {
  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-xs text-subtle">비교할 사전 테스트</span>
        <p className="flex min-h-10 items-center rounded-lg bg-gray-50 px-3 text-caption text-ink">
          {reportLabel(funnel)} · 가장 최근
        </p>
        <SegmentedTabs label="기간" options={PERIODS} value={period} onChange={onPeriodChange} />
        <TaskChips
          tasks={funnel.tasks}
          taskId={allTasks ? ALL_TASKS : task.task_id}
          onChange={onTaskChange}
          allOption
        />
      </div>
      {allTasks ? (
        funnel.tasks.map((item) => (
          <section
            key={item.task_id}
            aria-labelledby={`task-compare-${item.task_id}`}
            className="flex flex-col gap-6 border-t border-line pt-8 first-of-type:border-t-0 first-of-type:pt-0"
          >
            <h2 id={`task-compare-${item.task_id}`} className="text-xl font-bold text-ink">
              {item.name}
            </h2>
            <TaskCompare
              funnel={funnel}
              task={item}
              titleId={`stage-compare-title-${item.task_id}`}
              onReproduce={(stage) => onReproduce(stage, item)}
            />
          </section>
        ))
      ) : (
        <TaskCompare
          funnel={funnel}
          task={task}
          titleId="stage-compare-title"
          onReproduce={(stage) => onReproduce(stage, task)}
        />
      )}
    </div>
  );
}

/* 과업 하나의 요약(최대 이탈 구간·평균 오차·차이 구간)과 단계별 비교 표 */
function TaskCompare({
  funnel,
  task,
  titleId,
  onReproduce,
}: {
  funnel: MeasurementFunnel;
  task: FunnelTaskCompare;
  titleId: string;
  onReproduce: (stage: FunnelStageCompare) => void;
}) {
  const names = new Map(task.stages.map((stage) => [stage.id, stage.name]));
  /* 첫 단계는 실측 도달률의 기준(100%)이라 표에서 뺍니다 (Figma R08 은 둘째 단계부터) */
  const rows = task.stages.slice(1);
  const gaps = task.stages.filter((stage) => stage.gap);
  const drop = task.max_drop;

  return (
    <div className="flex flex-col gap-10">
      {task.collecting && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-lg bg-gray-50 p-3 text-caption font-bold text-ink"
        >
          <Icon name="more" className="size-5" />
          실제 고객 데이터 방문이 {task.base_sessions}개라 아직 표본이 적어요 · {funnel.min_sample}
          회 방문부터 비교가 안정돼요
        </p>
      )}

      <dl className="grid grid-cols-1 gap-6 md:grid-cols-4">
        <div className="flex flex-col gap-1 p-4 md:col-span-2">
          <dt className="text-xs text-subtle">최대 이탈 구간</dt>
          <dd className="text-display font-bold text-ink">
            {drop.predicted && drop.actual ? (drop.matched ? "일치" : "불일치") : "—"}
          </dd>
          <dd className="text-xs text-muted">
            예측 {drop.predicted?.label ?? "—"} / 실제 고객 데이터 {drop.actual?.label ?? "—"}
          </dd>
        </div>
        <div className="flex flex-col gap-1 border-l border-line p-4">
          <dt className="text-xs text-subtle">평균 오차</dt>
          <dd className="text-lg font-bold text-ink">
            {task.mean_error == null ? "—" : `${task.mean_error.toFixed(1)}%p`}
          </dd>
          <dd className="text-xs text-muted">{task.compared_stages}개 단계 절댓값 평균</dd>
        </div>
        <div className="flex flex-col gap-1 border-l border-line p-4">
          <dt className="text-xs text-subtle">차이 구간</dt>
          <dd className="text-lg font-bold text-ink">{gaps.length}곳</dd>
          <dd className="text-xs text-muted">
            {gaps.length > 0
              ? gaps.map((stage) => names.get(stage.id)).join(" · ")
              : "모두 범위 안"}
          </dd>
        </div>
      </dl>

      <section aria-labelledby={titleId} className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 id={titleId} className="text-lg font-bold text-ink">
            단계별 비교
          </h2>
          <p className="flex items-center gap-4 text-xs text-subtle">
            <span className="flex items-center gap-1">
              <span
                aria-hidden
                className="h-2.5 w-5 rounded-xs border border-dashed border-gray-400 bg-gray-100"
              />
              예측(시뮬레이션)
            </span>
            <span className="flex items-center gap-1">
              <span aria-hidden className="h-2.5 w-5 rounded-xs bg-subtle" />
              실제 고객 데이터
            </span>
          </p>
        </div>
        <table aria-labelledby={titleId} className="w-full text-left text-caption">
          <thead>
            <tr className="border-b border-line text-xs text-muted">
              <th className="w-28 py-2 font-medium">단계</th>
              <th className="py-2 font-medium">도달률</th>
              <th className="w-24 py-2 font-medium">예측</th>
              <th className="w-16 py-2 font-medium">실제 고객 데이터</th>
              <th className="w-20 py-2 font-medium">오차</th>
              <th className="w-56 py-2" aria-label="차이 구간" />
            </tr>
          </thead>
          <tbody>
            {rows.map((stage) => {
              const { low, high } = stage.predicted;
              const rate = stage.actual?.rate ?? null;
              return (
                <tr key={stage.id} className="border-b border-line last:border-b-0">
                  <th scope="row" className="py-3 font-bold text-ink">
                    {stage.name}
                  </th>
                  <td className="py-3 pr-6">
                    {/* 예측 범위(점선 상자)와 실측(진한 막대). 위치·너비는 % 값이라 style 로 둡니다 */}
                    <div className="relative h-2.5 rounded-xs bg-gray-50">
                      {low != null && high != null && (
                        <div
                          className="absolute inset-y-0 rounded-xs border border-dashed border-gray-400 bg-gray-100"
                          style={{ left: `${low}%`, width: `${Math.max(high - low, 0.5)}%` }}
                        />
                      )}
                    </div>
                    <div className="mt-1 h-2.5 rounded-xs bg-gray-50">
                      <div
                        className="h-full rounded-xs bg-subtle"
                        style={{ width: `${rate ?? 0}%` }}
                      />
                    </div>
                  </td>
                  <td className="py-3 text-gray-800">
                    {low == null || high == null ? "—" : `${Math.round(low)}~${Math.round(high)}%`}
                  </td>
                  <td className="py-3 font-bold text-ink">
                    {rate == null ? (
                      <span className="font-normal text-muted">매핑 안 됨</span>
                    ) : (
                      `${rate.toFixed(1)}%`
                    )}
                  </td>
                  <td className={cn("py-3", stage.gap ? "font-bold text-ink" : "text-gray-800")}>
                    {stage.error == null ? "—" : formatError(stage.error)}
                  </td>
                  <td className="py-3">
                    {stage.gap && (
                      <span className="flex items-center justify-end gap-3">
                        <span className="flex items-center gap-1 text-xs font-bold text-ink">
                          <Icon name="status-error" className="size-4 text-danger" />
                          차이 구간
                        </span>
                        <Button onClick={() => onReproduce(stage)}>이 구간 원인 재현</Button>
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="text-xs text-muted">
          {periodText(funnel)} · 예측은 범위(95%), 실제 고객 데이터는 단일값 · 범위 밖이면 차이 구간
        </p>
      </section>
    </div>
  );
}
