/*
  전체 화면 경로 — 라우트 표.
  모든 화면을 초기 세팅에서 미리 등록해 두므로, 각자 작업할 때 이 파일과
  routes/index.tsx 를 고칠 일이 거의 없습니다. 새 경로가 필요하면 공통 영역 PR 로 추가합니다.

  screens: Figma 와이어프레임의 화면 코드, owner: 담당자
*/

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
    screens: "C05~C09",
    owner: "고명준",
  },
  testList: {
    path: "/projects/:projectId/tests",
    title: "사전 테스트 목록",
    screens: "P01",
    owner: "팀원",
  },
  newTest: { path: "/tests/new", title: "새 테스트", screens: "P02~P05c", owner: "팀원" },
  testRun: { path: "/runs/:runId", title: "테스트 실행", screens: "P06~P11", owner: "팀원" },
  report: { path: "/runs/:runId/report", title: "리포트", screens: "P12~P14", owner: "팀원" },
  sessionDetail: {
    path: "/runs/:runId/sessions/:sessionId",
    title: "세션 상세",
    screens: "P15~P16",
    owner: "팀원",
  },
  retest: {
    path: "/runs/:runId/retest",
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
