import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

import { handlers } from "./handlers";

export const TEST_CSRF_TOKEN = "test-csrf-token";

/*
  CSRF 토큰 발급은 테스트에서만 흉내 냅니다.
  브라우저 mock(browser.ts)에 넣으면 Vercel 배포본이 가짜 토큰을 받아,
  실서버로 가는 POST 가 쿠키와 토큰이 달라 403 이 됩니다. (apis/axiosInstance.ts)
*/
const testOnlyHandlers = [
  http.get("*/api/v1/auth/csrf", () => HttpResponse.json({ csrf_token: TEST_CSRF_TOKEN })),
];

/* 테스트(Vitest)용 mock 서버. 브라우저 mock(browser.ts)과 같은 핸들러를 씁니다 */
export const server = setupServer(...handlers, ...testOnlyHandlers);
