import type { ReactNode } from "react";

import InfoTip from "@/components/InfoTip/InfoTip";
import type { ReportFinding, ReportTask } from "@/types/persona.type";
import { cn } from "@/utils/cn";

import { completion, dropLabel, formatDuration, formatRange, worstDrop } from "../utils/reportView";

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
  모두 예측(시드 반복 범위)이며 기술 실패는 BE 가 뺀 값입니다.
  중앙 소요 시간은 리포트 임시 필드(median_duration)이고 없으면 "—" 입니다.
*/
export default function KpiRow({
  task,
  findings,
}: {
  task: ReportTask;
  findings: ReportFinding[];
}) {
  const { rate, completed, base } = completion(task);
  const drop = worstDrop(task);
  const causes = new Set(
    findings.map((finding) => finding.category).filter((cause) => cause !== "none"),
  ).size;

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
        value={formatRange(rate, "%")}
        note={`완료 ${formatRange(completed)}명 / ${base}명`}
      />
      <Kpi
        className="col-span-3"
        label="최대 이탈 구간"
        value={drop ? dropLabel(drop) : "이탈 없음"}
        note={drop ? `이 구간 이탈 ${formatRange(drop.rate, "%")}` : "모든 세션이 끝까지 갔어요"}
      />
      <Kpi
        className="col-span-3"
        label="완료자 중앙 소요 시간"
        value={task.median_duration ? formatDuration(task.median_duration) : "—"}
        note="완료 세션 기준"
      />
      <Kpi
        className="col-span-3"
        label="발견 이슈"
        value={`${findings.length}건`}
        note={`이탈 원인 ${causes}종 기준`}
      />
    </div>
  );
}
