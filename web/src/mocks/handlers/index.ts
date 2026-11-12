import { http, HttpResponse } from "msw";

import { idlePersonaRun } from "../fixtures/personas";

/*
  BE 없이 화면을 개발하기 위한 mock 핸들러. (`npm run dev:mock`)

  - 개발 API(/api/personas 등)는 BE 를 띄우면 실제로 동작하므로 최소한만 둡니다.
  - 제품 API(/api/v1/*)는 아직 미구현입니다. API_SPEC.md 8절 형태 그대로 여기에 추가하고,
    BE 가 구현하면 해당 핸들러만 지웁니다.
  - 도메인이 늘면 handlers/persona.ts 처럼 파일을 나누고 이 배열에 합칩니다.
*/
export const handlers = [http.get("*/api/personas", () => HttpResponse.json(idlePersonaRun))];
