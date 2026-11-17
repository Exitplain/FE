import type { PersonaSession, Stage } from "@/types/persona.type";
import type {
  FunnelKey,
  ReportCauseV1,
  ReportData,
  ReportSessionRow,
  ReportTaskV1,
  ReportTechnicalFailure,
  RunReport,
} from "@/types/report.type";

import { reportSource } from "./personaMock";

/*
  제품 API 리포트(report-2) mock. 개발 API mock 의 끝난 실행(시드별 세션)을
  BE backend/reports/aggregate.py 와 같은 규칙으로 집계합니다.
  - 세션 분류: success / dropout(simulated_dropout) / technical / incomplete
  - 기술 실패·결과 없음은 퍼널·달성률·원인 분모에서 뺍니다
  - 퍼널은 7단계, 세션마다 단계별 첫 도달만 셉니다. 이탈 단계 = 마지막으로 본 화면의 단계
  - 합계는 모든 시드의 합, *_range 는 시드별 최솟값~최댓값
  P 화면이 모두 제품 API 로 옮겨지면 실행 mock 과 함께 정리합니다.
*/

const FUNNEL: [FunnelKey, string][] = [
  ["landing", "랜딩"],
  ["browse", "탐색"],
  ["detail", "상세"],
  ["cart", "장바구니"],
  ["signup", "가입"],
  ["payment", "결제 정보"],
  ["complete", "완료"],
];

/* agent/behavior.py CAUSES */
const CAUSES: Record<string, string> = {
  input_burden: "입력 부담",
  navigation: "탐색 실패",
  cost: "비용 충격",
  value: "가치 불명확",
  trust: "신뢰 부족",
  technical: "기술 오류·지연",
  accessibility: "접근성 장벽",
};

/* 개발 mock 의 화면 단계 → 제품 API 퍼널 단계 */
const STAGE_KEY: Record<Stage, FunnelKey | null> = {
  landing: "landing",
  delivery: "browse",
  benefits: "browse",
  account: "browse",
  product: "detail",
  coupon: "detail",
  subscription: "detail",
  cart: "cart",
  signup: "signup",
  checkout: "payment",
  complete: "complete",
  other: null,
};

const NOTES = [
  "목표 도달·가상 이탈은 설정한 성공 경로와 페르소나 수치로 판정한 모의 결과입니다. 실제 사용자 이탈률이 아닙니다.",
  "기술 실패·한도 초과·결과 없음은 퍼널·달성률·원인 분모에서 뺐습니다.",
  "퍼널은 세션마다 단계별 최초 도달만 1번 셉니다. 범위는 시드별 결과의 최솟값~최댓값입니다.",
];

type Kind = ReportSessionRow["kind"];

type Row = {
  task_id: string;
  seed: number;
  persona_id: string;
  segment: [string, string];
  status: string;
  kind: Kind;
  stages: FunnelKey[];
  primary_cause: string | null;
  steps: number;
  duration_seconds: number | null;
  reason: string;
};

function rate(numerator: number, denominator: number) {
  return denominator ? Math.round((numerator / denominator) * 10000) / 10000 : null;
}

