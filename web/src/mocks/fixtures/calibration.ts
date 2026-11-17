import type { CalibrationRecord } from "@/types/calibration.type";

/*
  보정 이력 예시 (Figma K03b). 실측 기반 보정값이라 화면에서는 예시 데이터입니다.
  반찬로드만 이력이 있고, 다른 프로젝트는 보정 전(빈 목록)입니다.
  가장 최근 적용이 11월 5일이라 P05b·P05c 의 "보정 11월 5일 적용"과 맞습니다.
*/
export const CALIBRATIONS: Record<string, CalibrationRecord[]> = {
  "1": [
    {
      id: "cal-banchan-2",
      applied_at: "2026-11-05T05:50:00+00:00",
      changes: "빠른 구매형 인내심 75→70 · 입력 부담 마찰 0.9→1.0 · 비용 변화 0.8→1.0",
      base_comparison: "2차 vs 실측 최근 7일",
      error_before_pp: 7.8,
      error_after_pp: 4.5,
    },
    {
      id: "cal-banchan-1",
      applied_at: "2026-11-01T01:00:00+00:00",
      changes: "첫 보정 전 (기본 모형)",
      base_comparison: null,
      error_before_pp: null,
      error_after_pp: null,
    },
  ],
};
