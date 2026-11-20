import type { V1Issue } from "@/apis/issue.api";

/* 테스트용 발견한 문제 응답 한 줄 (BE reports/issues.py 모양) */
export function issueFixture(overrides: Partial<V1Issue> = {}): V1Issue {
  return {
    id: "order:/signup:input_burden",
    cause_key: "input_burden",
    cause: "입력 부담",
    stage_key: "/signup",
    stage: "가입 단계",
    project_id: 1,
    project_name: "반찬로드",
    task_id: "order",
    task: "첫 주문 완료",
    impact: [5, 7],
    dropouts: 18,
    valid_sessions: 60,
    verdict: "계속 발생",
    first_seen_at: "2026-11-03T03:00:00+00:00",
    first_seen: "11월 3일",
    last_seen_at: "2026-11-07T03:00:00+00:00",
    run_id: "run-3",
    report_id: "report-3",
    evidence: "'첫 주문 완료' 과업에서 가상 방문 18개가 '가입 단계' 화면에서 이탈했어요.",
    ...overrides,
  };
}

export const issueList = (items: V1Issue[]) => ({
  count: items.length,
  items,
  note: "가상 페르소나의 모의 결과입니다. 실제 사용자 이탈률이 아닙니다.",
});
