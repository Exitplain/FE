import ProjectContextHeader from "@/components/Projects/ProjectContextHeader";
import { useCurrentProject } from "@/components/Projects/currentProject";
import DiagnosisHistoryPage from "@/pages/diagnosis-history";

export default function ProjectHistoryPage() {
  const project = useCurrentProject().record;
  return (
    <DiagnosisHistoryPage
      key={project.id}
      project={{ id: project.id, name: project.name }}
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
