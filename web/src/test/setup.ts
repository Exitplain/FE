import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, vi } from "vitest";

import { resetCsrfToken } from "@/apis/axiosInstance";
import { resetProjectMock } from "@/mocks/handlers/projects";
import { resetReportMock } from "@/mocks/handlers/reports";
import { resetSourceMock } from "@/mocks/handlers/sources";
import { server } from "@/mocks/node";
import { resetPersonaMock } from "@/mocks/personaMock";
import { resetPlanMock } from "@/mocks/planMock";
import { resetRunV1Mock } from "@/mocks/runV1Mock";
import { useRetestStore } from "@/stores/useRetestStore";
import { useSiteCheckStore } from "@/stores/useSiteCheckStore";

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
  jsdom 의 Blob 에는 stream() 이 없습니다. Node 22(CI) 의 fetch(undici)는 Blob 응답 본문을 만들 때
  stream() 을 불러, PDF 내려받기(responseType: "blob") 테스트가 "object.stream is not a function" 으로 멈춥니다.
  arrayBuffer() 로 읽어 한 번에 내보내는 스트림으로 채웁니다. (Node 26 은 다른 경로라 영향 없음)
*/
if (typeof Blob !== "undefined" && typeof Blob.prototype.stream !== "function") {
  Blob.prototype.stream = function stream(this: Blob) {
    const read = () => this.arrayBuffer();
    return new ReadableStream<Uint8Array>({
      async start(controller) {
        controller.enqueue(new Uint8Array(await read()));
        controller.close();
      },
    });
  } as Blob["stream"];
}

/* jsdom 의 window.scrollTo 는 "Not implemented" 를 출력만 하므로 조용한 빈 함수로 바꿉니다 */
vi.stubGlobal("scrollTo", () => {});

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
  // 받아 둔 CSRF 토큰이 다음 테스트로 넘어가지 않게 비웁니다
  resetCsrfToken();
  // 페르소나 mock 은 실행 상태를 메모리에 들고 있어 테스트마다 처음으로 돌립니다
  resetPersonaMock();
  // 만든 프로젝트(제품 API mock)도 테스트마다 비웁니다
  resetProjectMock();
  resetReportMock();
  resetPlanMock();
  resetSourceMock();
  resetRunV1Mock();
  // 재테스트 기록(sessionStorage)도 테스트끼리 섞이지 않게 비웁니다
  useRetestStore.setState({ byRunId: {} });
  // 앞 테스트의 사이트 확인 작업이 다음 테스트의 위저드로 이어지지 않게 비웁니다
  useSiteCheckStore.setState({ jobs: {} });
  sessionStorage.clear();
});

afterAll(() => server.close());
