import type { DropCause, Stage, Variant } from "@/types/persona.type";

/* BE 화면 단계 이름 (agent/frustration.py STAGES 경로 기준) — 실행 화면(P09·P11)·리포트(P12)·세션 상세(P15) */
export const STAGE_LABELS: Record<Stage, string> = {
  landing: "첫 화면",
  product: "상품",
  cart: "장바구니",
  signup: "가입",
  checkout: "결제 정보",
  complete: "완료 화면",
  delivery: "배송 지역",
  benefits: "혜택",
  coupon: "쿠폰",
  account: "내 정보",
  subscription: "구독",
  browse: "탐색",
  detail: "상세",
  payment: "결제 정보",
  other: "기타",
};

/* 이탈 원인 7종 + 모름·없음 (명세 5.2 cause). Figma P12 이탈 원인 분포·P21 원인 7종 이름 */
export const CAUSE_LABELS: Record<DropCause, string> = {
  input_burden: "입력 부담",
  navigation: "탐색 실패",
  cost: "비용 충격",
  value: "가치 불명확",
  trust: "신뢰 부족",
  technical: "기술 오류·지연",
  accessibility: "접근성 장벽",
  unknown: "원인 불명",
  none: "없음",
};

export const VARIANT_LABELS: Record<Variant, string> = { fixed: "개선 버전", problem: "문제 버전" };
