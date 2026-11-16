import { useQuery } from "@tanstack/react-query";

import { getSampleProjects } from "@/apis/project.v1.api";
import { queryKeys } from "@/apis/queryKeys";
import type { SampleProject } from "@/constants/projects";
import type { V1ProjectSummary } from "@/types/project.v1.type";

function hostOf(url: string) {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return undefined;
  }
}

/* 화면 프로젝트의 사이트 주소 host 가 같은 제품 API 프로젝트를 찾습니다 */
export function matchV1Project(
  project: Pick<SampleProject, "url">,
  candidates: readonly V1ProjectSummary[],
): V1ProjectSummary | undefined {
  const host = hostOf(project.url);
  if (!host) return undefined;
  return candidates.find((candidate) => candidate.domain.toLowerCase() === host);
}

/*
  화면 프로젝트(문자열 id, constants/projects.ts) → 제품 API 프로젝트 id(숫자).
  임시: 프로젝트 화면(C·W)이 아직 제품 API 를 쓰지 않아, 로그인 없이 볼 수 있는 샘플 프로젝트와
  사이트 주소로 맞춥니다. 맞는 프로젝트가 없으면 v1Id 가 undefined 입니다.
  프로젝트 화면이 제품 API id 를 쓰게 되면 이 훅을 지웁니다.
*/
export function useV1ProjectId(project: SampleProject) {
  const query = useQuery({
    queryKey: queryKeys.projectsV1.sample(),
    queryFn: getSampleProjects,
    /* 샘플 프로젝트는 거의 바뀌지 않습니다 */
    staleTime: 5 * 60 * 1000,
  });

  return {
    v1Id: query.data ? matchV1Project(project, query.data.items)?.id : undefined,
    isPending: query.isPending,
    isError: query.isError && query.data === undefined,
    isFetching: query.isFetching,
    refetch: query.refetch,
  };
}
