import type { CalibrationProposal, CalibrationRecord } from "@/types/calibration.type";

/*
  보정 mock 데이터 (BE calibrations 응답 모양). 반찬로드(1)만 이력이 있고, 다른 프로젝트는 보정 전입니다.
  가장 최근 적용이 11월 5일이라 P05b·P05c 의 "보정 11월 5일 적용"과 맞습니다.
*/
export const CALIBRATIONS: Record<string, CalibrationRecord[]> = {
  "1": [
    {
      id: 2,
      revision: 1,
      applied_at: "2026-11-05T05:50:00+00:00",
      applied_by: "maker",
      params: { segments: { segment_1: { threshold_scale: 0.9 } } },
      changes: [],
      changes_summary: "빠른 구매형 인내심 임계치 1.00→0.90",
      base_comparison: "2차 vs 실측 최근 7일",
      error_before_pp: 7.8,
      error_after_pp: null,
      restored_from: null,
    },
  ],
};

/* 조정안이 있는 상태의 예시 (Figma K01) */
export function sampleProposal(
  projectId: number,
  baseRevision: number,
  options: { provisional?: boolean; strength?: "normal" | "gentle" } = {},
): CalibrationProposal {
  const gentle = options.strength === "gentle";
  const count = options.provisional ? 6 : 24;
  return {
    project_id: projectId,
    available: true,
    base_revision: baseRevision,
    days: 7,
    strength: options.strength ?? "normal",
    min_evidence: 10,
    provisional: Boolean(options.provisional),
    ...(options.provisional
      ? {
          message: `지금은 ${count}세션이라 임시값이에요. 10세션부터 실제 값으로 바뀌고 적용할 수 있어요.`,
        }
      : {}),
    basis: {
      report_id: "report-mock-1",
      run_sequence: 3,
      days: 7,
      device: "all",
      evidence: "measurement",
      count,
      mean_error: 4.5,
      gaps: [
        {
          task_id: "order",
          task_name: "첫 주문 완료",
          stage_id: "/cart",
          stage_name: "장바구니",
          error: -16,
          actual: 44,
          low: 55,
          high: 65,
        },
      ],
    },
    items: [
      {
        key: "*.weight.navigation",
        segment_id: "*",
        segment_name: "전체",
        kind: "weight",
        cause: "navigation",
        label: "마찰 가중치 · 탐색 실패",
        current: 1,
        proposed: gentle ? 1.05 : 1.15,
        reason: "첫 주문 완료 · 장바구니 화면에서 가장 많이 겪은 마찰이 탐색 실패이에요",
      },
      {
        key: "segment_1.threshold",
        segment_id: "segment_1",
        segment_name: "빠른 구매형",
        kind: "threshold",
        cause: null,
        label: "인내심 임계치",
        current: 1,
        proposed: gentle ? 0.95 : 0.85,
        reason: "첫 주문 완료 · 장바구니: 실측 이탈이 예측보다 커요 (-16.0%p)",
      },
    ],
    after_error: null,
    after_note: "보정 후 오차는 다음 사전 테스트가 끝난 뒤 실제 결과로 보여 줘요.",
    unchanged_segments: [{ segment_id: "segment_2", segment_name: "꼼꼼한 비교형" }],
  };
}
