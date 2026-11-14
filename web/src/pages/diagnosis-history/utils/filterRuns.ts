import type { WorkspaceRun } from "@/types/workspace.type";

export type RunFilters = {
  search: string;
  project: string;
  status: string;
  type: string;
  period: string;
  sort: string;
};
export function filterRuns(runs: WorkspaceRun[], filters: RunFilters, asOf: string) {
  const minimum =
    filters.period === "all"
      ? -Infinity
      : new Date(asOf).getTime() - Number(filters.period) * 86400000;
  const search = filters.search.trim().toLocaleLowerCase();
  return runs
    .filter(
      (run) =>
        (!search ||
          `${run.title} ${run.id} ${run.projectName}`.toLocaleLowerCase().includes(search)) &&
        (filters.project === "all" || run.projectId === filters.project) &&
        (filters.status === "all" || run.status === filters.status) &&
        (filters.type === "all" || run.type === filters.type) &&
        new Date(run.date).getTime() >= minimum,
    )
    .sort(
      (a, b) =>
        (new Date(b.date).getTime() - new Date(a.date).getTime()) *
        (filters.sort === "oldest" ? -1 : 1),
    );
}
export function comparisonReason(runs: WorkspaceRun[]) {
  if (runs.length !== 2) return "완료된 실행 2개를 선택해 주세요";
  if (runs.some((run) => run.status !== "completed" || run.predictions.length === 0))
    return "예측 결과가 있는 완료 실행만 비교할 수 있어요";
  if (runs[0].projectId !== runs[1].projectId) return "같은 프로젝트의 실행을 선택해 주세요";
  if (runs[0].type !== runs[1].type) return "같은 유형의 실행을 선택해 주세요";
  return "";
}
