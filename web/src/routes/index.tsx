import { createBrowserRouter, type RouteObject } from "react-router-dom";

import ProjectRoute from "@/components/Projects/ProjectRoute";
import { ROUTES } from "@/constants/routes";
import AppLayout from "@/layouts/AppLayout/AppLayout";
import AuthLayout from "@/layouts/AuthLayout/AuthLayout";
import AnalyticsPage from "@/pages/analytics";
import CalibrationPage from "@/pages/calibration";
import DashboardPage from "@/pages/dashboard";
import DiagnosisHistoryPage from "@/pages/diagnosis-history";
import GuidePage from "@/pages/guide";
import IssuesPage from "@/pages/issues";
import LoginPage from "@/pages/login";
import NewTestPage from "@/pages/new-test";
import NotFoundPage from "@/pages/not-found";
import PrivacyPage from "@/pages/privacy";
import ProjectDetailPage from "@/pages/project-detail";
import ProjectHistoryPage from "@/pages/project-history";
import ProjectIssuesPage from "@/pages/project-issues";
import ProjectListPage from "@/pages/project-list";
import ReportPage from "@/pages/report";
import RetestPage from "@/pages/retest";
import SessionDetailPage from "@/pages/session-detail";
import SettingsPage from "@/pages/settings";
import ParticipantPage from "@/pages/participant";
import SharedReportPage from "@/pages/shared-report";
import TestListPage from "@/pages/test-list";
import TestRunPage from "@/pages/test-run";

/*
  경로 문자열은 constants/routes.ts 에서만 관리합니다.
  라우트 배열을 따로 내보내는 이유: 테스트에서 createMemoryRouter 로 원하는 주소를 열어 보려고.
*/
export const routes: RouteObject[] = [
  {
    element: <AuthLayout />,
    children: [{ path: ROUTES.login.path, element: <LoginPage /> }],
  },
  /* P21 공유 리포트는 로그인 없이 보는 화면이라 사이드바·가운데 정렬 레이아웃 없이 자체 상단 바를 씁니다 */
  { path: ROUTES.sharedReport.path, element: <SharedReportPage /> },
  /* 참여자 응답 링크도 로그인 없이 여는 화면이라 앱 레이아웃 밖에 둡니다 */
  { path: ROUTES.participant.path, element: <ParticipantPage /> },
  {
    element: <AppLayout />,
    children: [
      { path: ROUTES.dashboard.path, element: <DashboardPage /> },
      { path: ROUTES.diagnosisHistory.path, element: <DiagnosisHistoryPage /> },
      { path: ROUTES.issues.path, element: <IssuesPage /> },
      { path: ROUTES.settings.path, element: <SettingsPage /> },
      { path: ROUTES.guide.path, element: <GuidePage /> },
      { path: ROUTES.projectList.path, element: <ProjectListPage /> },
      /* :projectId 아래 화면은 ProjectRoute 가 프로젝트를 받아 넘기고 없음·로그인 필요 상태를 맡습니다 */
      {
        element: <ProjectRoute />,
        children: [
          { path: ROUTES.projectDetail.path, element: <ProjectDetailPage /> },
          { path: ROUTES.projectHistory.path, element: <ProjectHistoryPage /> },
          { path: ROUTES.projectIssues.path, element: <ProjectIssuesPage /> },
          { path: ROUTES.testList.path, element: <TestListPage /> },
          { path: ROUTES.analytics.path, element: <AnalyticsPage /> },
          { path: ROUTES.calibration.path, element: <CalibrationPage /> },
          { path: ROUTES.newTest.path, element: <NewTestPage /> },
          { path: ROUTES.testRun.path, element: <TestRunPage /> },
          { path: ROUTES.report.path, element: <ReportPage /> },
          { path: ROUTES.sessionDetail.path, element: <SessionDetailPage /> },
          { path: ROUTES.retest.path, element: <RetestPage /> },
        ],
      },
      /* 개인정보처리방침은 로그인 없이도 봅니다 (구글 로그인 동의 화면·사이드바 하단에서 연결) */
      { path: ROUTES.privacy.path, element: <PrivacyPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
];

export const router = createBrowserRouter(routes);
