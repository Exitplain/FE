import { setupServer } from "msw/node";

import { handlers } from "./handlers";

/* 테스트(Vitest)용 mock 서버. 브라우저 mock(browser.ts)과 같은 핸들러를 씁니다 */
export const server = setupServer(...handlers);
