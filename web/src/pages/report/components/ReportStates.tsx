import { Link } from "react-router-dom";

import { buttonVariants } from "@/components/Button/buttonVariants";
import Icon from "@/components/Icon/Icon";
import WorkspaceState, { WorkspaceRetry } from "@/components/Workspace/WorkspaceState";
import { buildPath } from "@/constants/routes";

/* E04 리포트 로딩 — 요약 숫자·퍼널 자리를 회색 막대로 */
export function ReportLoading() {
  return (
    <div className="flex flex-col gap-10">
      <div aria-hidden className="grid grid-cols-4 gap-6 motion-safe:animate-pulse">
        {[0, 1, 2, 3].map((n) => (
          <div key={n} className="flex flex-col gap-3">
            <span className="h-3 w-16 rounded bg-gray-200" />
            <span className="h-6 w-24 rounded bg-gray-200" />
            <span className="h-3 w-20 rounded bg-gray-200" />
          </div>
        ))}
      </div>
      <div aria-hidden className="flex flex-col gap-4 motion-safe:animate-pulse">
        {[0, 1, 2, 3, 4, 5, 6].map((n) => (
          <div key={n} className="grid grid-cols-6 gap-4">
            <span className="h-3 rounded bg-gray-200" />
            <span className="col-span-4 h-3 rounded bg-gray-200" />
            <span className="h-3 rounded bg-gray-200" />
          </div>
        ))}
      </div>
      <p
        role="status"
        className="flex items-center gap-2 rounded-lg bg-gray-50 px-4 py-3 text-caption text-subtle"
      >
        <Icon name="status-wait" />
        리포트를 불러오고 있어요
      </p>
    </div>
  );
}

/* E18 실행 기록 없음 (404) */
export function ReportNotFound({ projectId }: { projectId: string }) {
  return (
    <WorkspaceState
      kind="empty"
      title="실행 기록을 찾을 수 없어요"
      description="삭제됐거나 주소가 잘못됐을 수 있어요"
      action={
        <Link
          to={buildPath("testList", { projectId })}
          className={buttonVariants({ variant: "secondary" })}
        >
          테스트 목록 보기
        </Link>
      }
    />
  );
}

/* 아직 끝나지 않은 실행 (409) — 과거 결과로 대체하지 않고 실행 화면으로 안내 */
export function ReportPending({ projectId, runId }: { projectId: string; runId: string }) {
  return (
    <WorkspaceState
      kind="empty"
      title="아직 끝나지 않은 테스트예요"
      description="실행이 끝나면 리포트를 볼 수 있어요"
      action={
        <Link
          to={buildPath("testRun", { projectId, runId })}
          className={buttonVariants({ variant: "secondary" })}
        >
          실행 화면 보기
        </Link>
      }
    />
  );
}

/* E20 리포트 불러오기 실패 */
export function ReportError({ projectId, onRetry }: { projectId: string; onRetry: () => void }) {
  return (
    <WorkspaceState
      kind="error"
      title="리포트를 불러오지 못했어요"
      description="연결을 확인하고 다시 시도하세요"
      action={
        <div className="flex flex-col items-center gap-4">
          <WorkspaceRetry onClick={onRetry} />
          <Link
            to={buildPath("testList", { projectId })}
            className="text-sm font-medium text-ink underline"
          >
            다른 실행 선택
          </Link>
        </div>
      }
    />
  );
}
