import { type ReactNode, useState } from "react";
import { useSearchParams } from "react-router-dom";

import Button from "@/components/Button/Button";
import WorkspacePageHeader from "@/components/Workspace/WorkspacePageHeader";
import WorkspaceState, { WorkspaceRetry } from "@/components/Workspace/WorkspaceState";
import { useWorkspaceData } from "@/hooks/useWorkspaceData";

import CompareRunsModal from "./components/CompareRunsModal";
import HistoryFilters from "./components/HistoryFilters";
import HistoryTable from "./components/HistoryTable";
import { comparisonReason, filterRuns, type RunFilters } from "./utils/filterRuns";

import "@/components/Workspace/workspace.css";

export default function DiagnosisHistoryPage({
  projectId,
  header,
}: { projectId?: string; header?: ReactNode } = {}) {
  const query = useWorkspaceData();
  const [params, setParams] = useSearchParams();
  const [selected, setSelected] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const defaults: RunFilters = {
    search: "",
    project: projectId ?? "all",
    status: "all",
    type: "all",
    period: "30",
    sort: "newest",
  };
  const filters = Object.fromEntries(
    Object.entries(defaults).map(([key, value]) => [key, params.get(key) ?? value]),
  ) as RunFilters;
  if (projectId) filters.project = projectId;
  const update = (key: keyof RunFilters, value: string) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (value === defaults[key]) next.delete(key);
        else next.set(key, value);
        return next;
      },
      { replace: true },
    );
  const reset = () => {
    setSelected([]);
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      Object.keys(defaults).forEach((key) => next.delete(key));
      next.delete("state");
      return next;
    });
  };
  const runs =
    query.data && !query.isEmpty ? filterRuns(query.data.runs, filters, query.data.asOf) : [];
  const selectedRuns =
    query.data?.runs.filter(
      (run) => selected.includes(run.id) && (!projectId || run.projectId === projectId),
    ) ?? [];
  const reason = comparisonReason(selectedRuns);
  const applied = Object.entries(filters).filter(
    ([key, value]) => value !== defaults[key as keyof RunFilters] && key !== "sort",
  );
  return (
    <div className="space-y-7 text-ink">
      {header ?? (
        <WorkspacePageHeader
          title="진단 기록"
          description="사전 테스트와 차이 구간 원인 재현 실행을 모두 모았어요"
        />
      )}
      <HistoryFilters
        filters={filters}
        projects={query.data?.projects ?? []}
        onChange={update}
        hideProject={Boolean(projectId)}
      />
      {applied.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-subtle">
          <span>적용된 필터</span>
          {applied.map(([key, value]) => (
            <button
              type="button"
              key={key}
              onClick={() => update(key as keyof RunFilters, defaults[key as keyof RunFilters])}
              className="rounded-full bg-gray-50 px-3 py-2"
            >
              {query.data?.projects.find((p) => p.id === value)?.name ?? value} ×
            </button>
          ))}
          <Button variant="link" onClick={reset}>
            필터 모두 해제
          </Button>
        </div>
      )}
      {selected.length > 0 && (
        <section
          aria-label="선택한 실행"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-gray-50 p-4"
        >
          <span className="text-sm">{selected.length}개 선택됨</span>
          <div className="flex items-center gap-3">
            <Button variant="link" onClick={() => setSelected([])}>
              선택 해제
            </Button>
            <Button
              variant="outline"
              icon="compare"
              disabled={Boolean(reason)}
              title={reason || undefined}
              onClick={() => setCompareOpen(true)}
            >
              선택한 {selected.length}개 비교
            </Button>
          </div>
          {reason && <p className="w-full text-xs text-muted">{reason}</p>}
        </section>
      )}
      {query.isLoading ? (
        <WorkspaceState kind="loading" title="기록을 불러오는 중이에요" />
      ) : query.isError ? (
        <WorkspaceState
          kind="error"
          title="진단 기록을 불러오지 못했어요"
          description="잠시 후 다시 시도해 주세요. 실행 중인 테스트에는 영향이 없어요."
          action={<WorkspaceRetry onClick={query.retry} />}
        />
      ) : (
        <>
          <HistoryTable
            hideProject={Boolean(projectId)}
            runs={runs}
            selected={selected}
            onToggle={(id) =>
              setSelected((previous) =>
                previous.includes(id)
                  ? previous.filter((value) => value !== id)
                  : [...previous, id],
              )
            }
            onToggleAll={() =>
              setSelected((previous) =>
                runs.every((run) => previous.includes(run.id))
                  ? previous.filter((id) => !runs.some((run) => run.id === id))
                  : [...new Set([...previous, ...runs.map((run) => run.id)])],
              )
            }
            ascending={filters.sort === "oldest"}
            onSort={() => update("sort", filters.sort === "oldest" ? "newest" : "oldest")}
          />
          {runs.length === 0 ? (
            <WorkspaceState
              kind="empty"
              title="조건에 맞는 실행이 없어요"
              description="필터를 바꾸거나 모두 해제해 보세요"
              action={
                <Button variant="secondary" icon="close" onClick={reset}>
                  필터 모두 해제
                </Button>
              }
            />
          ) : (
            <p className="text-xs text-muted">
              {runs.length}개 실행 ·{" "}
              {filters.period === "all" ? "전체 기간" : `최근 ${filters.period}일`} · 실행일{" "}
              {filters.sort === "oldest" ? "오래된순" : "최신순"} · 샘플 데이터
            </p>
          )}
        </>
      )}
      <CompareRunsModal
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        runs={selectedRuns}
      />
    </div>
  );
}
