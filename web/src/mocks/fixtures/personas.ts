import type {
  AgeOption,
  DiscoverFeature,
  DiscoverTask,
  PersonaProfile,
  PersonaRun,
  PersonaTask,
  Stage,
} from "@/types/persona.type";

/*
  BE 개발 API 의 고정 값을 그대로 옮긴 예시 데이터입니다. (BE agent/persona_dashboard.py PROFILES,
  agent/shop_tasks.py TASKS, agent/preflight.py FEATURES·AGE_LABELS)
  실제 실행 결과가 아닙니다. 화면에 실측값처럼 보이게 쓰지 않습니다.
*/

export const PROFILES: PersonaProfile[] = [
  {
    id: "quick",
    name: "빠른 구매",
    context: "입력 단계를 최소화하고 바로 주문하려는 방문자",
    max_required_fields: 2,
    width: 390,
    search_sensitivity: 1.6,
    cost_sensitivity: 0.5,
  },
  {
    id: "careful",
    name: "꼼꼼한 첫 방문",
    context: "주문 정보와 배송 안내를 확인하는 방문자",
    max_required_fields: 4,
    width: 1280,
    search_sensitivity: 1.0,
    cost_sensitivity: 2.0,
  },
  {
    id: "patient",
    name: "여유 있는 탐색",
    context: "입력 과정에 비교적 여유가 있는 방문자",
    max_required_fields: 6,
    width: 1440,
    search_sensitivity: 0.6,
    cost_sensitivity: 0.5,
  },
];

export const TASKS: PersonaTask[] = [
  {
    id: "order",
    name: "첫 주문",
    goal: "반찬 한 상을 골라 첫 모의 주문 완료",
    case: "signup",
    success_path: "/order/success",
  },
  {
    id: "delivery",
    name: "배송 지역 확인",
    goal: "서울 노원구의 배송 가능 여부 확인",
    case: "delivery",
    success_path: "/delivery/result",
  },
  {
    id: "coupon",
    name: "쿠폰으로 주문",
    goal: "첫 주문 쿠폰을 받고 적용해 모의 주문 완료",
    case: "coupon",
    success_path: "/order/success",
  },
  {
    id: "subscription",
    name: "다음 배송 건너뛰기",
    goal: "모의 구독에서 다음 배송 한 번 건너뛰기",
    case: "subscription",
    success_path: "/subscription/skipped",
  },
  {
    id: "cart",
    name: "장바구니 담기",
    goal: "반찬을 골라 장바구니에 담긴 내용 확인",
    case: "cta",
    success_path: "/cart",
  },
  {
    id: "benefit",
    name: "쿠폰 받기",
    goal: "첫 주문 할인 쿠폰 발급 완료",
    case: "coupon",
    success_path: "/coupon/success",
  },
];

/*
  기본으로 선택해 두는 과업. BE DEFAULT_TASK_IDS 는 4개지만 Figma P05 처럼 첫 주문·쿠폰으로 주문 2개로 둡니다.
  (배송 지역 확인은 mock 에서 항상 접속 실패라 기본에 넣으면 첫 실행부터 오류가 섞입니다)
*/
export const SUGGESTED_TASK_IDS = ["order", "coupon"];

/*
  ─── 임시: Figma 세그먼트 4종 (P07 페르소나 확인 값 그대로) ───
  mock 실행은 이 세그먼트로 에이전트를 만들고, 세그먼트 성향에 따라 이탈 단계·원인을 정합니다.
  dropout: 이 세그먼트가 주로 떠나는 단계와 원인, 시드마다 떠날 확률
*/
export type MockSegment = {
  id: string;
  name: string;
  context: string;
  traits: { patience: number; digital: number; price: number; trust: number };
  profile: Pick<
    PersonaProfile,
    "max_required_fields" | "width" | "search_sensitivity" | "cost_sensitivity"
  >;
  dropout: { stage: Stage; cause: "input_burden" | "navigation" | "cost"; chance: number };
};

