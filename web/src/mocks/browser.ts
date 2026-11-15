import { setupWorker } from "msw/browser";

import { handlers } from "./handlers";

const worker = setupWorker(...handlers);

/*
  일부러 mock 하지 않고 실서버로 보내는 요청. 경고 대상에서 뺍니다.
  - CSRF 토큰: 가짜 토큰을 주면 실서버 POST 가 403 이 됩니다. (apis/axiosInstance.ts, mocks/node.ts)
*/
const PASSTHROUGH_PATHS = new Set(["/api/v1/auth/csrf"]);

export async function startMockWorker() {
  await worker.start({
    /*
      /api 요청이 mock 을 만나지 못하면 실서버로 나갑니다.
      mock 모드에서 이런 요청은 대부분 핸들러 누락이나 경로 불일치이므로 알립니다.
    */
    onUnhandledRequest(request, print) {
      const { pathname } = new URL(request.url);
      if (pathname.startsWith("/api/") && !PASSTHROUGH_PATHS.has(pathname)) {
        console.warn(`[mocks] 처리되지 않은 API 요청: ${request.method} ${request.url}`);
        print.warning();
      }
    },
    quiet: true,
  });

  console.info("%c[mocks] API mock 모드로 실행 중입니다.", "font-weight:bold");
}
