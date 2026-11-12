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
  },
  workspace: {
    overview: (workspaceId: string) => ["workspace", workspaceId, "overview"] as const,
  },
};
