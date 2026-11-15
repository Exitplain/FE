import type { RangeBarDatum } from "@/components/RangeBarChart/RangeBarChart";
import { STAGE_LABELS } from "@/constants/persona";
import type {
  DropCause,
  PersonaReportSummary,
  Range,
  ReportFinding,
  ReportTask,
  Stage,
} from "@/types/persona.type";

/*
  P12 리포트 화면 계산. 예측은 시드 반복 결과의 [최소, 최대] 범위라 모든 수치를 범위로 다룹니다.
  기술 실패(실행 오류·한도 도달)는 BE 가 퍼널·원인 계산에서 뺀 값을 그대로 씁니다.
*/

/* [4, 6] → "4~6", 같으면 "5" */
export function formatRange([min, max]: Range, unit = "") {
  return min === max ? `${min}${unit}` : `${min}~${max}${unit}`;
}

/* 250 → "4분 10초", [250, 290] → "4분 10초~4분 50초" */
export function formatDuration([min, max]: Range) {
  const one = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return m > 0 ? `${m}분 ${s}초` : `${s}초`;
  };
  return min === max ? one(min) : `${one(min)}~${one(max)}`;
}

export function percent(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

export function percentRange([min, max]: Range, total: number): Range {
  return [percent(min, total), percent(max, total)];
}

/*
  목표 달성률 (예측): 퍼널 마지막 단계 도달 인원 / 첫 단계 도달 인원.
  퍼널이 없으면 완료 세션 / (전체 - 기술 실패) 로 셉니다.
*/
export function completion(task: ReportTask): { rate: Range; completed: Range; base: number } {
  const first = task.funnel?.[0];
  const last = task.funnel?.at(-1);
  if (first && last) {
    const base = first.reached[1];
    return { rate: percentRange(last.reached, base), completed: last.reached, base };
  }
  const base = task.total - task.technical;
  const completed: Range = [task.success, task.success];
  return { rate: percentRange(completed, base), completed, base };
}

/*
  최대 이탈 구간: 이탈 인원(범위 상한 기준)이 가장 많은 단계와 그 직전 단계.
  비율은 직전 단계 도달 인원 대비입니다. 이탈이 없으면 null.
*/
export function worstDrop(task: ReportTask): { from: Stage | null; to: Stage; rate: Range } | null {
  const funnel = task.funnel ?? [];
  let worst = -1;
  funnel.forEach((stage, index) => {
    if (stage.dropout[1] > 0 && (worst < 0 || stage.dropout[1] > funnel[worst].dropout[1])) {
      worst = index;
    }
  });
  if (worst < 0) return null;

  const previous = funnel[worst - 1];
  return {
    from: previous?.stage ?? null,
    to: funnel[worst].stage,
    rate: percentRange(funnel[worst].dropout, (previous ?? funnel[worst]).reached[1]),
  };
}

export function dropLabel(drop: { from: Stage | null; to: Stage }) {
  return drop.from
    ? `${STAGE_LABELS[drop.from]} → ${STAGE_LABELS[drop.to]}`
    : `${STAGE_LABELS[drop.to]}에서`;
}

/* 예측 퍼널 막대: "17~19명 · 이탈 1~3", 첫 단계는 "20명 (100%)" */
export function funnelRows(task: ReportTask): RangeBarDatum[] {
  return (task.funnel ?? []).map((stage, index) => ({
    key: stage.stage,
    label: STAGE_LABELS[stage.stage],
    value: stage.reached,
    valueLabel:
      index === 0
        ? `${formatRange(stage.reached)}명 (100%)`
        : `${formatRange(stage.reached)}명 · 이탈 ${formatRange(stage.dropout)}`,
  }));
}

/*
  세그먼트 히트맵을 그릴 수 있는지. 임시 필드라 구간 수(퍼널 단계 - 1)와 세그먼트 칸 수가
  다르면 열이 밀리므로 그리지 않고 섹션 이동에서도 뺍니다.
*/
export function hasHeatmap(task: ReportTask) {
  const transitions = (task.funnel?.length ?? 0) - 1;
  const segments = task.segments ?? [];
  return (
    transitions > 0 &&
    segments.length > 0 &&
    segments.every((segment) => segment.dropouts.length === transitions)
  );
}

/* 이 과업의 문제를 영향(겪은 세션 수) 큰 순서로 */
export function taskFindings(findings: ReportFinding[], taskId: string) {
  return findings
    .filter((finding) => finding.task_id === taskId)
    .sort((a, b) => b.affected_sessions - a.affected_sessions);
}

/*
  이탈 원인 분포: 원인별 이탈 세션 수와 가상 이탈 세션 전체(dropoutTotal) 대비 비율.
  문제로 묶이지 않은 이탈이 있어도 분모는 과업의 이탈 세션 수입니다 (없으면 묶인 세션 합).
  "없음(none)"은 원인이 아니라 세지 않습니다. 반올림이라 합이 100% 가 아닐 수 있습니다.
*/
export function causeShares(findings: ReportFinding[], dropoutTotal = 0) {
  const counts = new Map<DropCause, number>();
  for (const finding of findings) {
    if (finding.category === "none") continue;
    counts.set(finding.category, (counts.get(finding.category) ?? 0) + finding.affected_sessions);
  }
  const grouped = [...counts.values()].reduce((sum, count) => sum + count, 0);
  const total = dropoutTotal > 0 ? dropoutTotal : grouped;
  return [...counts]
    .map(([cause, sessions]) => ({ cause, sessions, share: percent(sessions, total) }))
    .sort((a, b) => b.sessions - a.sessions);
}

/*
  실행 차수: 완료 목록(최신순)에서 오래된 것이 1차 (P01 목록과 같은 규칙).
  목록에 없으면 null
*/
export function runOrder(reports: PersonaReportSummary[], runId: string) {
  const index = reports.findIndex((report) => report.run_id === runId);
  return index < 0 ? null : reports.length - index;
}

/* 서비스 사용자가 한국에 있어 서울 시간 기준 "11월 7일" */
const dayFormat = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "long",
  day: "numeric",
});

export function formatDay(iso: string | null | undefined) {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : dayFormat.format(date);
}
