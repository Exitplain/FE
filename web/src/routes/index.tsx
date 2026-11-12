import { createBrowserRouter } from "react-router-dom";

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
import ProjectDetailPage from "@/pages/project-detail";
import ProjectListPage from "@/pages/project-list";
import ReportPage from "@/pages/report";
import RetestPage from "@/pages/retest";
import SessionDetailPage from "@/pages/session-detail";
import SettingsPage from "@/pages/settings";
import SharedReportPage from "@/pages/shared-report";
import TestListPage from "@/pages/test-list";
import TestRunPage from "@/pages/test-run";

/* 경로 문자열은 constants/routes.ts 에서만 관리합니다 */
export const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    children: [
      { path: ROUTES.login.path, element: <LoginPage /> },
      { path: ROUTES.sharedReport.path, element: <SharedReportPage /> },
    ],
  },
  {
    element: <AppLayout />,
    children: [
      { path: ROUTES.dashboard.path, element: <DashboardPage /> },
      { path: ROUTES.diagnosisHistory.path, element: <DiagnosisHistoryPage /> },
      { path: ROUTES.issues.path, element: <IssuesPage /> },
      { path: ROUTES.settings.path, element: <SettingsPage /> },
      { path: ROUTES.guide.path, element: <GuidePage /> },
      { path: ROUTES.projectList.path, element: <ProjectListPage /> },
      { path: ROUTES.projectDetail.path, element: <ProjectDetailPage /> },
      { path: ROUTES.testList.path, element: <TestListPage /> },
      { path: ROUTES.analytics.path, element: <AnalyticsPage /> },
      { path: ROUTES.calibration.path, element: <CalibrationPage /> },
      { path: ROUTES.newTest.path, element: <NewTestPage /> },
      { path: ROUTES.testRun.path, element: <TestRunPage /> },
      { path: ROUTES.report.path, element: <ReportPage /> },
      { path: ROUTES.sessionDetail.path, element: <SessionDetailPage /> },
      { path: ROUTES.retest.path, element: <RetestPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
