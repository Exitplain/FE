import ProjectContextHeader from "@/components/Projects/ProjectContextHeader";
import { useCurrentProject } from "@/components/Projects/currentProject";
import IssuesPage from "@/pages/issues";

export default function ProjectIssuesPage() {
  const project = useCurrentProject().record;
  return (
    <IssuesPage
      key={project.id}
      projectId={project.id}
      sample={project.isSample}
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
