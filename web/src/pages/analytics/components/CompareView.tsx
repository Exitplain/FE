import Button from "@/components/Button/Button";
import ChoiceChip from "@/components/ChoiceChip/ChoiceChip";
import Icon from "@/components/Icon/Icon";
import SegmentedTabs from "@/components/SegmentedTabs/SegmentedTabs";
import { cn } from "@/utils/cn";

import { COMPARE_TASKS, compareError, isGap, type Period } from "../data/analyticsMock";

const PERIODS = [
  { value: "7", label: "최근 7일" },
  { value: "14", label: "14일" },
  { value: "30", label: "30일" },
] as const;

const formatError = (value: number) =>
  `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toFixed(1)}%p`;

/*
  R08 예측 vs 실측 — 비교할 사전 테스트 · 기간 · 과업을 고르고, 단계별로 예측 범위와 실측 단일값을 비교합니다.
  실측이 예측 범위 밖이면 차이 구간이고, 그 구간은 원인 재현(R09)으로 넘어갈 수 있습니다.
*/
export default function CompareView({
  period,
  onPeriodChange,
  taskId,
  onTaskChange,
  onReproduce,
}: {
  period: Period;
  onPeriodChange: (period: Period) => void;
  taskId: string;
  onTaskChange: (taskId: string) => void;
  onReproduce: (stage: string) => void;
}) {
  const task = COMPARE_TASKS.find((item) => item.id === taskId) ?? COMPARE_TASKS[0];
  const errors = task.rows.map(compareError);
  const meanError = errors.reduce((sum, value) => sum + Math.abs(value), 0) / errors.length;
  const gaps = task.rows.filter(isGap);

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-xs text-subtle">비교할 사전 테스트</span>
        {/* 임시: 실행 목록과 연결 전이라 최근 완료 실행으로 고정 (R08b 선택은 API 연동 때) */}
        <p className="flex min-h-10 items-center gap-6 rounded-lg bg-gray-50 px-3 text-caption text-ink">
          3차 (11월 7일 · 최근 완료)
          <Icon name="chevron-right" className="size-4 text-muted" />
        </p>
        <SegmentedTabs label="기간" options={PERIODS} value={period} onChange={onPeriodChange} />
        <span className="text-xs text-subtle">과업</span>
        <div role="radiogroup" aria-label="과업" className="flex gap-2">
          {COMPARE_TASKS.map((item) => (
            <ChoiceChip
              key={item.id}
              kind="radio"
              selected={item.id === task.id}
              onClick={() => onTaskChange(item.id)}
            >
              {item.name}
            </ChoiceChip>
          ))}
        </div>
      </div>

      <dl className="grid grid-cols-1 gap-6 md:grid-cols-4">
        <div className="flex flex-col gap-1 p-4 md:col-span-2">
          <dt className="text-xs text-subtle">최대 이탈 구간</dt>
          <dd className="text-display font-bold text-ink">
            {task.maxDrop.matched ? "일치" : "불일치"}
          </dd>
          <dd className="text-xs text-muted">
            예측 {task.maxDrop.predicted} / 실측 {task.maxDrop.actual}
          </dd>
        </div>
        <div className="flex flex-col gap-1 border-l border-line p-4">
          <dt className="text-xs text-subtle">평균 오차</dt>
          <dd className="text-lg font-bold text-ink">{meanError.toFixed(1)}%p</dd>
          <dd className="text-xs text-muted">{task.rows.length}개 단계 절댓값 평균</dd>
        </div>
        <div className="flex flex-col gap-1 border-l border-line p-4">
          <dt className="text-xs text-subtle">차이 구간</dt>
          <dd className="text-lg font-bold text-ink">{gaps.length}곳</dd>
          <dd className="text-xs text-muted">
            {gaps.length > 0 ? gaps.map((row) => row.stage).join(" · ") : "모두 범위 안"}
          </dd>
        </div>
      </dl>

      <section aria-labelledby="stage-compare-title" className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 id="stage-compare-title" className="text-lg font-bold text-ink">
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
              실측(실제 사용자)
            </span>
          </p>
        </div>
        <table aria-labelledby="stage-compare-title" className="w-full text-left text-caption">
          <thead>
            <tr className="border-b border-line text-xs text-muted">
              <th className="w-20 py-2 font-medium">단계</th>
              <th className="py-2 font-medium">도달률</th>
              <th className="w-20 py-2 font-medium">예측</th>
              <th className="w-16 py-2 font-medium">실측</th>
              <th className="w-20 py-2 font-medium">오차</th>
              <th className="w-56 py-2" aria-label="차이 구간" />
            </tr>
          </thead>
          <tbody>
            {task.rows.map((row, index) => {
              const gap = isGap(row);
              return (
                <tr key={row.stage} className="border-b border-line last:border-b-0">
                  <th scope="row" className="py-3 font-bold text-ink">
                    {row.stage}
                  </th>
                  <td className="py-3 pr-6">
                    {/* 예측 범위(점선 상자)와 실측(진한 막대). 위치·너비는 % 값이라 style 로 둡니다 */}
                    <div className="relative h-2.5 rounded-xs bg-gray-50">
                      <div
                        className="absolute inset-y-0 rounded-xs border border-dashed border-gray-400 bg-gray-100"
                        style={{
                          left: `${row.predicted[0]}%`,
                          width: `${row.predicted[1] - row.predicted[0]}%`,
                        }}
                      />
                    </div>
                    <div className="mt-1 h-2.5 rounded-xs bg-gray-50">
                      <div
                        className="h-full rounded-xs bg-subtle"
                        style={{ width: `${row.actual}%` }}
                      />
                    </div>
                  </td>
                  <td className="py-3 text-gray-800">
                    {row.predicted[0]}~{row.predicted[1]}%
                  </td>
                  <td className="py-3 font-bold text-ink">{row.actual.toFixed(1)}%</td>
                  <td className={cn("py-3", gap ? "font-bold text-ink" : "text-gray-800")}>
                    {formatError(errors[index])}
                  </td>
                  <td className="py-3">
                    {gap && (
                      <span className="flex items-center justify-end gap-3">
                        <span className="flex items-center gap-1 text-xs font-bold text-ink">
                          <Icon name="status-error" className="size-4 text-danger" />
                          차이 구간
                        </span>
                        <Button onClick={() => onReproduce(row.stage)}>이 구간 원인 재현</Button>
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="text-xs text-muted">예측은 범위, 실측은 단일값 · 범위 밖이면 차이 구간</p>
      </section>
    </div>
  );
}