export const SEGMENTS: MockSegment[] = [
  {
    id: "quick",
    name: "빠른 구매형",
    context: "입력 단계를 최소화하고 바로 주문하려는 방문자",
    traits: { patience: 22, digital: 80, price: 40, trust: 30 },
    profile: { max_required_fields: 2, width: 390, search_sensitivity: 1.6, cost_sensitivity: 0.5 },
    dropout: { stage: "signup", cause: "input_burden", chance: 0.6 },
  },
  {
    id: "compare",
    name: "꼼꼼한 비교형",
    context: "상품 정보와 후기를 비교하고 고르는 방문자",
    traits: { patience: 70, digital: 60, price: 55, trust: 75 },
    profile: {
      max_required_fields: 5,
      width: 1280,
      search_sensitivity: 1.2,
      cost_sensitivity: 1.0,
    },
    dropout: { stage: "product", cause: "navigation", chance: 0.3 },
  },
  {
    id: "price",
    name: "가격 민감형",
    context: "배송비와 할인을 끝까지 따지는 방문자",
    traits: { patience: 45, digital: 55, price: 90, trust: 50 },
    profile: { max_required_fields: 4, width: 390, search_sensitivity: 0.8, cost_sensitivity: 2.0 },
    dropout: { stage: "checkout", cause: "cost", chance: 0.45 },
  },
  {
    id: "cautious",
    name: "신중한 첫 방문형",
    context: "처음 와서 믿을 만한지 확인하며 천천히 보는 방문자",
    traits: { patience: 55, digital: 35, price: 60, trust: 85 },
    profile: { max_required_fields: 3, width: 390, search_sensitivity: 1.0, cost_sensitivity: 1.2 },
    dropout: { stage: "signup", cause: "input_burden", chance: 0.5 },
  },
];

/* 임시: 단계별 Think-aloud 발화 예시 (Figma P09 · P11). 실제 발화가 아닙니다 */
export const UTTERANCES: Partial<Record<Stage, string[]>> = {
  landing: ["이번 주 메뉴부터 볼게요.", "첫 화면이 깔끔하네요."],
  product: ["담기 버튼이 어디 있죠? 설명만 계속 나와요.", "이 반찬 구성이 괜찮아 보여요."],
  cart: ["장바구니에 잘 담겼네요.", "총액이 얼마인지 아직 모르겠어요."],
  signup: [
    "주문하려는데 가입부터 하라니… 입력할 칸이 8개나 돼요.",
    "주문 전에 가입부터 해야 하네요.",
  ],
  checkout: [
    "배송비가 여기서 처음 나오네요. 3,500원이면 다시 생각해봐야겠어요.",
    "결제 정보 화면이에요.",
  ],
  complete: ["주문이 끝났어요.", "생각보다 빨리 끝났네요."],
  benefits: ["첫 주문 혜택이 뭐가 있는지 볼게요."],
  coupon: ["쿠폰을 받았어요. 적용은 어디서 하죠?"],
  delivery: ["우리 동네도 배송되는지 확인할게요."],
  account: ["내 구독 정보로 들어가 볼게요."],
  subscription: ["다음 배송을 건너뛸 수 있는지 볼게요."],
};

/* 이탈할 때 마지막 발화 */
export const DROPOUT_UTTERANCE: Record<MockSegment["dropout"]["cause"], string> = {
  input_burden: "비회원 주문은 없나요? 여기서 그만할게요.",
  navigation: "원하는 걸 못 찾겠어요. 다른 데서 살게요.",
  cost: "배송비까지 내면 비싸네요. 그만할게요.",
};

export const TASK_FEATURE: Record<string, string> = {
  order: "shopping",
  cart: "shopping",
  delivery: "delivery",
  coupon: "coupon",
  benefit: "coupon",
  subscription: "subscription",
};

export const FEATURES: DiscoverFeature[] = [
  {
    id: "shopping",
    name: "상품 탐색·장바구니·주문",
    evidence: { label: "이번 주 식탁 만나기", path: "/product" },
    verification: "visible_entry_only",
  },
  {
    id: "delivery",
    name: "배송 가능 지역 조회",
    evidence: { label: "배송 가능 지역 확인", path: "/delivery" },
    verification: "visible_entry_only",
  },
  {
    id: "coupon",
    name: "첫 주문 쿠폰",
    evidence: { label: "첫 주문 혜택 받기", path: "/benefits" },
    verification: "visible_entry_only",
  },
  {
    id: "subscription",
    name: "구독 배송 일정 관리",
    evidence: { label: "내 구독 관리", path: "/account" },
    verification: "visible_entry_only",
  },
];

export const AGE_LABELS: Record<AgeOption, string> = {
  any: "전체 연령",
  teens: "10대",
  "20s": "20대",
  "30s": "30대",
  "40s": "40대",
  "50s": "50대",
  "60plus": "60대 이상",
};

export const DISCOVER_TASKS: DiscoverTask[] = TASKS.map((task) => ({
  ...task,
  feature_id: TASK_FEATURE[task.id],
  suggested: SUGGESTED_TASK_IDS.includes(task.id),
}));

/*
  실행이 한 번도 없을 때의 GET /api/personas.
  주의: 실제 BE 는 시작할 때 디스크에 저장된 가장 최근 완료 실행을 복원하므로,
  첫 조회부터 status 가 completed 일 수 있습니다. 화면은 두 경우를 모두 처리해야 합니다.
*/
export const idlePersonaRun: PersonaRun = {
  status: "idle",
  id: null,
  sessions: [],
  profiles: PROFILES,
  policy: "scripted_fixture",
  model_calls: 0,
  target: "반찬로드 모의 쇼핑몰",
  tasks: TASKS,
};
