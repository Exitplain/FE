import { useId, useState } from "react";

import Button from "@/components/Button/Button";
import InfoTip from "@/components/InfoTip/InfoTip";
import { STAGE_LABELS } from "@/constants/persona";
import type { ReportTask } from "@/types/persona.type";
import { cn } from "@/utils/cn";

import { formatRange, hasHeatmap } from "../utils/reportView";

/*
  Figma 히트맵 칸 색 (#fafafa → #e0e0e0 → #c7c7c7 → #ababab → #8f8f8f) 을 가장 가까운 회색 토큰으로.
  가장 많은 칸 대비 비율로 단계를 고르고, 2단계 이상은 굵은 글자입니다.
*/
const HEAT = ["bg-gray-50", "bg-gray-200", "bg-gray-300", "bg-gray-400", "bg-gray-500"] as const;

function heatLevel(value: number, max: number) {
  if (value <= 0 || max <= 0) return 0;
  return Math.max(1, Math.round((value / max) * (HEAT.length - 1)));
}

/*
  P12 세그먼트 × 이탈 구간.
  접힘: 가장 많이 떠난 칸 한 줄 + "세그먼트 n개 더 보기" / 펼침: 세그먼트 × 구간 히트맵 표 (Figma Section/Heatmap)
  칸 값은 이탈 인원 범위의 상한(시드 범위가 있으면 "1~2")입니다.
*/
export default function SegmentHeatmap({ task }: { task: ReportTask }) {
  const headingId = useId();
  const [open, setOpen] = useState(false);
  const funnel = task.funnel ?? [];
  const segments = task.segments ?? [];
  const transitions = funnel
    .slice(1)
    .map((stage, index) => `${STAGE_LABELS[funnel[index].stage]}→${STAGE_LABELS[stage.stage]}`);
  /* 임시 필드라 모양이 어긋나면(구간 수가 다르면) 열이 밀리지 않게 그리지 않습니다 */
  if (!hasHeatmap(task)) return null;
  const cells = segments.flatMap((segment) =>
    segment.dropouts.map((range, index) => ({ segment, index, value: range[1] })),
  );
  const max = Math.max(0, ...cells.map((cell) => cell.value));
  const top = cells.find((cell) => cell.value === max && max > 0);

  return (
    <section id="heatmap" aria-labelledby={headingId} className="flex scroll-mt-8 flex-col gap-3">
      <div className="flex items-center gap-2">
        <h2 id={headingId} className="text-base font-medium text-ink">
          세그먼트 × 이탈 구간
        </h2>
        <InfoTip text="AI 고객 세그먼트별로 어느 구간에서 떠났는지 보여줘요." />
        {open && <span className="ml-auto text-xs text-muted">칸 = 이탈 인원 · 진할수록 많음</span>}
      </div>
      <p className="text-caption text-subtle">
        {top
          ? `최다: ${top.segment.name} ${transitions[top.index]} ${top.value}명`
          : "세그먼트별 이탈이 없었어요"}
      </p>

      {open && (
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-2 text-caption">
            <caption className="sr-only">세그먼트 × 이탈 구간 히트맵</caption>
            <thead>
              <tr>
                <th scope="col" className="w-32 text-left text-xs font-medium text-muted">
                  세그먼트
                </th>
                {transitions.map((label) => (
                  <th
                    key={label}
                    scope="col"
                    className="text-center text-xs font-medium whitespace-nowrap text-muted"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {segments.map((segment) => (
                <tr key={segment.id}>
                  <th scope="row" className="text-left font-medium whitespace-nowrap text-ink">
                    {segment.name}
                  </th>
                  {segment.dropouts.map((range, index) => {
                    const level = heatLevel(range[1], max);
                    return (
                      <td
                        key={transitions[index]}
                        className={cn(
                          "h-12 min-w-16 rounded text-center text-ink",
                          HEAT[level],
                          level >= 2 && "font-bold",
                        )}
                      >
                        {formatRange(range)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Button
        variant="link"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="-ml-2 self-start"
      >
        {open ? "접기" : `세그먼트 ${segments.length}개 더 보기`}
      </Button>
    </section>
  );
}
