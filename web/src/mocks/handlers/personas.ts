import { http, HttpResponse } from "msw";

import {
  confirm,
  discover,
  explain,
  human,
  MockApiError,
  report,
  reportMarkdown,
  reports,
  session,
  snapshot,
} from "../personaMock";

/* 개발 API 오류 형태 { error: string } */
function errorResponse(error: unknown) {
  if (error instanceof MockApiError) {
    return HttpResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof SyntaxError) {
    return HttpResponse.json({ error: "요청 형식을 확인해주세요." }, { status: 400 });
  }
  throw error;
}

/*
  JSON 응답. 본문 JSON 이 깨진 경우도 BE 처럼 400 으로 답합니다 (MSW 기본 500 대신).
*/
async function handle<T>(run: () => T | Promise<T>, status = 200) {
  try {
    return HttpResponse.json((await run()) as object, { status });
  } catch (error) {
    return errorResponse(error);
  }
}

/* JSON 이 아닌 응답(Markdown·PDF). 오류는 같은 { error } 형태로 답합니다 */
function handleRaw(run: () => Response) {
  try {
    return run();
  } catch (error) {
    return errorResponse(error);
  }
}

const runIdOf = (request: Request) => new URL(request.url).searchParams.get("run_id");

/* 화면 확인용 빈 PDF (실제 내용 없음) */
const MOCK_PDF = new TextEncoder().encode("%PDF-1.4\n% mock report\n%%EOF\n");

export const personaHandlers = [
  http.get("*/api/personas", () => handle(snapshot)),
  http.post("*/api/personas/discover", ({ request }) =>
    handle(async () => discover(await request.json())),
  ),
  http.post("*/api/personas/confirm", ({ request }) =>
    handle(async () => confirm(await request.json()), 202),
  ),
  http.get("*/api/personas/reports", () => handle(() => ({ reports: reports() }))),
  /* 임시: 세션 상세(P15·P16) 단건 조회. BE 명세가 나오면 경로·모양을 맞춥니다 */
  http.get("*/api/personas/session", ({ request }) => {
    const params = new URL(request.url).searchParams;
    return handle(() => session(params.get("run_id"), params.get("session_id")));
  }),
  http.post("*/api/personas/explain", ({ request }) =>
    handle(async () => explain(await request.json())),
  ),
  http.post("*/api/personas/human", ({ request }) =>
    handle(async () => human(await request.json())),
  ),
  http.get("*/api/personas/report", ({ request }) => handle(() => report(runIdOf(request)))),
  http.get("*/api/personas/report.md", ({ request }) =>
    handleRaw(() => HttpResponse.text(reportMarkdown(runIdOf(request)))),
  ),
  http.get("*/api/personas/report.pdf", ({ request }) =>
    handleRaw(() => {
      const runId = report(runIdOf(request)).run_id;
      return new HttpResponse(MOCK_PDF, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="dropspot-report-${runId}.pdf"`,
        },
      });
    }),
  ),
  /* mock 실행은 화면을 캡처하지 않아 모든 근거 이미지가 없습니다 */
  http.get("*/api/artifacts/:artifactId", () =>
    HttpResponse.json({ error: "화면 근거를 찾을 수 없습니다." }, { status: 404 }),
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
  /* 저장된 실행 없음 → E18 */
  reportNotFound: http.get("*/api/personas/report", () =>
    HttpResponse.json({ error: "저장된 실행을 찾을 수 없습니다." }, { status: 404 }),
  ),
  /* 리포트를 불러오지 못함 → E20 */
  reportNetworkError: http.get("*/api/personas/report", () => HttpResponse.error()),
  /* 다른 PDF 를 만드는 중 → 버튼 복구·재시도 안내 */
  pdfBusy: http.get("*/api/personas/report.pdf", () =>
    HttpResponse.json(
      { error: "PDF를 만드는 중입니다. 잠시 뒤 다시 시도해주세요." },
      { status: 429 },
    ),
  ),
  /* PDF 생성 실패 → E19 */
  pdfFailed: http.get("*/api/personas/report.pdf", () =>
    HttpResponse.json({ error: "PDF를 만들지 못했습니다." }, { status: 503 }),
  ),
};
