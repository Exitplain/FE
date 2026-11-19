export const ONBOARDING_STEPS = {
  intro: {
    number: 1,
    title: "내 사이트로 첫 테스트를 준비해 볼까요?",
    description:
      "사이드바의 ‘새 프로젝트’를 눌러 시작하세요. 이미 등록했다면 해당 프로젝트를 선택해도 좋아요.",
  },
  create: {
    number: 1,
    title: "프로젝트 이름을 정하세요",
    description:
      "이름을 입력하고 ‘만들기’를 누르세요. 사이트 URL은 프로젝트를 만든 뒤 첫 테스트에서 입력해요.",
  },
  test: {
    number: 2,
    title: "이 프로젝트의 첫 테스트를 준비하세요",
    description:
      "‘새 테스트 시작하기’를 누르세요. 기존 테스트가 있더라도 새 테스트 준비를 시작할 수 있어요.",
  },
  site: {
    number: 3,
    title: "사이트를 확인하세요",
    description:
      "사이트 정보와 접근 방식을 확인한 뒤 탐색을 진행하세요. 완료되면 화면의 ‘다음’을 누르세요.",
  },
  task: {
    number: 4,
    title: "고객이 달성할 목표를 고르세요",
    description:
      "테스트할 과업과 타겟 고객을 정하세요. 필수 항목을 입력하고 화면의 ‘다음’을 누르면 설정이 저장돼요.",
  },
  persona: {
    number: 5,
    title: "AI 고객 구성을 확인하세요",
    description:
      "유형별 인원·반복 횟수·기기를 확인하세요. 인원 제한에 맞게 조정한 뒤 화면의 ‘다음’을 누르세요.",
  },
  confirm: {
    number: 6,
    title: "입력한 설정을 마지막으로 확인하세요",
    description:
      "사이트·과업·고객 구성을 확인하세요. 설정이 맞으면 ‘페르소나 생성’을 눌러 실제 AI 고객을 준비하세요.",
  },
  ready: {
    number: 7,
    title: "생성된 페르소나를 확인하면 준비 끝이에요",
    description:
      "고객별 성향을 확인하세요. 아래 버튼은 안내만 끝내요. 실제 테스트는 원할 때 화면의 ‘실행 시작’을 직접 누르세요.",
  },
} as const;
export type OnboardingStep = keyof typeof ONBOARDING_STEPS;
