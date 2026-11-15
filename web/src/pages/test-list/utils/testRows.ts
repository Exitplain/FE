import type { PersonaReportSummary, PersonaRun, Range, Variant } from "@/types/persona.type";

export type TestRowStatus = "preparing" | "running" | "done" | "failed";

export type TestRow = {
  /* run_id */
  key: string;
  name: string;
  status: TestRowStatus;
  /* Figma P01 목표 달성률(예측 · 과업별) "20~30% · 25~35%". 모르면 — */
  completion: string;
  date: string;
};

function formatCompletion(ranges: Range[] | undefined) {
  if (!ranges || ranges.length === 0) return "—";
  return ranges.map(([low, high]) => (low === high ? `${low}%` : `${low}~${high}%`)).join(" · ");
}

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
  /* BE 는 오프셋이 붙은 UTC ISO(+00:00)를 보냅니다. 읽을 수 없는 값은 화면이 깨지지 않게 — 로 */
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return dayKey.format(date) === dayKey.format(now)
    ? timeFormat.format(date)
    : dateFormat.format(date);
}

/*
  목록 API 에는 이름·차수·과업 필드가 없어 이름을 "N차 · 버전 · 세션 수" 로 만듭니다.
  차수는 완료된 실행 순서(오래된 것이 1차), 진행 중인 실행은 그다음 차수입니다.
  BE 목록은 저장된 완료 실행 전체를 페이지 없이 주므로(report_history) 길이로 차수를 셉니다.
*/
function rowName(
  order: number,
  variant: Variant | null | undefined,
  sessions: number,
  tasks?: string[],
) {
  /* 임시: mock 은 과업 이름을 줘서 Figma 처럼 "N차 · 첫 주문 외 1개" 로 만듭니다 */
  if (tasks && tasks.length > 0) {
    const summary = tasks.length > 1 ? `${tasks[0]} 외 ${tasks.length - 1}개` : tasks[0];
    return `${order}차 · ${summary}`;
  }
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
    name: rowName(reports.length - index, report.variant, report.sessions, report.tasks),
    status: report.outcome === "failed" ? "failed" : "done",
    completion: formatCompletion(report.completion),
    date: formatRunDate(report.created_at, now),
  }));

  /* idle 은 실행이 아니고, 목록에 이미 있는 실행은 두 번 넣지 않습니다 */
  if (!currentRun?.id || currentRun.status === "idle") return done;
  if (reports.some((report) => report.run_id === currentRun.id)) return done;

  /* 방금 끝나 목록을 다시 받기 전인 실행도 완료 행으로 남겨 목록에서 사라지지 않게 합니다 */
  const started = currentRun.stage
    ? currentRun.stage !== "preparing"
    : currentRun.sessions.some((session) => session.status !== "queued");
  const allFailed =
    currentRun.sessions.length > 0 &&
    currentRun.sessions.every((session) =>
      ["agent_failure", "budget_exceeded"].includes(session.status),
    );
  const status: TestRowStatus =
    currentRun.status === "completed"
      ? allFailed && !currentRun.stopped
        ? "failed"
        : "done"
      : started
        ? "running"
        : "preparing";
  const taskNames =
    currentRun.tasks.length > 0 ? currentRun.tasks.map((task) => task.name) : undefined;
  return [
    {
      key: currentRun.id,
      name: rowName(reports.length + 1, currentRun.variant, currentRun.sessions.length, taskNames),
      status,
      completion: "—",
      date: formatRunDate(currentRun.created_at, now),
    },
    ...done,
  ];
}
