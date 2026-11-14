import { Link } from "react-router-dom";

import plane from "@/assets/workspace/todo-plane.svg";
import { buildPath } from "@/constants/routes";
import type { WorkspaceSnapshot } from "@/types/workspace.type";

export default function SummaryCards({ data }: { data: WorkspaceSnapshot }) {
  return (
    <section aria-labelledby="workspace-todo" className="flex flex-wrap items-end gap-10">
      <img src={plane} alt="" width={182} height={139} className="shrink-0" />
      <div className="min-w-0 flex-1 space-y-4">
        <h2 id="workspace-todo" className="text-2xl font-bold">
          투두리스트
        </h2>
        <div className="grid gap-6 rounded-xl bg-surface px-6 py-6 shadow-surface sm:grid-cols-3">
          <div className="space-y-2 sm:border-r sm:border-line sm:pr-5">
            <p className="text-xs text-subtle">보정 조정안 대기</p>
            <p className="text-3xl font-bold">{data.summary.pendingCalibration}개</p>
            <div className="flex flex-wrap justify-between gap-2 text-xs">
              <span>반찬로드</span>
              <Link className="underline" to={buildPath("calibration", { projectId: "banchan" })}>
                조정안 확인
              </Link>
            </div>
          </div>
          <div className="space-y-2 sm:border-r sm:border-line sm:pr-5">
            <p className="text-xs text-subtle">이번 주 완료 테스트</p>
            <p className="text-3xl font-bold">{data.summary.completedThisWeek}개</p>
            <p className="text-xs text-subtle">실패 {data.summary.failedThisWeek}</p>
          </div>
          <div className="space-y-2">
            <p className="text-xs text-subtle">실측 비교 가능</p>
            <p className="text-3xl font-bold">
              {data.summary.comparableProjects} / {data.projects.length}
              <span className="ml-2 text-xs font-normal text-subtle">프로젝트</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
