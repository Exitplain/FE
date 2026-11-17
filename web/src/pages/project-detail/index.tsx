import { useSearchParams } from "react-router-dom";

import ProjectContextHeader from "@/components/Projects/ProjectContextHeader";
import { useCurrentProject } from "@/components/Projects/currentProject";
import WorkspaceState, { WorkspaceRetry } from "@/components/Workspace/WorkspaceState";
import { toProjectOverview } from "@/apis/project.api";

import DiagnosisLoop from "./components/DiagnosisLoop";
import ProjectSummary from "./components/ProjectSummary";

/*
  C05 프로젝트 개요. 프로젝트는 ProjectRoute 가 GET /api/v1/projects/{id} 로 받아 둔 것을 씁니다.
  서버에 있는 건 마지막 사전 테스트뿐이라 실측·보정 단계는 시작 전으로 보여 줍니다.
  ?state=loading|error 는 디자인 확인용 미리보기입니다.
*/
export default function ProjectDetailPage() {
  const current = useCurrentProject();
  const project = current.record;
  const overview = toProjectOverview(current.detail);
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
          <DiagnosisLoop project={project} overview={overview} />
          <ProjectSummary project={project} overview={overview} />
        </>
      )}
    </div>
  );
}
