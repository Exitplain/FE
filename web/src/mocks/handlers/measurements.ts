import { http, HttpResponse } from "msw";

import type { MeasurementStatus } from "@/types/measurement.type";

/*
  실측 수집 mock (BE measurements). 프로젝트마다 키 발급·수신 여부를 메모리에 둡니다.
  - 브라우저 mock 은 키를 발급하고 설치 확인을 두 번째로 조회할 때 첫 수집이 온 것처럼 바꿉니다.
  - 테스트는 setMeasurementMock 으로 배포 주소 없음·수신 여부를 직접 정합니다.
*/
type Stored = { key: string | null; received: boolean; deployed: boolean; checks: number };
const store = new Map<number, Stored>();
const AUTO_RECEIVE = import.meta.env.MODE !== "test";
const ORIGIN = "https://shop.example.com";

export function resetMeasurementMock() {
  store.clear();
}

export function setMeasurementMock(projectId: number, patch: Partial<Stored>) {
  store.set(projectId, { ...stateOf(projectId), ...patch });
}

function stateOf(projectId: number): Stored {
  return store.get(projectId) ?? { key: null, received: false, deployed: true, checks: 0 };
}

function statusOf(projectId: number, s: Stored): MeasurementStatus {
  return {
    project_id: projectId,
    available: s.deployed,
    ...(s.deployed
      ? {}
      : {
          reason: "NOT_DEPLOYED" as const,
          message: "실측 분석은 실제 방문자가 오는 배포 주소가 있어야 해요.",
        }),
    origins: [ORIGIN],
    key: s.key,
    snippet: s.key
      ? `<script src="https://exitplain.store/api/v1/e.js" data-project="${s.key}" async></script>`
      : null,
    installed: Boolean(s.key && s.received),
    last_received_at: s.key && s.received ? new Date().toISOString() : null,
    last_origin: s.key && s.received ? ORIGIN : null,
    sessions_24h: s.received ? 3 : 0,
    events_24h: s.received ? 7 : 0,
  };
}

export const measurementHandlers = [
  http.get("*/api/v1/projects/:projectId/measurement", ({ params }) => {
    const projectId = Number(params.projectId);
    const s = stateOf(projectId);
    if (s.key && AUTO_RECEIVE && ++s.checks >= 2) s.received = true;
    store.set(projectId, s);
    return HttpResponse.json(statusOf(projectId, s));
  }),
  http.post("*/api/v1/projects/:projectId/measurement", ({ params }) => {
    const projectId = Number(params.projectId);
    const s = stateOf(projectId);
    if (!s.deployed) {
      return HttpResponse.json(
        {
          error: {
            code: "NOT_DEPLOYED",
            message: "실측 분석은 실제 방문자가 오는 배포 주소가 있어야 해요.",
            fields: {},
          },
          request_id: "req_mock",
        },
        { status: 409 },
      );
    }
    s.key ??= `ep_${projectId.toString(16).padStart(12, "0")}`;
    store.set(projectId, s);
    return HttpResponse.json(statusOf(projectId, s));
  }),
];
