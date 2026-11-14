/*
  보정 API 타입 — BE docs/API_SPEC.md 8절 제품 API(미구현) 기준.
  명세에는 경로와 응답 핵심만 있어 모양은 임시입니다. 명세가 나오면 이 파일부터 고칩니다.
*/

/* K03b 보정 이력 한 줄 — GET /api/v1/projects/{id}/calibrations ("변경 전후·적용자·적용시각") */
export type CalibrationRecord = {
  id: string;
  applied_at: string;
  /* 변경 값 요약 (예: "빠른 구매형 인내심 75→70 · 입력 부담 마찰 ...") */
  changes: string;
  /* 기준 비교 (예: "2차 vs 실측 최근 7일"). 첫 기본 모형이면 null */
  base_comparison: string | null;
  /* 평균 오차 변화 (%p). 첫 기본 모형이면 null */
  error_before_pp: number | null;
  error_after_pp: number | null;
};

/* 목록 응답 공통 형태 (명세 8절 "목록 {items,next_cursor}") */
export type CalibrationList = { items: CalibrationRecord[]; next_cursor: string | null };
