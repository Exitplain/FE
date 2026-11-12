import { http, HttpResponse } from "msw";

import { confirm, discover, explain, MockApiError, reports, snapshot } from "../personaMock";

/*
  개발 API 오류 형태 { error: string } 로 돌려줍니다.
  본문 JSON 이 깨진 경우도 BE 처럼 400 으로 답합니다 (MSW 기본 500 대신).
*/
async function handle<T>(run: () => T | Promise<T>, status = 200) {
  try {
    return HttpResponse.json((await run()) as object, { status });
  } catch (error) {
    if (error instanceof MockApiError) {
      return HttpResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof SyntaxError) {
      return HttpResponse.json({ error: "요청 형식을 확인해주세요." }, { status: 400 });
    }
    throw error;
  }
}

export const personaHandlers = [
  http.get("*/api/personas", () => handle(snapshot)),
  http.post("*/api/personas/discover", ({ request }) =>
    handle(async () => discover(await request.json())),
  ),
  http.post("*/api/personas/confirm", ({ request }) =>
    handle(async () => confirm(await request.json()), 202),
  ),
  http.get("*/api/personas/reports", () => handle(() => ({ reports: reports() }))),
  http.post("*/api/personas/explain", ({ request }) =>
    handle(async () => explain(await request.json())),
  ),
];

/*
  오류·특수 상태 확인용 핸들러. 테스트에서 server.use(...) 로 덮어씁니다.
*/
export const personaErrorHandlers = {
  /* 사이트 탐색 실패 (Playwright 예외 등) → E08 */
  discoverUnavailable: http.post("*/api/personas/discover", () =>
    HttpResponse.json({ error: "화면 탐색을 완료하지 못했습니다 (mock)" }, { status: 503 }),
  ),
  /* 15분이 지나 계획이 만료됨 → 사이트 단계로 되돌림 */
  confirmExpired: http.post("*/api/personas/confirm", () =>
    HttpResponse.json({ error: "탐색 결과가 만료됐습니다. 다시 확인해주세요." }, { status: 400 }),
  ),
  /* 다른 실행이 진행 중 → 현재 실행 다시 조회 */
  confirmRunning: http.post("*/api/personas/confirm", () =>
    HttpResponse.json({ error: "이미 페르소나 점검이 실행 중입니다." }, { status: 409 }),
  ),
  /* 서버 연결 끊김 → status 0 */
  personasNetworkError: http.get("*/api/personas", () => HttpResponse.error()),
  /* 완료된 실행이 없음 → E02 */
  reportsEmpty: http.get("*/api/personas/reports", () => HttpResponse.json({ reports: [] })),
};
