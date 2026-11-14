import { useParams } from "react-router-dom";

import ProjectContextHeader from "@/components/Projects/ProjectContextHeader";
import ProjectUnavailable from "@/components/Projects/ProjectUnavailable";
import { useProjects } from "@/hooks/useProjects";
import DiagnosisHistoryPage from "@/pages/diagnosis-history";

export default function ProjectHistoryPage() {
  const { projectId } = useParams();
  const query = useProjects();
  const project = query.data?.find((item) => item.id === projectId);
  if (!project) return <ProjectUnavailable />;
  return (
    <DiagnosisHistoryPage
      key={project.id}
      projectId={project.id}
      header={
        <ProjectContextHeader
          project={project}
          title="진단 기록"
          description={`${project.name}의 사전 테스트와 원인 재현 실행`}
        />
      }
    />
  );
}
