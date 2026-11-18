/*
  ─── 임시: 실측 분석(R01~R11) 하드코딩 목데이터 ───
  실측 분석 API 명세가 아직 없어 Figma 화면 값을 그대로 옮겼습니다. 실제 수집값이 아닙니다.
  API 명세가 나오면 이 파일을 지우고 apis/·hooks/ 로 옮깁니다.
*/

export type ConnectionStatus = "unconnected" | "collecting" | "comparable";

/* 프로젝트별 연결 상태 (제품 API 프로젝트 id) — 샘플 반찬로드(1): 비교 가능(R06), 그 밖: 미연결(E03). 연결 흐름을 마치면 수집 중(E09) */
export const PROJECT_CONNECTION: Record<string, ConnectionStatus> = {
  "1": "comparable",
};

/* R01 모으는 것 · 모으지 않는 것 — BE measurements/e.js 가 실제로 보내는 값과 맞춥니다 */
export const COLLECT_ITEMS = [
  "화면 경로 (쿼리 제외 · 이메일·긴 번호는 가림)",
  "익명 세션 id (탭마다 새로 만듦)",
  "받은 시각",
];
export const NOT_COLLECT_ITEMS = [
  "이름 · 이메일 · 전화번호 등 개인정보",
  "입력한 값 · 쿠키 · 화면 글자",
  "에이전트(사전 테스트) 등 자동화 브라우저 방문",
];

/* R04 설치 실패 점검 항목 */
export const INSTALL_CHECKS = [
  "코드가 모든 페이지의 <head> 안에 있나요?",
  "배포가 끝났나요? 캐시를 지운 뒤 다시 열어보세요",
  "광고 차단 확장 프로그램이 막고 있지 않나요?",
];

export const FUNNEL_STAGES = ["랜딩", "탐색", "상세", "장바구니", "가입", "결제 정보", "완료"];

/* R05 이벤트 단계 매핑 — 수집된 단계 ID → 사전 테스트 퍼널 단계 */
export type MappingRow = {
  eventId: string;
  /* FUNNEL_STAGES 의 위치. null 이면 매핑 안 함 */
  stage: number | null;
  events: number;
  suggestion: "일치" | "이름 유사" | "후보 없음";
};

export const MAPPING_ROWS: MappingRow[] = [
  { eventId: "step_landing", stage: 0, events: 1240, suggestion: "일치" },
  { eventId: "step_browse", stage: 1, events: 1104, suggestion: "일치" },
  { eventId: "step_detail", stage: 2, events: 930, suggestion: "일치" },
  { eventId: "step_cart", stage: 3, events: 546, suggestion: "일치" },
  { eventId: "step_signup", stage: 4, events: 372, suggestion: "일치" },
  { eventId: "step_payment_info", stage: 5, events: 322, suggestion: "이름 유사" },
  { eventId: "step_done", stage: 6, events: 298, suggestion: "일치" },
  { eventId: "step_coupon", stage: null, events: 88, suggestion: "후보 없음" },
];

export type Period = "7" | "14" | "30";
export type Device = "all" | "mobile" | "desktop";

/* R06·R07 단계별 세션 수 (최근 7일). 14·30일은 같은 비율로 늘린 예시입니다 */
const FUNNEL_7D: Record<Device, number[]> = {
  all: [1240, 1104, 930, 546, 372, 322, 298],
  mobile: [860, 757, 619, 335, 224, 189, 172],
  desktop: [380, 347, 311, 211, 148, 133, 126],
};
const PERIOD_SCALE: Record<Period, number> = { "7": 1, "14": 2.1, "30": 4.4 };
export const PERIOD_RANGE: Record<Period, string> = {
  "7": "11월 1일 ~ 11월 7일",
  "14": "10월 25일 ~ 11월 7일",
  "30": "10월 9일 ~ 11월 7일",
};

export function funnelCounts(device: Device, period: Period) {
  return FUNNEL_7D[device].map((count) => Math.round(count * PERIOD_SCALE[period]));
}

