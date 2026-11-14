import { Link, useSearchParams } from "react-router-dom";

import Button from "@/components/Button/Button";
import { buttonVariants } from "@/components/Button/buttonVariants";
import WorkspacePageHeader from "@/components/Workspace/WorkspacePageHeader";
import WorkspaceState, { WorkspaceRetry } from "@/components/Workspace/WorkspaceState";
import { buildPath } from "@/constants/routes";
import { useWorkspaceData } from "@/hooks/useWorkspaceData";

import IssueDetailModal from "./components/IssueDetailModal";
import IssueFilters from "./components/IssueFilters";
import IssueTable from "./components/IssueTable";

import "@/components/Workspace/workspace.css";

export default function IssuesPage() {
  const query = useWorkspaceData();
  const [params, setParams] = useSearchParams();
  const cause = params.get("cause") ?? "all";
  const ascending = params.get("sort") === "ascending";
  const all = query.isEmpty ? [] : (query.data?.issues ?? []);
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
      <WorkspacePageHeader
        title="발견한 문제"
        description="같은 과업·단계·원인으로 멈춘 가상 세션을 하나로 묶었어요"
      />
      {!query.isEmpty && (
        <IssueFilters
          issues={all}
          selected={cause}
          onChange={(value) => update("cause", value === "all" ? null : value)}
        />
      )}
      {cause !== "all" && (
        <div className="flex items-center gap-4 text-caption">
          <span>
            {cause} · {issues.length}개 묶음
          </span>
          <Button variant="link" onClick={() => update("cause", null)}>
            필터 초기화
          </Button>
        </div>
      )}
      {query.isLoading ? (
        <WorkspaceState kind="loading" title="발견한 문제를 불러오는 중이에요" />
      ) : query.isError ? (
        <WorkspaceState
          kind="error"
          title="발견한 문제를 불러오지 못했어요"
          description="잠시 후 다시 시도해 주세요 · 기록은 그대로 있어요"
          action={<WorkspaceRetry onClick={query.retry} />}
        />
      ) : issues.length ? (
        <>
          <IssueTable
            issues={issues}
            onSelect={(id) => update("issue", id)}
            ascending={ascending}
            onSort={() => update("sort", ascending ? null : "ascending")}
          />
          <p className="text-xs text-muted">
            {issues.length}개 묶음 · 영향 {ascending ? "적은" : "많은"} 순 · 샘플 데이터
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
                to={buildPath("diagnosisHistory")}
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
