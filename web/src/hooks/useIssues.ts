import { useQuery } from "@tanstack/react-query";

import { getIssues, getProjectIssues, toWorkspaceIssue } from "@/apis/issue.api";
import { queryKeys } from "@/apis/queryKeys";
import { ApiError } from "@/types/api.type";

/*
  발견한 문제. projectId(숫자 문자열)를 주면 C09(그 프로젝트), 없으면 W03(내 모든 프로젝트).
  로그인 필요(401)·권한 없음(403, 샘플 프로젝트)은 다시 물어도 같아서 바로 보여 줍니다.
*/
export function useIssues(projectId?: string, { enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    enabled,
    queryKey: projectId
      ? queryKeys.issues.project(Number(projectId))
      : queryKeys.issues.workspace(),
    queryFn: () => (projectId ? getProjectIssues(Number(projectId)) : getIssues()),
    select: (data) => data.items.map(toWorkspaceIssue),
    retry: (count, error) =>
      !(error instanceof ApiError && [401, 403, 404].includes(error.status)) && count < 1,
  });
}
