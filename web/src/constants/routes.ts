/*
  전체 화면 경로 — 라우트 표.
  모든 화면을 초기 세팅에서 미리 등록해 두므로, 각자 작업할 때 이 파일과
  routes/index.tsx 를 고칠 일이 거의 없습니다. 새 경로가 필요하면 공통 영역 PR 로 추가합니다.

  screens: Figma 와이어프레임의 화면 코드, owner: 담당자
*/

import { generatePath, type PathParam } from "react-router-dom";

export type RouteKey = keyof typeof ROUTES;

export const FIGMA_FILE_URL = "https://www.figma.com/design/XYkGMN8Avldbl3SN65vEsr";

export const ROUTES = {
  login: { path: "/login", title: "로그인", screens: "L01~L10", owner: "고명준" },
  dashboard: { path: "/", title: "대시보드", screens: "W01, W07", owner: "고명준" },
  diagnosisHistory: {
    path: "/history",
    title: "진단 기록",
    screens: "W02",
    owner: "고명준",
  },
  issues: { path: "/issues", title: "발견한 문제", screens: "W03", owner: "고명준" },
  settings: { path: "/settings", title: "워크스페이스 설정", screens: "W04", owner: "고명준" },
  guide: { path: "/guide", title: "시작 가이드", screens: "W05", owner: "고명준" },
  projectList: { path: "/projects", title: "프로젝트", screens: "C02~C04", owner: "고명준" },
  projectDetail: {
    path: "/projects/:projectId",
    title: "프로젝트 개요",
    screens: "C05~C06",
    owner: "고명준",
  },
  /*
    프로젝트 안의 진단 기록·발견한 문제. 워크스페이스 화면(/history, /issues, W02·W03)은 모든 프로젝트를
    모아 보고, 이 화면은 한 프로젝트만 자세히 봅니다 (Figma IA C08·C09, 사이드바 프로젝트 하위 메뉴).
  */
  projectHistory: {
    path: "/projects/:projectId/history",
    title: "프로젝트 진단 기록",
    screens: "C08",
    owner: "고명준",
  },
  projectIssues: {
    path: "/projects/:projectId/issues",
    title: "프로젝트 발견한 문제",
    screens: "C09",
    owner: "고명준",
  },
  testList: {
    path: "/projects/:projectId/tests",
    title: "사전 테스트 목록",
    screens: "P01",
    owner: "팀원",
  },
  /*
    사전 테스트 흐름(P02~P18)은 Figma 에서 모두 프로젝트 탭 안의 화면이라 프로젝트 아래에 둡니다.
    BE 실행(run)에는 프로젝트 소속 정보가 없으므로 projectId 는 화면 문맥(breadcrumb·탭) 용도입니다.
  */
  newTest: {
    path: "/projects/:projectId/tests/new",
    title: "새 테스트",
    screens: "P02~P05c",
    owner: "팀원",
  },
  testRun: {
    path: "/projects/:projectId/runs/:runId",
    title: "테스트 실행",
    screens: "P06~P11",
    owner: "팀원",
  },
  report: {
    path: "/projects/:projectId/runs/:runId/report",
    title: "리포트",
    screens: "P12~P14",
    owner: "팀원",
  },
  sessionDetail: {
    path: "/projects/:projectId/runs/:runId/sessions/:sessionId",
    title: "세션 상세",
    screens: "P15~P16",
    owner: "팀원",
  },
  retest: {
    path: "/projects/:projectId/runs/:runId/retest",
    title: "재테스트 전후 비교",
    screens: "P17~P18",
    owner: "팀원",
  },
  sharedReport: {
    path: "/share/:shareId",
    title: "공유 리포트",
    screens: "P20~P21",
    owner: "팀원",
  },
  analytics: {
    path: "/projects/:projectId/analytics",
    title: "실측 분석",
    screens: "R01~R11",
    owner: "미정",
  },
  calibration: {
    path: "/projects/:projectId/calibration",
    title: "보정",
    screens: "K01~K04",
    owner: "미정",
  },
} as const;

/*
  경로의 :파라미터를 모두 필수 string 으로 요구합니다.
  선택 파라미터(:id?)나 splat(*)을 ROUTES 에 추가하면 이 타입과 buildPath 를 함께 고칩니다.
  (splat 값은 generatePath 가 인코딩하지 않습니다)
*/
type RoutePath<K extends RouteKey> = (typeof ROUTES)[K]["path"];
type RouteParams<K extends RouteKey> = { [P in PathParam<RoutePath<K>>]: string };
type RouteParamsArgs<K extends RouteKey> = [PathParam<RoutePath<K>>] extends [never]
  ? []
  : [params: RouteParams<K>];

/*
  화면 이동 주소는 이 함수로 만듭니다. 경로 문자열을 직접 쓰지 않습니다.
  - 파라미터 이름·누락을 타입으로 검사합니다. (경로를 바꿔도 호출부가 컴파일 오류로 드러남)
  - 값 인코딩은 generatePath 가 합니다. 미리 인코딩하면 두 번 인코딩됩니다.
  - 빈 값은 오류로 막습니다. generatePath 는 빈 세그먼트를 지워 버려서
    { projectId: "" } 가 /projects/tests (= projectDetail) 같은 다른 화면 주소가 되기 때문입니다.
    useParams() 값은 `?? ""` 로 채우지 말고 없을 때의 화면을 따로 처리합니다.
  예: buildPath("testRun", { projectId, runId })
*/
export function buildPath<K extends RouteKey>(key: K, ...args: RouteParamsArgs<K>): string {
  const [params] = args;
  const path: string = ROUTES[key].path;

  for (const [name, value] of Object.entries(params ?? {})) {
    if (value === "") {
      throw new Error(`buildPath("${key}"): ${name} 값이 비어 있습니다.`);
    }
  }

  return generatePath(path, params);
}
