import { type Query, useQueries } from "@tanstack/react-query";

import { queryKeys } from "@/apis/queryKeys";
import { getRuns } from "@/apis/run.api";
import { POLLING_INTERVAL_MS } from "@/constants/polling";
import type { Page } from "@/types/api.type";
import type { RunItem } from "@/types/run.type";
import type { WorkspaceRun } from "@/types/workspace.type";
import { toWorkspaceRun } from "@/utils/workspaceRuns";

import { useProjects } from "./useProjects";
import { hasActiveRun } from "./useRunList";

/* 프로젝트마다 받는 최근 실행 수 (BE 한 번에 최대 100) */
const RECENT_LIMIT = 100;

export type RunsProject = { id: string; name: string };

/*
  여러 프로젝트의 최근 실행을 모읍니다 (W02 진단 기록).
  워크스페이스 전체 실행 API 가 없어 프로젝트 수만큼 GET /api/v1/projects/{id}/runs 를 보냅니다.
  - project 를 주면(C08) 프로젝트 목록을 거치지 않고 그 프로젝트만 받습니다
  - 일부 프로젝트만 실패하면 받은 것은 보여 주고 failedProjects 로 알립니다. 모두 실패하면 오류입니다
  - 진행 중인 실행이 있는 프로젝트만 주기적으로 다시 받습니다
*/
export function useProjectRuns(project?: RunsProject) {
  const projects = useProjects({ enabled: !project });
  const targets: RunsProject[] = project ? [project] : (projects.data ?? []);
  const results = useQueries({
    queries: targets.map((target) => ({
      queryKey: queryKeys.runs.recent(Number(target.id)),
      queryFn: () => getRuns(Number(target.id), { limit: RECENT_LIMIT }),
      refetchInterval: (query: Query<Page<RunItem>>) =>
        hasActiveRun(query.state.data?.items ?? []) ? POLLING_INTERVAL_MS : false,
    })),
  });

  const listFailed = !project && projects.isError;
  const failedProjects = results.filter((result) => result.isError).length;
  const failed = listFailed || (results.length > 0 && failedProjects === results.length);
  const pending = (!project && projects.isPending) || results.some((result) => result.isPending);
  const runs: WorkspaceRun[] = results.flatMap((result, index) =>
    (result.data?.items ?? []).map((item) => toWorkspaceRun(item, targets[index])),
  );

  return {
    projects: targets,
    runs,
    isPending: !failed && pending,
    isError: failed,
    /* 실행 목록을 받지 못한 프로젝트 수 (전부 실패면 isError) */
    failedProjects: failed ? 0 : failedProjects,
    refetch: () => {
      if (listFailed) void projects.refetch();
      results.forEach((result) => result.isError && void result.refetch());
    },
  };
}
