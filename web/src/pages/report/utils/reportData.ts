import type { RangeBarDatum } from "@/components/RangeBarChart/RangeBarChart";
import type { MinMax, ReportData, ReportFunnelStageV1, ReportTaskV1 } from "@/types/report.type";

/* 화면에 그리는 퍼널 한 단계 (실행 퍼널·7단계 공통). key 는 실행 퍼널이면 화면 경로, 7단계면 단계 키 */
export type FunnelStageView = {
  key: string;
  name: string;
  path: string | null;
  reached: number;
  reached_range: MinMax;
  rate_of_valid: number | null;
  dropouts_here: number;
};

import { formatDay } from "./reportView";

/*
  제품 API 리포트(report-2) → P12·P21 화면 값.
  비율은 0~1 로 오므로 화면에서 정수 %로 바꿉니다. 인원 합계는 모든 시드의 합, *_range 는 시드별 범위입니다.
*/

/* 0~1 비율 → 정수 %. 분모가 없어 null 이면 null */
export function toPercent(rate: number | null | undefined): number | null {
  return rate == null ? null : Math.round(rate * 100);
}

/* 같으면 한 값, 다르면 "a~b". 값이 없으면 "—" */
export function formatMinMax(range: MinMax, unit = ""): string {
  const { min, max } = range;
  if (min == null || max == null) return "—";
  return min === max ? `${min}${unit}` : `${min}~${max}${unit}`;
}

export function percentRange(range: MinMax): MinMax {
  return { min: toPercent(range.min), max: toPercent(range.max) };
}

/* 초 → "1분 26초" / "48초" */
export function formatSeconds(seconds: number | null | undefined): string {
  if (seconds == null) return "—";
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  if (minutes === 0) return `${rest}초`;
  return rest === 0 ? `${minutes}분` : `${minutes}분 ${rest}초`;
}

/*
  과업이 실제로 지나가는 단계만 남깁니다. BE 퍼널은 모든 과업에 같은 7단계라,
  가입이 없는 과업은 "가입 0명" 뒤에 "완료 15명" 이 오게 됩니다.
  뒤 단계에 도달한 세션이 있는데 아무도 오지 않은 단계는 건너뛴 단계로 보고 뺍니다.
  (뒤에도 아무도 없으면 실제로 거기서 끊긴 것이라 남깁니다)
*/
export function visibleStages(task: ReportTaskV1): ReportFunnelStageV1[] {
  const funnel = [...task.funnel].sort((a, b) => a.order - b.order);
  return funnel.filter(
    (stage, index) =>
      stage.reached > 0 || !funnel.slice(index + 1).some((next) => next.reached > 0),
  );
}

/*
  화면에 그릴 퍼널 단계. BE 가 실행 퍼널(journey_funnel: 실제로 지나간 화면)을 주면 그것을 쓰고,
  없으면(예전 리포트) 7단계 퍼널에서 건너뛴 단계를 뺀 것을 쓴다.
  실행 퍼널은 아무도 지나가지 않은 단계가 없고, 이름은 화면 역할 이름('상품 상세')이다.
*/
export function funnelStages(task: ReportTaskV1): FunnelStageView[] {
  const journey = task.journey_funnel?.stages ?? [];
  if (journey.length > 0) {
    return [...journey]
      .sort((a, b) => a.order - b.order)
      .map((stage) => ({
        key: stage.id,
        name: stage.name,
        path: stage.path,
        reached: stage.reached,
        reached_range: stage.reached_range,
        rate_of_valid: stage.rate_of_valid,
        dropouts_here: stage.dropouts_here,
      }));
  }
  return visibleStages(task).map((stage) => ({
    key: stage.key,
    name: stage.name,
    path: null,
    reached: stage.reached,
    reached_range: stage.reached_range,
    rate_of_valid: stage.rate_of_valid,
    dropouts_here: stage.dropouts_here,
  }));
}

/* 예측 퍼널 막대: 시드별 도달 범위 + 유효 세션 대비 비율 */
export function funnelRowsV1(task: ReportTaskV1): RangeBarDatum[] {
  return funnelStages(task).map((stage, index) => {
    const min = stage.reached_range.min ?? 0;
    const max = stage.reached_range.max ?? 0;
    const people = formatMinMax(stage.reached_range, "명");
    const percent = toPercent(stage.rate_of_valid);
    return {
      key: stage.key,
      label: stage.name,
      value: [min, max],
      valueLabel: index === 0 || percent == null ? people : `${people} · ${percent}%`,
    };
  });
}

