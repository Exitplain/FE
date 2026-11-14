import Icon from "@/components/Icon/Icon";
import Input from "@/components/Input/Input";
import WorkspaceSelect from "@/components/Workspace/WorkspaceSelect";
import type { WorkspaceProject } from "@/types/workspace.type";

import type { RunFilters } from "../utils/filterRuns";

export default function HistoryFilters({
  filters,
  projects,
  onChange,
}: {
  filters: RunFilters;
  projects: WorkspaceProject[];
  onChange: (key: keyof RunFilters, value: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="relative mr-2 min-w-64 flex-1">
        <span className="sr-only">테스트 이름 또는 실행 ID 검색</span>
        <Icon name="search" className="absolute top-3 left-3 text-muted" />
        <Input
          className="pl-9"
          placeholder="테스트 이름 또는 실행 ID 검색"
          value={filters.search}
          onChange={(event) => onChange("search", event.target.value)}
        />
      </label>
      <WorkspaceSelect
        label="프로젝트 필터"
        value={filters.project}
        onChange={(v) => onChange("project", v)}
        options={[
          { value: "all", label: "프로젝트 · 전체" },
          ...projects.map((p) => ({ value: p.id, label: `프로젝트 · ${p.name}` })),
        ]}
      />
      <WorkspaceSelect
        label="상태 필터"
        value={filters.status}
        onChange={(v) => onChange("status", v)}
        options={[
          { value: "all", label: "상태 · 전체" },
          { value: "queued", label: "상태 · 준비 중" },
          { value: "running", label: "상태 · 실행 중" },
          { value: "completed", label: "상태 · 완료" },
          { value: "failed", label: "상태 · 실패" },
        ]}
      />
      <WorkspaceSelect
        label="유형 필터"
        value={filters.type}
        onChange={(v) => onChange("type", v)}
        options={[
          { value: "all", label: "유형 · 전체" },
          { value: "사전 테스트", label: "유형 · 사전 테스트" },
          { value: "원인 재현", label: "유형 · 원인 재현" },
        ]}
      />
      <WorkspaceSelect
        label="기간 필터"
        value={filters.period}
        onChange={(v) => onChange("period", v)}
        options={[
          { value: "30", label: "기간 · 최근 30일" },
          { value: "7", label: "기간 · 최근 7일" },
          { value: "all", label: "기간 · 전체" },
        ]}
      />
    </div>
  );
}
