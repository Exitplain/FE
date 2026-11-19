import { Fragment } from "react";

import Button from "@/components/Button/Button";
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <ChoiceChip size="sm" selected={selected === "all"} onClick={() => onChange("all")}>
          전체 <span className="font-normal">{issues.length}</span>
        </ChoiceChip>
        <span className="ml-2 text-xs text-muted">이탈 원인</span>
        {causes.map((cause) => (
          <Fragment key={cause}>
            {cause === "기술 오류·지연" && (
              <span className="ml-2 text-xs text-muted">기술 실패</span>
            )}
            <ChoiceChip
              size="sm"
              selected={selected === cause}
              onClick={() => onChange(selected === cause ? "all" : cause)}
            >
              {cause}
              <span className="font-normal">
                {issues.filter((issue) => issue.cause === cause).length}
              </span>
            </ChoiceChip>
          </Fragment>
        ))}
      </div>
      <div className="space-y-2">
        {selected !== "all" && (
          <div className="flex items-center gap-2 text-caption">
            <span>
              {selected} · {issues.filter((issue) => issue.cause === selected).length}개 묶음
            </span>
            <Button variant="link" onClick={() => onChange("all")}>
              필터 초기화
            </Button>
          </div>
        )}
        <p className="flex items-center gap-2 text-xs text-muted">
          <Icon name="info" className="text-sky-400" />
          순서는 가상 방문 수 기준 · 판정은 재실행 시에만
        </p>
      </div>
    </div>
  );
}
