import { Link } from "react-router-dom";

import Icon from "@/components/Icon/Icon";
import { buildPath } from "@/constants/routes";
import type { WorkspaceProject } from "@/types/workspace.type";
import { cn } from "@/utils/cn";

import type { ProjectLoop } from "../utils/dashboardData";

/* Figma "루프 진행 표시": 사전 테스트 1~3 · 실측 분석 4~6 · 보정 7 을 묶음으로 (묶음 사이 12px, 안은 4px) */
const STEP_GROUPS = [[1, 2, 3], [4, 5, 6], [7]];

function LoopSteps({ stage }: { stage: number }) {
  return (
    <div className="flex gap-3" aria-label={`${stage} / 7 단계`}>
      {STEP_GROUPS.map((group) => (
        <div key={group[0]} className="flex gap-1">
          {group.map((step) => (
            <span
              key={step}
              className={cn(
                "h-1.5 w-7 rounded-[3px] bg-gray-200",
                step < stage && "bg-subtle",
                step === stage && "border border-ink bg-highlight",
              )}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/*
  Figma W01 프로젝트별 루프 위치 — 프로젝트 16px Medium · 단계 14px Medium + 12px 회색 · 실측·보정 13px · 다음 행동 13px Medium.
  actionHref 가 있으면 다음 행동을 그 주소로 보냅니다 (실행 화면처럼 실행 id 가 필요한 곳).
*/
export default function ProjectLoops({
  projects,
  beforeTest = false,
  onStart,
}: {
  projects: (WorkspaceProject | ProjectLoop)[];
  beforeTest?: boolean;
  onStart?: () => void;
}) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg leading-[26px] font-bold">프로젝트별 루프 위치</h2>
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
            {projects.map((project) => {
              const stage = beforeTest ? 0 : project.stage;
              return (
                <tr key={project.id}>
                  <td>
                    <Link
                      className="text-base leading-6 font-medium text-ink hover:underline"
                      to={buildPath("projectDetail", { projectId: project.id })}
                    >
                      {project.name}
                    </Link>
                  </td>
                  <td>
                    <p className="mb-2.5 flex flex-wrap items-baseline gap-2">
                      <span className="text-sm leading-5 font-medium text-ink">
                        {beforeTest ? "테스트 전" : project.stageLabel}
                      </span>
                      {!beforeTest && (
                        <span className="text-xs leading-4 text-muted">{project.stageDetail}</span>
                      )}
                    </p>
                    <LoopSteps stage={stage} />
                  </td>
                  <td>
                    <p className="flex items-center gap-1.5 text-caption text-gray-800">
                      <Icon name="activity" className="size-3.5" />
                      {beforeTest ? "실측 미연결" : project.analytics}
                    </p>
                    <p className="mt-1.5 text-caption text-subtle">
                      보정 · {beforeTest ? "보정 전" : project.calibration}
                    </p>
                  </td>
                  <td className="text-right">
                    {beforeTest ? (
                      <button
                        type="button"
                        className="text-caption font-medium whitespace-nowrap text-ink hover:underline"
                        onClick={onStart}
                      >
                        첫 테스트 시작
                      </button>
                    ) : (
                      <Link
                        className="inline-flex items-center justify-end gap-1 text-caption font-medium whitespace-nowrap text-ink hover:underline"
                        to={
                          "actionHref" in project
                            ? project.actionHref
                            : buildPath(project.actionTarget, { projectId: project.id })
                        }
                      >
                        {project.action}
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
