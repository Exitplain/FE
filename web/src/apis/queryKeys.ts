/*
  TanStack Query 키는 이 파일에서만 만듭니다.
  키가 겹치거나 invalidate 대상이 어긋나는 문제를 막기 위해서입니다.
  새 도메인을 추가할 때 같은 형태로 이어서 작성합니다.
*/
export const queryKeys = {
  /* 로그인 상태. 로그인·로그아웃 성공 시 응답으로 바로 채웁니다 */
  auth: {
    all: ["auth"] as const,
    session: () => [...queryKeys.auth.all, "session"] as const,
  },
  personas: {
    all: ["personas"] as const,
    current: () => [...queryKeys.personas.all, "current"] as const,
    reports: () => [...queryKeys.personas.all, "reports"] as const,
    report: (runId: string) => [...queryKeys.personas.all, "report", runId] as const,
    session: (runId: string, sessionId: string) =>
      [...queryKeys.personas.all, "session", runId, sessionId] as const,
  },
  /* 제품 API 프로젝트 (숫자 id) */
  projectsV1: {
    all: ["projectsV1"] as const,
    sample: () => [...queryKeys.projectsV1.all, "sample"] as const,
    /* 사이드바·C02 목록 (내 프로젝트 + 샘플) */
    list: () => [...queryKeys.projectsV1.all, "list"] as const,
    detail: (projectId: number) => [...queryKeys.projectsV1.all, "detail", projectId] as const,
  },
  /* 제품 API 실행. 실행을 만들거나 끝난 뒤에는 runs.all 로 한꺼번에 무효화합니다 */
  runs: {
    all: ["runs"] as const,
    list: (projectId: number) => [...queryKeys.runs.all, projectId, "list"] as const,
    detail: (runId: string) => [...queryKeys.runs.all, "detail", runId] as const,
  },
  /* 제품 API 리포트. 실행이 끝나면 runs.all 과 함께 무효화합니다 (hooks/usePersonaRun) */
  reports: {
    all: ["reports"] as const,
    byRun: (runId: string) => [...queryKeys.reports.all, "run", runId] as const,
    shareLinks: (reportId: string) => [...queryKeys.reports.all, reportId, "share-links"] as const,
    shared: (token: string) => [...queryKeys.reports.all, "shared", token] as const,
  },
  /* 프로젝트 테스트 계정 (P04). 저장하면 응답으로 바로 채웁니다 */
  testAccounts: (projectId: number) => ["testAccounts", projectId] as const,
  calibration: {
    all: ["calibration"] as const,
    history: (projectId: string) => [...queryKeys.calibration.all, projectId, "history"] as const,
  },
  workspace: {
    overview: (workspaceId: string) => ["workspace", workspaceId, "overview"] as const,
  },
};
