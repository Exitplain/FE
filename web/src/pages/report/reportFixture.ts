import type { FunnelKey, ReportTaskV1, RunReport } from "@/types/report.type";

/*
  테스트용 제품 API 리포트(report-2). 숫자를 정해 두어 화면 문구를 그대로 확인합니다.
  BE 와 같은 뜻으로 맞춰 둡니다: dropouts_here[i] = 단계 i 를 마지막으로 보고 떠난 세션 = reached[i] - (다음에 지나간 단계의 reached)
  "첫 주문" 과업: 20명 × 시드 3회 = 60세션 중 기술 실패 2, 유효 58 (목표 도달 30 · 이탈 28)
  "쿠폰으로 주문" 과업: 가입이 없는 경로 (가입 0명 뒤에 결제·완료가 옴)
*/
const STAGES: [FunnelKey, string][] = [
  ["landing", "랜딩"],
  ["browse", "탐색"],
  ["detail", "상세"],
  ["cart", "장바구니"],
  ["signup", "가입"],
  ["payment", "결제 정보"],
  ["complete", "완료"],
];

function funnel(reached: number[], ranges: [number, number][], dropouts: number[], valid: number) {
  return STAGES.map(([key, name], order) => ({
    stage_id: `stage_${key}`,
    key,
    name,
    order,
    reached: reached[order],
    reached_range: { min: ranges[order][0], max: ranges[order][1] },
    rate_of_valid: valid ? Math.round((reached[order] / valid) * 10000) / 10000 : null,
    rate_of_previous: null,
    dropouts_here: dropouts[order],
  }));
}

export function orderTask(overrides: Partial<ReportTaskV1> = {}): ReportTaskV1 {
  return {
    task_id: "order",
    name: "첫 주문",
    expected_sessions: 60,
    recorded_sessions: 60,
    success: 30,
    dropout: 28,
    technical: 2,
    incomplete: 0,
    valid_sessions: 58,
    achievement_rate: 0.5172,
    seed_ranges: {
      success: { min: 9, max: 11 },
      dropout: { min: 8, max: 10 },
      achievement_rate: { min: 0.45, max: 0.55 },
    },
    kpis: { median_duration_seconds: 86.4, median_steps: 12 },
    funnel: funnel(
      [58, 55, 50, 44, 30, 30, 30],
      [
        [19, 20],
        [18, 19],
        [16, 17],
        [14, 15],
        [9, 11],
        [9, 11],
        [9, 11],
      ],
      [3, 5, 6, 14, 0, 0, 0],
      58,
    ),
    causes: [
      { key: "input_burden", name: "입력 부담", dropouts: 14, share: 0.5, sessions_with_cause: 16 },
      { key: "cost", name: "비용 충격", dropouts: 7, share: 0.25, sessions_with_cause: 9 },
      { key: "navigation", name: "탐색 실패", dropouts: 4, share: 0.1429, sessions_with_cause: 4 },
      { key: "trust", name: "신뢰 부족", dropouts: 3, share: 0.1071, sessions_with_cause: 3 },
      { key: "value", name: "가치 불명확", dropouts: 0, share: 0, sessions_with_cause: 2 },
    ],
    top_causes: [],
    heatmap: {
      stages: STAGES.map(([key]) => key),
      rows: [
        { segment_id: "segment_1", name: "알뜰 탐색형", dropouts: [1, 2, 1, 9, 0, 0, 0] },
        { segment_id: "segment_2", name: "바쁜 직장인", dropouts: [2, 3, 5, 5, 0, 0, 0] },
      ],
    },
    segments: [],
    data_quality: { unknown_stages: 0 },
    ...overrides,
  };
}

export function couponTask(): ReportTaskV1 {
  return orderTask({
    task_id: "coupon",
    name: "쿠폰으로 주문",
    success: 40,
    dropout: 20,
    technical: 0,
    valid_sessions: 60,
    achievement_rate: 0.6667,
    seed_ranges: {
      success: { min: 13, max: 14 },
      dropout: { min: 6, max: 7 },
      achievement_rate: { min: 0.65, max: 0.7 },
    },
    funnel: funnel(
      [60, 58, 52, 45, 0, 40, 40],
      [
        [20, 20],
        [19, 20],
        [17, 18],
        [15, 15],
        [0, 0],
        [13, 14],
        [13, 14],
      ],
      [2, 6, 7, 5, 0, 0, 0],
      60,
    ),
    causes: [{ key: "cost", name: "비용 충격", dropouts: 20, share: 1, sessions_with_cause: 20 }],
    heatmap: { stages: STAGES.map(([key]) => key), rows: [] },
  });
}

export function cannedReport(tasks: ReportTaskV1[] = [orderTask(), couponTask()]): RunReport {
  const personas = Array.from(
    { length: 20 },
    (_, index) => `P-${String(index + 1).padStart(3, "0")}`,
  );
  return {
    report_id: "report-run-1",
    run_ref: "run-1",
    revision: 1,
    status: "final",
    source: "database",
    kind: "prediction",
    plan_revision_id: "plan-revision-1",
    created_at: "2026-11-07T05:20:00+00:00",
    revisions: [
      {
        report_id: "report-run-1",
        revision: 1,
        status: "final",
        created_at: "2026-11-07T05:20:00+00:00",
      },
    ],
    data: {
      schema_version: "report-2",
      status: "final",
      summary: {
        expected_sessions: 120,
        recorded_sessions: 120,
        success: 70,
        dropout: 48,
        technical: 2,
        incomplete: 0,
        valid_sessions: 118,
        achievement_rate: 0.5932,
      },
      tasks,
      technical_failures: [
        {
          task_id: "order",
          seed: 2,
          persona_id: "P-007",
          status: "agent_failure",
          reason: "화면을 읽지 못했어요",
        },
      ],
      sessions: [1, 2, 3].flatMap((seed) =>
        personas.map((persona) => ({
          task_id: "order",
          seed,
          persona_id: persona,
          segment_id: "segment_1",
          segment_name: "알뜰 탐색형",
          status: "success",
          kind: "success" as const,
          terminal_stage: "complete",
          primary_cause: null,
          steps: 12,
          duration_seconds: 80,
        })),
      ),
      ignored_records: 0,
      persona_generator: null,
      notes: [
        "목표 도달·가상 이탈은 설정한 성공 경로와 페르소나 수치로 판정한 모의 결과입니다. 실제 사용자 이탈률이 아닙니다.",
      ],
    },
  };
}
