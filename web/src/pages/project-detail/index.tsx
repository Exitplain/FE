import { useSearchParams } from "react-router-dom";

import ProjectContextHeader from "@/components/Projects/ProjectContextHeader";
import { useCurrentProject } from "@/components/Projects/currentProject";
import WorkspaceState, { WorkspaceRetry } from "@/components/Workspace/WorkspaceState";
import { toProjectOverview } from "@/apis/project.api";
import { useRunList } from "@/hooks/useRunList";

import DiagnosisLoop from "./components/DiagnosisLoop";
import ProjectSummary from "./components/ProjectSummary";

/*
  C05 프로젝트 개요. 프로젝트는 ProjectRoute 가 GET /api/v1/projects/{id} 로 받아 둔 것을 씁니다.
  마지막 사전 테스트는 실행 목록(GET /api/v1/projects/{id}/runs, 테스트 목록과 같은 캐시)으로 정합니다.
  실측·보정은 BE 에 아직 없어 사전 테스트가 끝나면 실측 분석을 지금 단계로 두는 데까지만 보여 줍니다.
  ?state=loading|error 는 디자인 확인용 미리보기입니다.
*/
export default function ProjectDetailPage() {
  const current = useCurrentProject();
  const project = current.record;
  const runs = useRunList(current.v1Id);
  const overview = toProjectOverview(
    current.detail,
    runs.data?.pages.flatMap((page) => page.items),
  );
  const [params, setParams] = useSearchParams();
  return (
    <div className="space-y-10 text-ink">
      <ProjectContextHeader project={project} />
      {params.get("state") === "loading" ? (
        <WorkspaceState kind="loading" title="프로젝트를 불러오는 중이에요" />
      ) : params.get("state") === "error" ? (
        <WorkspaceState
          kind="error"
          title="프로젝트를 불러오지 못했어요"
          action={
            <WorkspaceRetry
              onClick={() => {
                setParams(
                  (previous) => {
                    const next = new URLSearchParams(previous);
                    next.delete("state");
                    return next;
                  },
                  { replace: true },
                );
              }}
            />
          }
        />
      ) : (
        <>
          <DiagnosisLoop
            project={project}
            overview={overview}
            /* 실행 목록을 받기 전에는 오래된 단계의 버튼을 누르지 않게 */
            loading={runs.isPending}
          />
          <ProjectSummary project={project} overview={overview} />
        </>
      )}
    </div>
  );
}
