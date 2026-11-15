import { CAUSE_LABELS, STAGE_LABELS } from "@/constants/persona";
import {
  causeShares,
  formatDay,
  percentRange,
  taskFindings,
} from "@/pages/report/utils/reportView";
import type {
  DropCause,
  PersonaReport,
  PersonaReportSummary,
  Range,
  ReportTask,
  Stage,
} from "@/types/persona.type";

/*
  P18 재테스트 전후 비교 계산.
  예측은 [최소, 최대] 범위라 차이는 범위 가운데값끼리 뺍니다 (Figma 20~30% → 35~45% = +15%p).
*/

export const midpoint = ([min, max]: Range) => (min + max) / 2;

/* 범위 가운데값 차이 (반올림한 정수) */
export const rangeDiff = (a: Range, b: Range) => Math.round(midpoint(b) - midpoint(a));

/* +15%p · −3건 · 0%p — 빼기는 Figma 처럼 U+2212 */
export function formatDiff(value: number, unit: string) {
  if (value > 0) return `+${value}${unit}`;
  if (value < 0) return `−${Math.abs(value)}${unit}`;
  return `0${unit}`;
}

/* 두 실행 모두에 있는 과업 (A 순서) */
export function commonTasks(a: ReportTask[], b: ReportTask[]) {
  const ids = new Set(b.map((task) => task.id));
  return a.filter((task) => ids.has(task.id));
}

/*
  B 기본값: A 바로 다음(더 최근) 실행, 없으면 A 바로 이전 실행.
  목록은 최신순입니다. A 가 목록에 없으면 가장 최근 실행.
*/
export function pickDefaultB(reports: PersonaReportSummary[], aId: string): string | null {
  const others = reports.filter((report) => report.run_id !== aId);
  if (others.length === 0) return null;
  const index = reports.findIndex((report) => report.run_id === aId);
  if (index < 0) return others[0].run_id;
  return (reports[index - 1] ?? reports[index + 1]).run_id;
}

export type StageRow = {
  stage: Stage;
  label: string;
  a: Range | null;
  b: Range | null;
  diff: number | null;
};

/* 단계별 도달률 (첫 단계 대비 %). A 의 단계 순서에 B 에만 있는 단계를 뒤에 붙입니다 */
export function compareStages(a: ReportTask, b: ReportTask): StageRow[] {
  const rates = (task: ReportTask) => {
    const funnel = task.funnel ?? [];
    const base = funnel[0]?.reached[1] ?? 0;
    return new Map(funnel.map((stage) => [stage.stage, percentRange(stage.reached, base)]));
  };
  const rateA = rates(a);
  const rateB = rates(b);
  const order = [...rateA.keys(), ...[...rateB.keys()].filter((stage) => !rateA.has(stage))];
  return order.map((stage) => {
    const ra = rateA.get(stage) ?? null;
    const rb = rateB.get(stage) ?? null;
    return {
      stage,
      label: STAGE_LABELS[stage],
      a: ra,
      b: rb,
      diff: ra && rb ? rangeDiff(ra, rb) : null,
    };
  });
}

export type CauseRow = { cause: DropCause; label: string; a: number; b: number; diff: number };

/* 원인 분포 (이탈 세션 대비 %) A → B. 한쪽에만 있는 원인은 0% 로 봅니다 */
export function compareCauses(
  a: PersonaReport,
  b: PersonaReport,
  taskA: ReportTask,
  taskB: ReportTask,
): CauseRow[] {
  const sharesA = causeShares(taskFindings(a.findings, taskA.id), taskA.dropout);
  const sharesB = causeShares(taskFindings(b.findings, taskB.id), taskB.dropout);
  const causes = [
    ...sharesA.map((share) => share.cause),
    ...sharesB
      .map((share) => share.cause)
      .filter((cause) => !sharesA.some((s) => s.cause === cause)),
  ];
  return causes.map((cause) => {
    const shareA = sharesA.find((share) => share.cause === cause)?.share ?? 0;
    const shareB = sharesB.find((share) => share.cause === cause)?.share ?? 0;
    return { cause, label: CAUSE_LABELS[cause], a: shareA, b: shareB, diff: shareB - shareA };
  });
}

/*
  원인 비교는 같은 패널 인원·시드 수로 돌린 실행끼리만 합니다 (Figma 안내 문구).
  조건(임시 필드)이 없으면 같은 조건인지 알 수 없어 비교하지 않습니다.
*/
export function canCompareCauses(a: PersonaReport, b: PersonaReport) {
  return (
    a.conditions != null &&
    b.conditions != null &&
    a.conditions.panel_size === b.conditions.panel_size &&
    a.conditions.seeds === b.conditions.seeds
  );
}

/* "4차 · 재테스트 (11월 8일)" — 재테스트 표시는 브라우저에 남긴 기록(임시)으로 정합니다 */
export function runLabel(reports: PersonaReportSummary[], runId: string, retest: boolean) {
  const index = reports.findIndex((report) => report.run_id === runId);
  if (index < 0) return "알 수 없는 실행";
  const order = reports.length - index;
  const retestMark = retest ? " · 재테스트" : "";
  return `${order}차${retestMark} (${formatDay(reports[index].created_at)})`;
}
