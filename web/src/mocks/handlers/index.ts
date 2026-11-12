import { personaHandlers } from "./personas";

/*
  BE 없이 화면을 개발하기 위한 mock 핸들러. (`npm run dev:mock`, 테스트)

  - 개발 API(/api/personas 등)는 BE 계약과 같은 형태로 흉내 냅니다 (mocks/personaMock.ts).
  - 제품 API(/api/v1/*)는 아직 미구현입니다. API_SPEC.md 8절 형태 그대로 추가하고,
    BE 가 구현하면 해당 핸들러만 지웁니다.
  - 도메인마다 handlers/<도메인>.ts 로 나누고 이 배열에 합칩니다.
*/
export const handlers = [...personaHandlers];
