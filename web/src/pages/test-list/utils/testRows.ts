import type { RunGoalRate, RunItem, RunStatus } from "@/types/run.type";

export type TestRowStatus = "preparing" | "running" | "done" | "failed" | "cancelled";

/*
  이름을 누르면 갈 화면. 끝났는데 리포트가 없는 실행(취소 등)은 링크가 없습니다.
  - report: 리포트(P12) · testRun: 실행 화면(P08~P10)
*/
export type TestRowLink = "report" | "testRun" | null;

export type TestRow = {
  /* run id */
  key: string;
  name: string;
  status: TestRowStatus;
  link: TestRowLink;
  /* Figma P01 목표 달성률(예측 · 과업별) "25% · 40%". 모르면 — */
  completion: string;
  date: string;
};

const ROW_STATUS: Record<RunStatus, TestRowStatus> = {
  queued: "preparing",
  running: "running",
  /* 집계 중(P10 분석)도 아직 리포트가 없어 실행 화면에서 봅니다 */
  finalizing: "running",
  completed: "done",
  partially_completed: "done",
  failed: "failed",
  cancelled: "cancelled",
};

function rowLink(item: RunItem, status: TestRowStatus): TestRowLink {
  if (status === "preparing" || status === "running") return "testRun";
  return item.report ? "report" : null;
}

/* 0~1 비율을 정수 %로. 유효 세션이 없어 비율이 없는 과업은 — */
export function formatGoalRates(rates: readonly RunGoalRate[] | undefined) {
  if (!rates || rates.length === 0) return "—";
  return rates
    .map(({ achievement_rate: rate }) => (rate === null ? "—" : `${Math.round(rate * 100)}%`))
    .join(" · ");
}

/* 서비스 사용자가 한국에 있어 실행 환경 시간대와 상관없이 서울 시간으로 보여줍니다 */
const TIME_ZONE = "Asia/Seoul";
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE });
const timeFormat = new Intl.DateTimeFormat("ko-KR", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const dateFormat = new Intl.DateTimeFormat("ko-KR", {
  timeZone: TIME_ZONE,
  month: "long",
  day: "numeric",
});

/* Figma P01 실행일: 오늘이면 "14:40", 아니면 "11월 7일" */
export function formatRunDate(iso: string | null | undefined, now = new Date()): string {
  if (!iso) return "—";
  /* BE 는 오프셋이 붙은 UTC ISO(+00:00)를 보냅니다. 읽을 수 없는 값은 화면이 깨지지 않게 — 로 */
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return dayKey.format(date) === dayKey.format(now)
    ? timeFormat.format(date)
    : dateFormat.format(date);
}

/*
  제품 API 실행 목록 → P01 행. 이름·차수는 BE 가 만든 name 을 그대로 씁니다.
  목록에는 진행 중인 실행도 들어 있고 번호 최신순입니다.
*/
export function toTestRows(items: readonly RunItem[], now = new Date()): TestRow[] {
  return items.map((item) => {
    const status = ROW_STATUS[item.status];
    return {
      key: item.id,
      name: item.name || `${item.sequence_no}차`,
      status,
      link: rowLink(item, status),
      completion: formatGoalRates(item.report?.goal_rates),
      date: formatRunDate(item.created_at, now),
    };
  });
}
