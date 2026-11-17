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

/* 아직 끝나지 않은 실행 — 리포트가 없고(404) 실행이 진행 중이면 실행 화면으로 안내 */
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

/* 실패·취소로 끝나 리포트가 만들어지지 않은 실행 */
export function ReportUnavailable({ projectId }: { projectId: string }) {
  return (
    <WorkspaceState
      kind="empty"
      title="이 실행에는 리포트가 없어요"
      description="실패했거나 취소된 실행이에요"
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

/* 리포트는 로그인한 프로젝트 소유자만 볼 수 있습니다 (401) — 샘플 프로젝트도 같습니다 */
export function ReportLoginRequired({ onLogin }: { onLogin: () => void }) {
  return (
    <WorkspaceState
      kind="notice"
      title="로그인이 필요해요"
      description="리포트는 로그인한 뒤 내 프로젝트에서 볼 수 있어요"
      action={
        <button type="button" onClick={onLogin} className={buttonVariants()}>
          로그인
        </button>
      }
    />
  );
}

/* 남의 프로젝트 리포트 (403) */
export function ReportForbidden() {
  return (
    <WorkspaceState
      kind="empty"
      title="이 리포트를 볼 권한이 없어요"
      description="프로젝트를 만든 계정으로 로그인했는지 확인해 주세요"
    />
  );
}

/* 실행은 끝났는데 리포트가 아직 없음 (404) — 서버가 리포트를 만드는 중이거나 늦어진 경우 */
export function ReportGenerating({ onRetry }: { onRetry: () => void }) {
  return (
    <WorkspaceState
      kind="notice"
      title="리포트를 만들고 있어요"
      description="잠시 뒤 다시 시도해 주세요"
      action={<WorkspaceRetry onClick={onRetry} />}
    />
  );
}
