import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";

import { server } from "@/mocks/node";

/*
  핸들러가 없는 요청은 실패시킵니다.
  테스트가 모르는 사이 실서버나 빈 응답에 기대지 않게 하려는 것입니다.
  테스트마다 다른 응답이 필요하면 server.use(...) 로 덮어쓰고, 끝나면 원래대로 돌립니다.
*/
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));

// 화면을 먼저 내려야 진행 중이던 요청이 기본 핸들러 응답을 받지 않습니다
afterEach(() => {
  cleanup();
  server.resetHandlers();
});

afterAll(() => server.close());
