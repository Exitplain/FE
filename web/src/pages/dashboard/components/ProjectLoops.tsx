import { Link } from "react-router-dom";

import Icon from "@/components/Icon/Icon";
import { buildPath } from "@/constants/routes";
import type { WorkspaceProject } from "@/types/workspace.type";
import { cn } from "@/utils/cn";

export default function ProjectLoops({
  projects,
  beforeTest = false,
  onStart,
}: {
  projects: WorkspaceProject[];
  beforeTest?: boolean;
  onStart?: () => void;
}) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-bold">프로젝트별 루프 위치</h2>
      <div className="overflow-x-auto">
        <table className="workspace-table">
          <thead>
            <tr>
              <th>프로젝트</th>
              <th>루프 진행</th>
              <th>실측 · 보정</th>
              <th className="text-right">다음 행동</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => (
              <tr key={project.id}>
                <td>
                  <Link
                    className="font-medium hover:underline"
                    to={buildPath("projectDetail", { projectId: project.id })}
                  >
                    {project.name}
                  </Link>
                </td>
                <td>
                  <p className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="font-medium">
                      {beforeTest ? "테스트 전" : project.stageLabel}
                    </span>
                    <span className="text-xs text-muted">{!beforeTest && project.stageDetail}</span>
                  </p>
                  <div
                    className="flex gap-1"
                    aria-label={`${beforeTest ? 0 : project.stage} / 7 단계`}
                  >
                    {[1, 2, 3, 4, 5, 6, 7].map((step) => (
                      <span
                        key={step}
                        className={cn(
                          "h-1.5 w-7 rounded-full bg-gray-200",
                          !beforeTest && step < project.stage && "bg-subtle",
                          !beforeTest && step === project.stage && "border border-ink bg-highlight",
                        )}
                      />
                    ))}
                  </div>
                </td>
                <td>
                  <p className="flex items-center gap-1 text-subtle">
                    <Icon name="activity" />
                    {beforeTest ? "실측 미연결" : project.analytics}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    보정 · {beforeTest ? "보정 전" : project.calibration}
                  </p>
                </td>
                <td className="text-right">
                  {beforeTest ? (
                    <button
                      type="button"
                      className="whitespace-nowrap hover:underline"
                      onClick={onStart}
                    >
                      첫 테스트 시작
                    </button>
                  ) : (
                    <Link
                      className="inline-flex items-center justify-end gap-1 whitespace-nowrap hover:underline"
                      to={buildPath(project.actionTarget, { projectId: project.id })}
                    >
                      {project.action === "표본 모으는 중" && (
                        <Icon name="status-wait" className="text-muted" />
                      )}
                      {project.action}
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
