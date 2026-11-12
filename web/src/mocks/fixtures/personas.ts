import type {
  AgeOption,
  DiscoverFeature,
  DiscoverTask,
  PersonaProfile,
  PersonaRun,
  PersonaTask,
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

/* 기본으로 선택해 두는 과업 (BE DEFAULT_TASK_IDS) */
export const SUGGESTED_TASK_IDS = ["order", "delivery", "coupon", "subscription"];

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
