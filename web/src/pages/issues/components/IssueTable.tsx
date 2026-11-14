import Icon from "@/components/Icon/Icon";
import type { WorkspaceIssue } from "@/types/workspace.type";

export default function IssueTable({
  issues,
  onSelect,
  ascending,
  onSort,
}: {
  issues: WorkspaceIssue[];
  onSelect: (id: string) => void;
  ascending: boolean;
  onSort: () => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="workspace-table">
        <thead>
          <tr>
            <th>문제 (원인 · 단계)</th>
            <th>프로젝트 · 과업</th>
            <th aria-sort={ascending ? "ascending" : "descending"}>
              <button type="button" className="whitespace-nowrap text-ink" onClick={onSort}>
                영향 (가상 세션) {ascending ? "↑" : "↓"}
              </button>
            </th>
            <th>처음 발견</th>
            <th>최근 테스트</th>
          </tr>
        </thead>
        <tbody>
          {issues.map((issue) => (
            <tr key={issue.id}>
              <td>
                <button
                  type="button"
                  className="text-left font-medium whitespace-nowrap hover:underline"
                  onClick={() => onSelect(issue.id)}
                >
                  {issue.cause} · {issue.stage}
                </button>
              </td>
              <td className="whitespace-nowrap">
                {issue.projectName} · {issue.task}
              </td>
              <td className="whitespace-nowrap">
                가상 세션{" "}
                {issue.impact[0] === issue.impact[1] ? issue.impact[0] : issue.impact.join("~")}개
              </td>
              <td className="whitespace-nowrap">{issue.firstSeen}</td>
              <td>
                <span className="inline-flex items-center gap-2 whitespace-nowrap text-subtle">
                  <Icon
                    name={
                      issue.verdict === "계속 발생"
                        ? "verdict-repeat"
                        : issue.verdict === "새로 발견"
                          ? "verdict-new"
                          : "verdict-before"
                    }
                  />
                  {issue.verdict}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
