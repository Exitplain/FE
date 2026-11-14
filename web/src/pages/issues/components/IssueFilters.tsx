import ChoiceChip from "@/components/ChoiceChip/ChoiceChip";
import Icon from "@/components/Icon/Icon";
import type { WorkspaceIssue } from "@/types/workspace.type";

const causes = [
  "탐색 실패",
  "가치 불명확",
  "비용 충격",
  "입력 부담",
  "신뢰 부족",
  "접근성 장벽",
  "기술 오류·지연",
];

export default function IssueFilters({
  issues,
  selected,
  onChange,
}: {
  issues: WorkspaceIssue[];
  selected: string;
  onChange: (cause: string) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <ChoiceChip size="sm" selected={selected === "all"} onClick={() => onChange("all")}>
          전체 <span className="font-normal">{issues.length}</span>
        </ChoiceChip>
        <span className="ml-2 text-xs text-muted">이탈 원인</span>
        {causes.map((cause) => (
          <ChoiceChip
            key={cause}
            size="sm"
            selected={selected === cause}
            onClick={() => onChange(selected === cause ? "all" : cause)}
          >
            {cause}
            <span className="font-normal">
              {issues.filter((issue) => issue.cause === cause).length}
            </span>
          </ChoiceChip>
        ))}
      </div>
      <p className="flex items-center gap-2 text-xs text-muted">
        <Icon name="info" className="text-sky-400" />
        순서는 가상 세션 수 기준 · 판정은 재실행 시에만
      </p>
    </div>
  );
}
