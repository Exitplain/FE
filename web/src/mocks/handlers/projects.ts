import { http, HttpResponse } from "msw";

import type { V1ProjectSummary } from "@/types/project.v1.type";

import { runList } from "../personaMock";

/*
  제품 API(/api/v1) 프로젝트·실행 목록.
  - 샘플 프로젝트: 실서버와 같은 반찬로드 하나 (id 1)
  - 실행 목록: 개발 API mock 의 실행으로 만듭니다 (personaMock.runList). 다른 프로젝트는 빈 목록입니다.
  BE 에 이미 구현돼 있지만, 다른 P 화면이 아직 개발 API 를 써서 mock 에서 같은 실행을 보도록 남겨 둡니다.
  P 화면이 모두 제품 API 로 옮겨지면 지웁니다.
*/
export const MOCK_SAMPLE_PROJECTS: V1ProjectSummary[] = [
  {
    id: 1,
    name: "반찬로드",
    entry_url: "https://banchanroad.example/",
    domain: "banchanroad.example",
    is_sample: true,
    archived_at: null,
    last_pretest: null,
    updated_at: "2026-11-14T14:07:20.325695+00:00",
  },
];

const DEFAULT_LIMIT = 20;

/* 커서는 다음 페이지가 시작할 위치입니다 (BE 는 불투명 문자열) */
function paginate<T>(items: T[], url: URL) {
  const limit = Number(url.searchParams.get("limit")) || DEFAULT_LIMIT;
  const start = Number(url.searchParams.get("cursor")) || 0;
  const page = items.slice(start, start + limit);
  const next = start + limit < items.length ? String(start + limit) : null;
  return { items: page, next_cursor: next, total: items.length };
}

export const projectHandlers = [
  http.get("*/api/v1/sample/projects", () =>
    HttpResponse.json({
      items: structuredClone(MOCK_SAMPLE_PROJECTS),
      next_cursor: null,
      total: MOCK_SAMPLE_PROJECTS.length,
    }),
  ),
  http.get("*/api/v1/projects/:projectId/runs", ({ params, request }) => {
    const known = MOCK_SAMPLE_PROJECTS.some((p) => String(p.id) === params.projectId);
    const url = new URL(request.url);
    const items = known ? runList({ progress: !url.searchParams.get("cursor") }) : [];
    return HttpResponse.json(paginate(items, url));
  }),
];

/* 테스트에서 server.use(...) 로 바꿔 끼우는 오류 응답 */
export const projectErrorHandlers = {
  runsNetworkError: http.get("*/api/v1/projects/:projectId/runs", () => HttpResponse.error()),
  sampleProjectsNetworkError: http.get("*/api/v1/sample/projects", () => HttpResponse.error()),
};
