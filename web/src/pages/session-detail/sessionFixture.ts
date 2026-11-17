import type { ReportSessionDetail, ReportSessionStep } from "@/types/report.type";

/* 테스트용 세션 상세 응답 (BE reports.services.session_detail 모양). 스텝 3개, 마지막에 가입 단계에서 이탈 */
const step = (index: number, overrides: Partial<ReportSessionStep> = {}): ReportSessionStep => ({
  step_id: `step_${String(index * 2 + 1).padStart(3, "0")}`,
  index,
  url: `https://shop.example/${index}`,
  stage: "browse",
  stage_name: "탐색",
  frustration_score: 20 + index * 30,
  frustration_threshold: 70,
  required_fields: 0,
  screenshot: `/api/v1/observations/${index + 1}/screenshot`,
  frictions: [],
  action: { kind: "click", target_id: null, explanation: "상품 보기" },
  ...overrides,
});

export function sessionFixture(overrides: Partial<ReportSessionDetail> = {}): ReportSessionDetail {
  return {
    report_id: "report-1",
    run_ref: "run-1",
    task: { id: "order", name: "첫 주문" },
    seed: 2,
    persona: {
      code: "P-007",
      segment_id: "careful",
      segment_name: "신중한 첫 방문형",
      variables: null,
      context: null,
    },
    session_id: "s-7",
    final_screenshot: "/api/v1/sessions/7/final-screenshot",
    status: "simulated_dropout",
    reason: "필수 입력이 많아 멈춤",
    steps: 3,
    duration_seconds: 185,
    terminal_stage: "signup",
    primary_cause: { key: "input_burden", name: "입력 부담" },
    causes: [{ key: "input_burden", name: "입력 부담" }],
    timeline: [
      step(0, { stage: "landing", stage_name: "랜딩" }),
      step(1),
      step(2, { stage: "signup", stage_name: "가입", screenshot: null, action: null }),
    ],
    chart: { threshold: 70, points: [] },
    ...overrides,
  };
}
