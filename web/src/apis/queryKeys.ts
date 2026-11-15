/*
  TanStack Query 키는 이 파일에서만 만듭니다.
  키가 겹치거나 invalidate 대상이 어긋나는 문제를 막기 위해서입니다.
  새 도메인을 추가할 때 같은 형태로 이어서 작성합니다.
*/
export const queryKeys = {
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
  },
  /* 제품 API 실행. 실행을 만들거나 끝난 뒤에는 runs.all 로 한꺼번에 무효화합니다 */
  runs: {
    all: ["runs"] as const,
    list: (projectId: number) => [...queryKeys.runs.all, projectId, "list"] as const,
  },
  calibration: {
    all: ["calibration"] as const,
    history: (projectId: string) => [...queryKeys.calibration.all, projectId, "history"] as const,
  },
  workspace: {
    overview: (workspaceId: string) => ["workspace", workspaceId, "overview"] as const,
  },
};
