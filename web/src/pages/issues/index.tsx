import type { ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";

import Button from "@/components/Button/Button";
import { buttonVariants } from "@/components/Button/buttonVariants";
import WorkspacePageHeader from "@/components/Workspace/WorkspacePageHeader";
import WorkspaceState, { WorkspaceRetry } from "@/components/Workspace/WorkspaceState";
import { buildPath } from "@/constants/routes";
import { useIssues } from "@/hooks/useIssues";
import { ApiError } from "@/types/api.type";

import IssueDetailModal from "./components/IssueDetailModal";
import IssueFilters from "./components/IssueFilters";
import IssueTable from "./components/IssueTable";

import "@/components/Workspace/workspace.css";

/*
  W03 발견한 문제(내 모든 프로젝트) · C09(projectId 를 주면 그 프로젝트). 제품 API GET /api/v1/issues · /projects/{id}/issues
*/
export default function IssuesPage({
  projectId,
  sample = false,
  header,
}: { projectId?: string; sample?: boolean; header?: ReactNode } = {}) {
  /* 샘플 프로젝트는 BE 가 소유자만 보여 줘(403) 묻지 않고 안내합니다 */
  const query = useIssues(projectId, { enabled: !sample });
  const status = query.error instanceof ApiError ? query.error.status : null;
  const [params, setParams] = useSearchParams();
  const cause = params.get("cause") ?? "all";
  const ascending = params.get("sort") === "ascending";
  const all = query.data ?? [];
  const issues = all
    .filter((issue) => cause === "all" || issue.cause === cause)
    .sort((a, b) => (b.impact[1] - a.impact[1]) * (ascending ? -1 : 1));
  const update = (key: string, value: string | null) =>
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      if (value === null) next.delete(key);
      else next.set(key, value);
      return next;
    });
  return (
    <div className="space-y-7 text-ink">
      {header ?? (
        <WorkspacePageHeader
          title="발견한 문제"
          description="같은 과업·단계·원인으로 멈춘 가상 세션을 하나로 묶었어요"
        />
      )}
      {all.length > 0 && (
        <IssueFilters
          issues={all}
          selected={cause}
          onChange={(value) => update("cause", value === "all" ? null : value)}
        />
      )}
      {sample ? (
        <WorkspaceState
          kind="empty"
          title="샘플 프로젝트는 문제 모아 보기를 지원하지 않아요"
          description="리포트에서 이탈 원인을 확인하거나, 내 프로젝트를 만들어 테스트해 보세요"
          action={
            projectId ? (
              <Link
                to={buildPath("projectHistory", { projectId })}
                className={buttonVariants({ variant: "secondary" })}
              >
                진단 기록 보기
              </Link>
            ) : undefined
          }
        />
      ) : query.isPending ? (
        <WorkspaceState kind="loading" title="발견한 문제를 불러오는 중이에요" />
      ) : status === 401 ? (
        <WorkspaceState
          kind="error"
          title="로그인이 필요해요"
          description="로그인하면 내 프로젝트에서 발견한 문제를 모아 볼 수 있어요"
        />
      ) : status === 403 ? (
        <WorkspaceState
          kind="error"
          title="이 프로젝트의 문제는 볼 수 없어요"
          description="내가 만든 프로젝트에서만 발견한 문제를 모아 보여 줘요"
        />
      ) : query.isError ? (
        <WorkspaceState
          kind="error"
          title="발견한 문제를 불러오지 못했어요"
          description="잠시 후 다시 시도해 주세요 · 기록은 그대로 있어요"
          action={<WorkspaceRetry onClick={() => void query.refetch()} />}
        />
      ) : issues.length ? (
        <>
          <IssueTable
            hideProject={Boolean(projectId)}
            issues={issues}
            onSelect={(id) => update("issue", id)}
            ascending={ascending}
            onSort={() => update("sort", ascending ? null : "ascending")}
          />
          <p className="text-xs text-muted">
            {issues.length}개 묶음 · 영향 {ascending ? "적은" : "많은"} 순 · 가상 페르소나의 모의
            결과
          </p>
        </>
      ) : (
        <WorkspaceState
          kind="empty"
          title={cause !== "all" ? "조건에 맞는 문제가 없어요" : "아직 발견한 문제가 없어요"}
          description="테스트가 끝나면 이탈 원인이 묶여 여기에 모여요"
          action={
            cause !== "all" ? (
              <Button variant="secondary" onClick={() => update("cause", null)}>
                필터 초기화
              </Button>
            ) : (
              <Link
                to={
                  projectId
                    ? buildPath("projectHistory", { projectId })
                    : buildPath("diagnosisHistory")
                }
                className={buttonVariants({ variant: "secondary" })}
              >
                진단 기록 보기
              </Link>
            )
          }
        />
      )}
      <IssueDetailModal
        issue={all.find((issue) => issue.id === params.get("issue"))}
        onClose={() => update("issue", null)}
      />
    </div>
  );
}