/* 막대 100% 기준: 첫 단계의 시드별 최대 도달 인원 */
export function funnelMax(task: ReportTaskV1): number {
  return funnelStages(task)[0]?.reached_range.max ?? 0;
}

/*
  최대 이탈 구간 — 이 단계를 마지막으로 보고 떠난 세션(dropouts_here)이 가장 많은 단계와 그 다음 단계.
  비율은 이 단계 도달 대비 여기서 떠난 세션 (둘 다 모든 시드 합). 랜딩에서 바로 떠난 경우도 셉니다
*/
export function worstDropV1(task: ReportTaskV1) {
  const stages = funnelStages(task);
  let worst = -1;
  stages.forEach((stage, index) => {
    if (
      stage.dropouts_here > 0 &&
      (worst < 0 || stage.dropouts_here > stages[worst].dropouts_here)
    ) {
      worst = index;
    }
  });
  if (worst < 0) return null;
  /* dropouts_here 는 이 단계까지 오고 다음 단계로 가지 못한 세션이라 "이 단계 → 다음 단계" 구간입니다 */
  const at = stages[worst];
  const next = stages[worst + 1];
  return {
    label: next ? `${at.name} → ${next.name}` : `${at.name}에서 이탈`,
    dropouts: at.dropouts_here,
    percent: at.reached > 0 ? Math.round((at.dropouts_here / at.reached) * 100) : null,
  };
}

/* 이탈 원인 분포 — 주 원인으로 떠난 세션이 있는 원인만, 많은 순 (BE 가 이미 정렬) */
export function causeRowsV1(task: ReportTaskV1) {
  return task.causes
    .filter((cause) => cause.dropouts > 0)
    .map((cause) => ({
      key: cause.key,
      name: cause.name,
      dropouts: cause.dropouts,
      percent: toPercent(cause.share) ?? 0,
    }));
}

/*
  세그먼트 × 이탈 단계 표. 칸은 그 단계를 마지막으로 보고 떠난 세션 수(모든 시드 합)이고,
  열은 퍼널에서 보이는 단계와 같게 둡니다.
*/
export function heatmapV1(task: ReportTaskV1) {
  const journey = task.journey_funnel;
  const useJourney = Boolean(journey && journey.stages.length > 0);
  const heatmap = useJourney && journey ? journey.heatmap : task.heatmap;
  const names = new Map<string, string>(funnelStages(task).map((stage) => [stage.key, stage.name]));
  if (useJourney) names.set("other", "기타 화면");
  const columns = heatmap.stages
    .map((key: string, index: number) => ({ key, index, name: names.get(key) }))
    .filter((column): column is { key: string; index: number; name: string } =>
      Boolean(column.name),
    );
  const rows = heatmap.rows.map((row) => ({
    id: row.segment_id,
    name: row.name,
    cells: columns.map((column) => row.dropouts[column.index] ?? 0),
  }));
  return { columns, rows };
}

/* 실행 조건 — 세션 목록에서 페르소나 수와 시드 수를 셉니다 */
export function runConditions(data: ReportData) {
  const personas = new Set(data.sessions.map((session) => session.persona_id)).size;
  /* 시드 번호가 1부터 이어진다고 가정하지 않고 개수만 셉니다 */
  const seeds = new Set(data.sessions.map((session) => session.seed)).size;
  return { personas, seeds };
}

/* 머리말 설명 "11월 7일 · AI 고객 20명 × 시드 3회" */
export function describeReport(createdAt: string, data: ReportData): string {
  const { personas, seeds } = runConditions(data);
  const parts = [formatDay(createdAt)];
  if (personas > 0 && seeds > 0) parts.push(`AI 고객 ${personas}명 × 반복 ${seeds}회`);
  if (data.status === "partial") parts.push("부분 결과");
  return parts.join(" · ");
}

/* 과업 칩 "전체" 값 (주소 ?task=all) */
export const ALL_TASKS = "all";

/*
  과업 카드 순서: 이탈이 많은 과업 먼저 (같으면 리포트 순서 그대로).
  이탈은 모든 시드 합(dropout)입니다.
*/
export function sortTasksByDropout(tasks: ReportTaskV1[]): ReportTaskV1[] {
  return tasks
    .map((task, index) => ({ task, index }))
    .sort((a, b) => b.task.dropout - a.task.dropout || a.index - b.index)
    .map(({ task }) => task);
}
