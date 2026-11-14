import { Link, useNavigate } from "react-router-dom";

import RunStatus from "@/components/Workspace/RunStatus";
import { buildPath } from "@/constants/routes";
import type { ProjectRecord } from "@/types/project.type";

export default function ProjectsTable({ projects }: { projects: ProjectRecord[] }) {
  const navigate = useNavigate();
  return (
    <div className="overflow-x-auto">
      <table className="workspace-table">
        <thead>
          <tr>
            <th>프로젝트</th>
            <th>최근 사전 테스트</th>
            <th>실측</th>
            <th>보정</th>
            <th className="text-right">수정일</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => (
            <tr
              key={project.id}
              className="cursor-pointer"
              onClick={(event) => {
                if (!(event.target as HTMLElement).closest("a"))
                  navigate(buildPath("projectDetail", { projectId: project.id }));
              }}
            >
              <td>
                <Link
                  className="block font-medium hover:underline"
                  to={buildPath("projectDetail", { projectId: project.id })}
                >
                  {project.name}
                </Link>
                <p className="mt-1 text-xs text-muted">{new URL(project.url).hostname}</p>
              </td>
              <td>
                {project.lastTestStatus ? (
                  <RunStatus status={project.lastTestStatus} />
                ) : (
                  <span className="text-subtle">테스트 전</span>
                )}
              </td>
              <td className="whitespace-nowrap">{project.analytics.replace("실측 ", "")}</td>
              <td className="whitespace-nowrap">{project.calibration}</td>
              <td className="text-right whitespace-nowrap">{project.updatedLabel}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
