import { setupWorker } from "msw/browser";

import { handlers } from "./handlers";

const worker = setupWorker(...handlers);

export async function startMockWorker() {
  await worker.start({
    /*
      /api 요청이 mock 을 만나지 못하면 실서버로 나갑니다.
      mock 모드에서 이런 요청은 대부분 핸들러 누락이나 경로 불일치이므로 알립니다.
    */
    onUnhandledRequest(request, print) {
      if (new URL(request.url).pathname.startsWith("/api/")) {
        console.warn(`[mocks] 처리되지 않은 API 요청: ${request.method} ${request.url}`);
        print.warning();
      }
    },
    quiet: true,
  });

  console.info("%c[mocks] API mock 모드로 실행 중입니다.", "font-weight:bold");
}
