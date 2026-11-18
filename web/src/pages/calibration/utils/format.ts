/* 보정 화면 표시 도우미 */

/* 배율 표시 (1.00 = 기본 모형) */
export const formatScale = (value: number) => `×${value.toFixed(2)}`;

const dayTime = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export const formatApplied = (iso: string) => dayTime.format(new Date(iso));
