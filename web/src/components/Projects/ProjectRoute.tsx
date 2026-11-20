import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Outlet, useParams } from "react-router-dom";

import { getProjectDetail } from "@/apis/project.v1.api";
import { displayUrl, toProjectRecord } from "@/apis/project.api";
import { queryKeys } from "@/apis/queryKeys";
import Button from "@/components/Button/Button";
import WorkspaceState, { WorkspaceRetry } from "@/components/Workspace/WorkspaceState";
import { useDemoSessionStore } from "@/stores/useDemoSessionStore";
import { ApiError } from "@/types/api.type";

import { CurrentProjectContext, parseProjectId, type CurrentProject } from "./currentProject";
import ProjectUnavailable from "./ProjectUnavailable";

/*
  /projects/:projectId 아래 화면의 공통 바깥 틀.
  GET /api/v1/projects/{id} 로 프로젝트를 한 번 받아 안쪽 화면에 넘기고(useCurrentProject),
  불러오는 중·없음(404)·로그인 필요(401)·권한 없음(403)·오류 상태를 여기서 한 번에 보여 줍니다.
  샘플 프로젝트는 로그인 없이 볼 수 있고, 그 밖에는 소유자만 볼 수 있습니다.
  children 은 테스트처럼 라우트 하나만 감쌀 때 씁니다. 없으면 하위 라우트(Outlet)를 그립니다.
*/
export default function ProjectRoute({ children }: { children?: ReactNode }) {
  const { projectId } = useParams();
  const v1Id = parseProjectId(projectId);
  if (v1Id === undefined) return <ProjectUnavailable />;
  /* 프로젝트를 옮겨 가면 이전 프로젝트 화면 상태가 남지 않도록 새로 그립니다 */
  return (
    <ProjectLoader key={v1Id} v1Id={v1Id}>
      {children ?? <Outlet />}
    </ProjectLoader>
  );
}

function ProjectLoader({ v1Id, children }: { v1Id: number; children: ReactNode }) {
  const openLogin = useDemoSessionStore((state) => state.openLogin);
  const query = useQuery({
    queryKey: queryKeys.projectsV1.detail(v1Id),
    queryFn: () => getProjectDetail(v1Id),
    staleTime: 30_000,
    /* 없음·로그인 필요·권한 없음은 다시 물어도 같아서 바로 보여 줍니다 (그 밖은 한 번 더) */
    retry: (count, error) =>
      !(error instanceof ApiError && [401, 403, 404].includes(error.status)) && count < 1,
  });

  if (query.isPending)
    return <WorkspaceState kind="loading" title="프로젝트를 불러오는 중이에요" />;

  if (query.isError) {
    const status = query.error instanceof ApiError ? query.error.status : undefined;
    if (status === 404) return <ProjectUnavailable />;
    if (status === 401)
      return (
        <WorkspaceState
          kind="notice"
          title="로그인이 필요해요"
          description="로그인하면 내 프로젝트를 볼 수 있어요"
          action={<Button onClick={openLogin}>로그인</Button>}
        />
      );
    if (status === 403)
      return (
        <WorkspaceState
          kind="empty"
          title="이 프로젝트를 볼 권한이 없어요"
          description="프로젝트를 만든 계정으로 로그인했는지 확인해 주세요"
        />
      );
    return (
      <WorkspaceState
        kind="error"
        title="프로젝트를 불러오지 못했어요"
        action={<WorkspaceRetry onClick={() => void query.refetch()} />}
      />
    );
  }

  const detail = query.data;
  const project: CurrentProject = {
    id: String(detail.id),
    v1Id: detail.id,
    name: detail.name,
    url: displayUrl(detail.entry_url),
    isSample: detail.is_sample,
    record: toProjectRecord(detail),
    detail,
  };
  return (
    <CurrentProjectContext.Provider value={project}>{children}</CurrentProjectContext.Provider>
  );
}
