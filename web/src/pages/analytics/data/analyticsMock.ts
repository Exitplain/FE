/*
  ─── 실측 분석 화면 문구 · 원인 재현(R09~R11) 임시 목데이터 ───
  설치·매핑·퍼널·비교는 실제 API(BE measurements)를 씁니다.
  원인 재현은 API 가 없어 Figma 값을 그대로 둡니다 (실제 재현 결과가 아닙니다).
*/

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
