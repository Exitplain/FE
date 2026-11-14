import { useSearchParams } from "react-router-dom";

import Button from "@/components/Button/Button";
import CreateProjectModal from "@/components/Projects/CreateProjectModal";
import WorkspacePageHeader from "@/components/Workspace/WorkspacePageHeader";
import WorkspaceState, { WorkspaceRetry } from "@/components/Workspace/WorkspaceState";
import { useProjects } from "@/hooks/useProjects";

import ProjectListEmpty from "./components/ProjectListEmpty";
import ProjectSearch from "./components/ProjectSearch";
import ProjectsTable from "./components/ProjectsTable";

import "@/components/Workspace/workspace.css";

export default function ProjectListPage() {
  const query = useProjects();
  const [params, setParams] = useSearchParams();
  const search = params.get("q") ?? "";
  const projects = params.get("state") === "empty" ? [] : (query.data ?? []);
  const filtered = projects.filter((project) =>
    `${project.name} ${project.url}`.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const update = (key: string, value: string | null) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
        return next;
      },
      { replace: true },
    );
  return (
    <div className="space-y-8 text-ink">
      <WorkspacePageHeader
        title="프로젝트"
        description={
          search ? `‘${search}’ 검색 결과 ${filtered.length}개` : `프로젝트 ${projects.length}개`
        }
        actions={
          <Button variant="outline" icon="plus" onClick={() => update("create", "1")}>
            새 프로젝트
          </Button>
        }
      />
      <ProjectSearch
        value={search}
        onChange={(value) => update("q", value)}
        onClear={() => update("q", null)}
      />
      {query.isPending || params.get("state") === "loading" ? (
        <WorkspaceState kind="loading" title="프로젝트를 불러오는 중이에요" />
      ) : query.isError || params.get("state") === "error" ? (
        <WorkspaceState
          kind="error"
          title="프로젝트를 불러오지 못했어요"
          action={
            <WorkspaceRetry
              onClick={() => {
                update("state", null);
                void query.refetch();
              }}
            />
          }
        />
      ) : (
        <>
          <ProjectsTable projects={filtered} />
          {filtered.length ? (
            <p className="text-xs text-muted">행을 누르면 프로젝트 개요로 이동해요</p>
          ) : (
            <ProjectListEmpty
              search={search.trim()}
              onClear={() => update("q", null)}
              onCreate={() => update("create", "1")}
            />
          )}
        </>
      )}
      {params.get("create") === "1" && (
        <CreateProjectModal onClose={() => update("create", null)} />
      )}
    </div>
  );
}
