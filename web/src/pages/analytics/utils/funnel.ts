import type { MeasurementFunnel } from "@/types/measurement.type";

/* R06·R08 공통 표시 도우미 */
export const PERIODS = [
  { value: "7", label: "최근 7일" },
  { value: "14", label: "14일" },
  { value: "30", label: "30일" },
] as const;

export const formatCount = (n: number) => n.toLocaleString("ko-KR");
export const formatPct = (value: number) => `${value.toFixed(1)}%`;
/* 오차 (%p). 음수는 긴 빼기표로 씁니다 */
export const formatError = (value: number) =>
  `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toFixed(1)}%p`;

const dayFormat = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "long",
  day: "numeric",
});

export function formatDay(iso: string) {
  return dayFormat.format(new Date(iso));
}

export function periodText(funnel: MeasurementFunnel) {
  return `${formatDay(funnel.since)} ~ ${formatDay(funnel.until)}`;
}

/* "3차 (11월 7일)" — 비교 기준이 되는 사전 테스트 */
export function reportLabel(funnel: MeasurementFunnel) {
  if (!funnel.report) return "사전 테스트 없음";
  const day = formatDay(funnel.report.created_at);
  return funnel.report.run_sequence ? `${funnel.report.run_sequence}차 (${day})` : day;
}
