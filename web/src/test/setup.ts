import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, vi } from "vitest";

import { server } from "@/mocks/node";

/*
  jsdom 에는 ResizeObserver 가 없습니다. 사이드바(AppLayout)처럼 크기 변화를 지켜보는
  컴포넌트도 렌더링할 수 있게 아무 일도 하지 않는 구현으로 채웁니다. (레이아웃 계산은 테스트하지 않음)
  파일 시작 시 한 번만 넣으므로, vite.config 의 test.unstubGlobals 를 켜면 beforeEach 로 옮겨야 합니다.
*/
class NoopResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", NoopResizeObserver);

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
