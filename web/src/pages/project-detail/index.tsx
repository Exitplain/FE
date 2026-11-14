import { useParams, useSearchParams } from "react-router-dom";

import ProjectContextHeader from "@/components/Projects/ProjectContextHeader";
import ProjectUnavailable from "@/components/Projects/ProjectUnavailable";
import WorkspaceState, { WorkspaceRetry } from "@/components/Workspace/WorkspaceState";
import { useProjectOverview, useProjects } from "@/hooks/useProjects";

import DiagnosisLoop from "./components/DiagnosisLoop";
import ProjectSummary from "./components/ProjectSummary";

export default function ProjectDetailPage() {
  const { projectId } = useParams();
  const projects = useProjects();
  const [params, setParams] = useSearchParams();
  const project = projects.data?.find((item) => item.id === projectId);
  const query = useProjectOverview(project?.id, params.get("variant") === "unconnected");
  if (!project) return <ProjectUnavailable />;
  return (
    <div className="space-y-10 text-ink">
      <ProjectContextHeader project={project} />
      {query.isPending || params.get("state") === "loading" ? (
        <WorkspaceState kind="loading" title="프로젝트를 불러오는 중이에요" />
      ) : query.isError || params.get("state") === "error" ? (
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
                void query.refetch();
              }}
            />
          }
        />
      ) : (
        query.data && (
          <>
            <DiagnosisLoop project={project} overview={query.data} />
            <ProjectSummary project={project} overview={query.data} />
          </>
        )
      )}
    </div>
  );
}
