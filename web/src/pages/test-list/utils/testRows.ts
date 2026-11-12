import type { PersonaReportSummary, PersonaRun, Variant } from "@/types/persona.type";

export type TestRowStatus = "preparing" | "running" | "done";

export type TestRow = {
  /* run_id */
  key: string;
  name: string;
  status: TestRowStatus;
  date: string;
};

const VARIANT_LABEL: Record<Variant, string> = { fixed: "개선 버전", problem: "문제 버전" };

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
  const date = new Date(iso);
  return dayKey.format(date) === dayKey.format(now)
    ? timeFormat.format(date)
    : dateFormat.format(date);
}

/*
  목록 API 에는 이름·차수·과업 필드가 없어 이름을 "N차 · 버전 · 세션 수" 로 만듭니다.
  차수는 완료된 실행 순서(오래된 것이 1차), 진행 중인 실행은 그다음 차수입니다.
*/
function rowName(order: number, variant: Variant | null | undefined, sessions: number) {
  const parts = [`${order}차`];
  if (variant) parts.push(VARIANT_LABEL[variant]);
  parts.push(`세션 ${sessions}개`);
  return parts.join(" · ");
}

export function toTestRows({
  reports,
  currentRun,
  now = new Date(),
}: {
  reports: PersonaReportSummary[];
  currentRun: PersonaRun | undefined;
  now?: Date;
}): TestRow[] {
  const done = reports.map((report, index): TestRow => ({
    key: report.run_id,
    name: rowName(reports.length - index, report.variant, report.sessions),
    status: "done",
    date: formatRunDate(report.created_at, now),
  }));

  /* 완료된 현재 실행은 목록에 이미 있고, idle 은 실행이 아닙니다 */
  if (!currentRun?.id || currentRun.status !== "running") return done;
  if (reports.some((report) => report.run_id === currentRun.id)) return done;

  const started = currentRun.sessions.some((session) => session.status !== "queued");
  return [
    {
      key: currentRun.id,
      name: rowName(reports.length + 1, currentRun.variant, currentRun.sessions.length),
      status: started ? "running" : "preparing",
      date: formatRunDate(currentRun.created_at, now),
    },
    ...done,
  ];
}
