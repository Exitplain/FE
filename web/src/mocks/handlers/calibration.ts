import { http, HttpResponse } from "msw";

import { CALIBRATIONS } from "../fixtures/calibration";

/* 제품 API(/api/v1) 보정 — BE 가 구현하면 이 핸들러만 지웁니다 */
export const calibrationHandlers = [
  http.get("*/api/v1/projects/:projectId/calibrations", ({ params }) =>
    HttpResponse.json({
      items: structuredClone(CALIBRATIONS[String(params.projectId)] ?? []),
      next_cursor: null,
    }),
  ),
];
