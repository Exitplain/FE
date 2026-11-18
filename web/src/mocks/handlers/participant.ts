import { http, HttpResponse } from "msw";

import type { ParticipantLink, PublicParticipantPage } from "@/types/calibration.type";

/*
  참여자 응답 링크 mock (BE calibrations PART-01~05). 링크·응답을 메모리에 둡니다.
  공개 페이지는 토큰으로 찾고, 같은 client_id 는 409, 상한을 넘으면 410 (BE 와 같음).
*/
type Stored = ParticipantLink & { projectId: string; clients: Set<string> };
let links: Stored[] = [];
let seq = 0;

export function resetParticipantMock() {
  links = [];
  seq = 0;
}

const TASK_NAMES: Record<string, string> = { order: "첫 주문 완료", coupon: "쿠폰으로 주문" };

const PAGE: Omit<PublicParticipantPage, "expires_at"> = {
  project_name: "반찬로드",
  site_url: "https://banchanroad-demo.vercel.app/?variant=problem&case=all",
  task_name: "첫 주문 완료",
  screens: [
    { id: "/", name: "첫 화면", screenshot_url: null },
    { id: "/cart", name: "장바구니", screenshot_url: null },
    { id: "/signup", name: "회원가입", screenshot_url: null },
  ],
  reasons: [
    { key: "navigation", label: "뭘 해야 할지 헷갈렸어요" },
    { key: "input_burden", label: "입력할 게 너무 많았어요" },
    { key: "trust", label: "개인정보를 먼저 물어봐서 불안했어요" },
    { key: "cost", label: "생각보다 비싸거나 갑자기 돈이 붙었어요" },
    { key: "value", label: "가격이나 내용이 잘 안 보였어요" },
    { key: "technical", label: "느리거나 오류가 났어요" },
    { key: "accessibility", label: "버튼이 작거나 누르기 어려웠어요" },
    { key: "unknown", label: "잘 모르겠어요" },
  ],
};

const gone = (code: string, message: string) =>
  HttpResponse.json(
    { error: { code, message, fields: {} }, request_id: "req_mock" },
    { status: 410 },
  );

function publicOf(link: Stored): ParticipantLink {
  const rest: ParticipantLink = {
    id: link.id,
    token: link.token,
    path: link.path,
    task_id: link.task_id,
    task_name: link.task_name,
    purpose: link.purpose,
    state: link.state,
    responses: link.responses,
    max_responses: link.max_responses,
    expires_at: link.expires_at,
    created_at: link.created_at,
  };
  return {
    ...rest,
    state: link.state === "open" && link.responses >= link.max_responses ? "full" : link.state,
  };
}

export const participantHandlers = [
  http.get("*/api/v1/projects/:projectId/participant-links", ({ params }) =>
    HttpResponse.json({
      items: links.filter((l) => l.projectId === String(params.projectId)).map(publicOf),
    }),
  ),
  http.post("*/api/v1/projects/:projectId/participant-links", async ({ params, request }) => {
    const body = (await request.json()) as { task_id: string; purpose: ParticipantLink["purpose"] };
    seq += 1;
    const token = `tok-${seq}`;
    const link: Stored = {
      id: seq,
      token,
      path: `/r/${token}`,
      task_id: body.task_id,
      task_name: TASK_NAMES[body.task_id] ?? body.task_id,
      purpose: body.purpose,
      state: "open",
      responses: 0,
      max_responses: 50,
      expires_at: new Date(Date.now() + 14 * 86400000).toISOString(),
      created_at: new Date().toISOString(),
      projectId: String(params.projectId),
      clients: new Set(),
    };
    links = [link, ...links];
    return HttpResponse.json(publicOf(link), { status: 201 });
  }),
  http.post("*/api/v1/participant-links/:id/disable", ({ params }) => {
    const link = links.find((l) => l.id === Number(params.id));
    if (!link) return HttpResponse.json({}, { status: 404 });
    link.state = "disabled";
    return HttpResponse.json(publicOf(link));
  }),
  http.get("*/api/v1/participant-links/:token", ({ params }) => {
    const link = links.find((l) => l.token === params.token);
    if (!link) return HttpResponse.json({}, { status: 404 });
    if (link.state === "disabled") return gone("LINK_DISABLED", "이 링크는 닫혔어요.");
    return HttpResponse.json({ ...PAGE, task_name: link.task_name, expires_at: link.expires_at });
  }),
  http.post("*/api/v1/participant-links/:token/responses", async ({ params, request }) => {
    const link = links.find((l) => l.token === params.token);
    if (!link) return HttpResponse.json({}, { status: 404 });
    if (link.state === "disabled") return gone("LINK_DISABLED", "이 링크는 닫혔어요.");
    if (link.responses >= link.max_responses) {
      return gone("LINK_FULL", "응답이 모두 모였어요. 참여해 주셔서 감사해요.");
    }
    const body = (await request.json()) as { client_id: string };
    if (link.clients.has(body.client_id)) {
      return HttpResponse.json(
        {
          error: {
            code: "ALREADY_SUBMITTED",
            message: "이미 답해 주셨어요. 감사해요!",
            fields: {},
          },
          request_id: "req_mock",
        },
        { status: 409 },
      );
    }
    link.clients.add(body.client_id);
    link.responses += 1;
    return HttpResponse.json(
      { participant_code: `R-${String(link.responses).padStart(3, "0")}` },
      { status: 201 },
    );
  }),
];

/* 테스트에서 공개 페이지를 바로 열 수 있게 링크를 하나 만들어 둡니다 */
export function seedParticipantLink(projectId: string, max = 50) {
  seq += 1;
  const token = `tok-${seq}`;
  links.push({
    id: seq,
    token,
    path: `/r/${token}`,
    task_id: "order",
    task_name: "첫 주문 완료",
    purpose: "calibration",
    state: "open",
    responses: 0,
    max_responses: max,
    expires_at: new Date(Date.now() + 86400000).toISOString(),
    created_at: new Date().toISOString(),
    projectId,
    clients: new Set(),
  });
  return token;
}