/* E09 수집 중 (스튜디오 예약) — 단계마다 표본 100 세션이 모여야 비교에 씁니다 */
export const COLLECTING_COUNTS = [214, 181, 140, 52, 31, 24, 19];
export const MIN_SAMPLE = 100;

/* R08 예측 vs 실측 — 과업별 단계 비교 (예측 범위 %, 실측 %) */
export type CompareRow = { stage: string; predicted: [number, number]; actual: number };
export type CompareTask = {
  id: string;
  name: string;
  rows: CompareRow[];
  maxDrop: { matched: boolean; predicted: string; actual: string };
};

export const COMPARE_TASKS: CompareTask[] = [
  {
    id: "order",
    name: "첫 주문 완료",
    rows: [
      { stage: "탐색", predicted: [85, 95], actual: 89 },
      { stage: "상세", predicted: [70, 80], actual: 75 },
      { stage: "장바구니", predicted: [55, 65], actual: 44 },
      { stage: "가입", predicted: [30, 40], actual: 30 },
      { stage: "결제 정보", predicted: [25, 35], actual: 26 },
      { stage: "완료", predicted: [20, 30], actual: 24 },
    ],
    maxDrop: { matched: false, predicted: "장바구니→가입", actual: "상세→장바구니" },
  },
  {
    id: "coupon",
    name: "쿠폰으로 주문",
    rows: [
      { stage: "혜택", predicted: [80, 90], actual: 86 },
      { stage: "쿠폰", predicted: [60, 72], actual: 66 },
      { stage: "장바구니", predicted: [45, 55], actual: 49 },
      { stage: "결제 정보", predicted: [35, 45], actual: 38 },
      { stage: "완료", predicted: [30, 40], actual: 33 },
    ],
    maxDrop: { matched: true, predicted: "쿠폰→장바구니", actual: "쿠폰→장바구니" },
  },
];

/* 오차 = 실측 − 예측 범위 중앙값 (%p) */
export function compareError(row: CompareRow) {
  return row.actual - (row.predicted[0] + row.predicted[1]) / 2;
}
export function isGap(row: CompareRow) {
  return row.actual < row.predicted[0] || row.actual > row.predicted[1];
}

/* R09~R11 원인 재현 */
export const REPRODUCE_SEGMENTS = [
  { id: "quick", name: "빠른 구매형", count: 5 },
  { id: "compare", name: "꼼꼼한 비교형", count: 5 },
  { id: "price", name: "가격 민감형", count: 5 },
  { id: "cautious", name: "신중한 첫 방문형", count: 5 },
];

export type ReproduceStatus = "queued" | "running" | "success" | "dropout";

/* R10 재현 세션 20개가 끝나는 결과 (P 코드 순서) */
export const REPRODUCE_OUTCOMES: Exclude<ReproduceStatus, "queued" | "running">[] = [
  "dropout",
  "success",
  "success",
  "dropout",
  "success",
  "success",
  "dropout",
  "dropout",
  "success",
  "success",
  "dropout",
  "dropout",
  "success",
  "success",
  "success",
  "dropout",
  "success",
  "success",
  "dropout",
  "success",
];

export type Hypothesis = {
  rank: number;
  title: string;
  range: string;
  summary: string;
  quotes: { text: string; code: string }[];
};

export const HYPOTHESES: Hypothesis[] = [
  {
    rank: 1,
    title: "탐색 실패",
    range: "20명 중 7~9명",
    summary: "담기 버튼이 긴 설명 아래에 있어 찾지 못하고 떠나요",
    quotes: [
      { text: "담기 버튼이 어디 있죠? 설명만 계속 나와요.", code: "P-012" },
      { text: "스크롤을 한참 내려야 하네요. 다른 데서 살게요.", code: "P-004" },
    ],
  },
  {
    rank: 2,
    title: "비용 충격",
    range: "20명 중 3~4명",
    summary: "상품 상세에서 배송비를 몰라 망설여요.",
    quotes: [{ text: "배송비가 얼마인지 안 보여서 일단 나갈게요.", code: "P-011" }],
  },
];
