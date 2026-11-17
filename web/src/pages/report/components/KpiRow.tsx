import type { ReactNode } from "react";

import InfoTip from "@/components/InfoTip/InfoTip";
import type { ReportTaskV1 } from "@/types/report.type";
import { cn } from "@/utils/cn";

import { formatMinMax, formatSeconds, percentRange, worstDropV1 } from "../utils/reportData";

/* Figma 요약 칸: 라벨 13px · 값 20px Bold (첫 칸은 40px) · 설명 12px · 칸 사이 세로선(높이 96) */
function Kpi({
  label,
  value,
  note,
  large = false,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  note: ReactNode;
  large?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-24 flex-col gap-2 border-line not-first:border-l not-first:pl-6",
        className,
      )}
    >
      <div className="flex items-center gap-2 text-caption text-subtle">{label}</div>
      <p className={cn("font-bold text-ink", large ? "text-display" : "mt-auto text-xl")}>
        {value}
      </p>
      <p className="text-xs text-muted">{note}</p>
    </div>
  );
}

/*
  P12 요약 숫자 4칸 (Figma 칸 너비 368 · 256 · 256 · 256 → 13칸 격자 4 · 3 · 3 · 3).
  제품 API 리포트(report-2) 기준: 모두 예측이며 기술 실패·결과 없음은 BE 가 분모에서 뺀 값입니다.
  - 목표 달성률: 시드별 달성률 범위 (같으면 한 값)
  - 최대 이탈 구간: 떠난 세션이 가장 많은 단계 (모든 시드 합)
  - 중앙 소요 시간: 목표 도달·가상 이탈 세션의 중앙값
  - 기록 세션: 예상 세션 중 결과가 남은 세션 (서버에 발견 이슈가 아직 없어 대신 둡니다)
*/
export default function KpiRow({ task }: { task: ReportTaskV1 }) {
  const drop = worstDropV1(task);
  const rate = percentRange(task.seed_ranges.achievement_rate);

  return (
    <div className="grid grid-cols-13 gap-6">
      <Kpi
        className="col-span-4"
        large
        label={
          <>
            목표 달성률
            <span className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-ink">
              예측
            </span>
            <InfoTip text="시드를 바꿔 반복한 결과의 범위예요. 실제 사용자 비율이 아니에요." />
          </>
        }
        value={task.valid_sessions > 0 ? formatMinMax(rate, "%") : "—"}
        note={`완료 ${task.success}명 / ${task.valid_sessions}명 · 시드 합계`}
      />
      <Kpi
        className="col-span-3"
        label="최대 이탈 구간"
        value={drop ? drop.label : "이탈 없음"}
        note={
          drop
            ? `이 구간 이탈 ${drop.dropouts}명${drop.percent == null ? "" : ` · ${drop.percent}%`}`
            : "모든 세션이 끝까지 갔어요"
        }
      />
      <Kpi
        className="col-span-3"
        label="중앙 소요 시간"
        value={formatSeconds(task.kpis.median_duration_seconds)}
        note="목표 도달·가상 이탈 세션 기준"
      />
      <Kpi
        className="col-span-3"
        label="기록 세션"
        value={`${task.recorded_sessions}/${task.expected_sessions}개`}
        note={`기술 실패 ${task.technical} · 결과 없음 ${task.incomplete}`}
      />
    </div>
  );
}