function range(values: number[]) {
  return values.length
    ? { min: Math.min(...values), max: Math.max(...values) }
    : { min: null, max: null };
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function classify(status: string, technical: readonly string[]): Kind {
  if (status === "success") return "success";
  if (status === "simulated_dropout") return "dropout";
  if (technical.includes(status)) return "technical";
  return "incomplete";
}

/* 세션이 지나간 화면 단계 (완료면 경로 끝까지, 이탈이면 멈춘 화면까지) → 퍼널 단계, 처음 도달만 */
function stagesOf(session: PersonaSession, path: Stage[] | undefined): FunnelKey[] {
  if (!path) return session.terminal_stage ? keysOf([session.terminal_stage]) : [];
  if (session.status === "success") return keysOf(path);
  const stopped = session.terminal_stage ? path.indexOf(session.terminal_stage) : -1;
  return keysOf(path.slice(0, Math.max(0, stopped) + 1));
}

function keysOf(stages: Stage[]): FunnelKey[] {
  const keys: FunnelKey[] = [];
  for (const stage of stages) {
    const key = STAGE_KEY[stage];
    if (key && !keys.includes(key)) keys.push(key);
  }
  return keys;
}

function taskReport(
  taskId: string,
  name: string,
  rows: Row[],
  personas: number,
  seeds: number,
): { task: ReportTaskV1; failures: ReportTechnicalFailure[] } {
  const counted = rows.filter((row) => row.kind === "success" || row.kind === "dropout");
  const count = (kind: Kind) => rows.filter((row) => row.kind === kind).length;
  const valid = counted.length;
  /* 시드 번호가 1부터 이어진다고 가정하지 않고, 기록에 나온 시드마다 나눕니다 */
  const seedNumbers = [...new Set(rows.map((row) => row.seed))];
  const bySeed = seedNumbers.map((seed) => counted.filter((row) => row.seed === seed));
  const dropouts = counted.filter((row) => row.kind === "dropout");
  const lastStage = (row: Row) => row.stages[row.stages.length - 1];

  let previous: number | null = null;
  const funnel = FUNNEL.map(([key, stageName], order) => {
    const reached = counted.filter((row) => row.stages.includes(key)).length;
    const stage = {
      stage_id: `stage_${key}`,
      key,
      name: stageName,
      order,
      reached,
      reached_range: range(
        bySeed.map((list) => list.filter((row) => row.stages.includes(key)).length),
      ),
      rate_of_valid: rate(reached, valid),
      rate_of_previous: previous ? rate(reached, previous) : null,
      dropouts_here: dropouts.filter((row) => lastStage(row) === key).length,
    };
    if (reached) previous = reached;
    return stage;
  });

  const primary = new Map<string, number>();
  for (const row of dropouts) {
    const cause = row.primary_cause ?? "unknown";
    primary.set(cause, (primary.get(cause) ?? 0) + 1);
  }
  const causes: ReportCauseV1[] = [...Object.keys(CAUSES), "unknown"]
    .filter((key) => primary.get(key))
    .map((key) => ({
      key,
      name: CAUSES[key] ?? "원인 미상",
      dropouts: primary.get(key) ?? 0,
      share: rate(primary.get(key) ?? 0, dropouts.length),
      sessions_with_cause: counted.filter((row) => row.primary_cause === key).length,
    }))
    .sort((a, b) => b.dropouts - a.dropouts || b.sessions_with_cause - a.sessions_with_cause);

  const segments = [...new Map(rows.map((row) => [row.segment[0], row.segment])).values()].sort(
    (a, b) => a[0].localeCompare(b[0]),
  );
  const expected = personas * seeds;
  const durations = counted.flatMap((row) =>
    row.duration_seconds == null ? [] : [row.duration_seconds],
  );
  const failures = rows
    .filter((row) => row.kind === "technical")
    .map((row) => ({
      task_id: taskId,
      seed: row.seed,
      persona_id: row.persona_id,
      status: row.status,
      reason: row.reason,
    }));

  return {
    failures,
    task: {
      task_id: taskId,
      name,
      expected_sessions: expected,
      recorded_sessions: rows.length,
      success: count("success"),
      dropout: dropouts.length,
      technical: count("technical"),
      incomplete: count("incomplete") + Math.max(0, expected - rows.length),
      valid_sessions: valid,
      achievement_rate: rate(count("success"), valid),
      seed_ranges: {
        success: range(bySeed.map((list) => list.filter((row) => row.kind === "success").length)),
        dropout: range(bySeed.map((list) => list.filter((row) => row.kind === "dropout").length)),
        /* 유효 세션이 없는 시드는 범위에 넣지 않습니다 (0%로 끌어내리지 않게) */
        achievement_rate: range(
          bySeed.flatMap((list) => {
            const value = rate(list.filter((row) => row.kind === "success").length, list.length);
            return value == null ? [] : [value];
          }),
        ),
      },
      kpis: {
        median_duration_seconds: median(durations),
        median_steps: median(counted.map((row) => row.steps)),
      },
      funnel,
      causes,
      top_causes: causes.filter((cause) => cause.dropouts).slice(0, 3),
      heatmap: {
        stages: FUNNEL.map(([key]) => key),
        rows: segments.map(([id, segmentName]) => ({
          segment_id: id,
          name: segmentName,
          dropouts: FUNNEL.map(
            ([key]) =>
              dropouts.filter((row) => row.segment[0] === id && lastStage(row) === key).length,
          ),
        })),
      },
      segments: segments.map(([id, segmentName]) => {
        const mine = rows.filter((row) => row.segment[0] === id);
        const success = mine.filter((row) => row.kind === "success").length;
        const dropout = mine.filter((row) => row.kind === "dropout").length;
        return {
          segment_id: id,
          name: segmentName,
          success,
          dropout,
          technical: mine.filter((row) => row.kind === "technical").length,
          achievement_rate: rate(success, success + dropout),
        };
      }),
      data_quality: { unknown_stages: 0 },
    },
  };
}

export function reportDataV1(runId: string): { data: ReportData; createdAt: string } {
  const { run, seeds, paths, technical } = reportSource(runId);
  const rows: Row[] = seeds.flatMap((sessions, seedIndex) =>
    sessions.map((session) => ({
      task_id: session.task_id,
      seed: session.seed ?? seedIndex + 1,
      persona_id: session.code ?? session.id,
      segment: [
        session.segment_id ?? session.segment_name ?? session.profile_id,
        session.segment_name ?? session.name,
      ],
      status: session.status,
      kind: classify(session.status, technical),
      stages: stagesOf(session, paths[session.task_id]),
      primary_cause:
        session.status === "simulated_dropout" ? (session.issue?.category ?? null) : null,
      steps: session.steps,
      duration_seconds:
        session.elapsed_ms == null ? null : Math.round(session.elapsed_ms / 100) / 10,
      reason: session.reason,
    })),
  );

  const taskIds = [...new Set(rows.map((row) => row.task_id))];
  const results = taskIds.map((taskId) => {
    const taskRows = rows.filter((row) => row.task_id === taskId);
    const personas = new Set(taskRows.map((row) => row.persona_id)).size;
    const name =
      run.tasks.find((task) => task.id === taskId)?.name ??
      seeds.flat().find((session) => session.task_id === taskId)?.task_name ??
      taskId;
    return taskReport(taskId, name, taskRows, personas, seeds.length);
  });
  const tasks = results.map((result) => result.task);
  const sum = (key: keyof ReportTaskV1) =>
    tasks.reduce((total, task) => total + (task[key] as number), 0);
  const summary = {
    expected_sessions: sum("expected_sessions"),
    recorded_sessions: sum("recorded_sessions"),
    success: sum("success"),
    dropout: sum("dropout"),
    technical: sum("technical"),
    incomplete: sum("incomplete"),
    valid_sessions: sum("valid_sessions"),
    achievement_rate: rate(sum("success"), sum("valid_sessions")),
  };

  return {
    createdAt: run.created_at ?? new Date().toISOString(),
    data: {
      schema_version: "report-2",
      status: summary.incomplete === 0 ? "final" : "partial",
      summary,
      tasks,
      technical_failures: results.flatMap((result) => result.failures),
      sessions: rows.map((row) => ({
        task_id: row.task_id,
        seed: row.seed,
        persona_id: row.persona_id,
        segment_id: row.segment[0],
        segment_name: row.segment[1],
        status: row.status,
        kind: row.kind,
        terminal_stage: row.stages[row.stages.length - 1] ?? null,
        primary_cause: row.primary_cause,
        steps: row.steps,
        duration_seconds: row.duration_seconds,
      })),
      ignored_records: 0,
      persona_generator: null,
      notes: NOTES,
    },
  };
}

/* 리포트 id 는 실행 목록 mock(runItemOf)과 같은 규칙입니다 */
export function reportIdOf(runId: string) {
  return `report-${runId}`;
}

export function runIdOfReport(reportId: string) {
  return reportId.startsWith("report-") ? reportId.slice("report-".length) : null;
}

/* GET /api/v1/runs/{id}/reports 응답 */
export function runReportV1(runId: string): RunReport {
  const { data, createdAt } = reportDataV1(runId);
  const reportId = reportIdOf(runId);
  return {
    report_id: reportId,
    run_ref: runId,
    revision: 1,
    status: data.status,
    source: "database",
    kind: "prediction",
    plan_revision_id: `plan-revision-${runId}`,
    created_at: createdAt,
    data,
    revisions: [{ report_id: reportId, revision: 1, status: data.status, created_at: createdAt }],
  };
}

export function reportMarkdownV1(runId: string): string {
  const { data } = reportDataV1(runId);
  return [
    `# 사전 테스트 리포트 (${runId})`,
    "",
    `- 세션 ${data.summary.recorded_sessions}/${data.summary.expected_sessions}개 · 목표 도달 ${data.summary.success} · 가상 이탈 ${data.summary.dropout} · 기술 실패 ${data.summary.technical}`,
    "",
    ...data.tasks.flatMap((task) => [
      `## ${task.name}`,
      "",
      ...task.funnel.map((stage) => `- ${stage.name}: ${stage.reached}`),
      "",
    ]),
    ...data.notes.map((note) => `> ${note}`),
    "",
  ].join("\n");
}
