import { useParams } from "react-router-dom";

import ProjectContextHeader from "@/components/Projects/ProjectContextHeader";
import ProjectUnavailable from "@/components/Projects/ProjectUnavailable";
import { useProjects } from "@/hooks/useProjects";
import IssuesPage from "@/pages/issues";

export default function ProjectIssuesPage() {
  const { projectId } = useParams();
  const query = useProjects();
  const project = query.data?.find((item) => item.id === projectId);
  if (!project) return <ProjectUnavailable />;
  return (
    <IssuesPage
      key={project.id}
      projectId={project.id}
      header={
        <ProjectContextHeader
          project={project}
          title="발견한 문제"
          description={`${project.name}에서 같은 과업·단계·원인으로 멈춘 가상 세션을 묶었어요`}
        />
      }
    />
  );
}
