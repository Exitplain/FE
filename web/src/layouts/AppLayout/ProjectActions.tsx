import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import DropdownMenu from "@/components/DropdownMenu/DropdownMenu";
import Icon from "@/components/Icon/Icon";
import IconButton from "@/components/IconButton/IconButton";
import DeleteProjectDialog from "@/components/Projects/DeleteProjectDialog";
import { buildPath } from "@/constants/routes";
import { useDeleteProject } from "@/hooks/useProjects";
import { useToastStore } from "@/stores/useToastStore";
import type { ProjectRecord } from "@/types/project.type";

export default function ProjectActions({
  project,
}: {
  project: Pick<ProjectRecord, "id" | "name" | "isSample">;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const deletion = useDeleteProject((projectId) => {
    const base = buildPath("projectDetail", { projectId: String(projectId) });
    if (pathname === base || pathname.startsWith(`${base}/`)) {
      navigate(buildPath("projectList"), { replace: true, flushSync: true });
    }
    setConfirmOpen(false);
    useToastStore.getState().show("프로젝트를 삭제했어요");
  });
  return (
    <>
      <DropdownMenu
        label={`${project.name} 프로젝트 메뉴`}
        align="end"
        className="mr-6 shrink-0 [&_[role=menu]]:min-w-44"
        items={[
          {
            key: "delete",
            label: (
              <span className="flex items-center gap-2 text-danger">
                <Icon name="trash" />
                프로젝트 삭제
              </span>
            ),
            description: project.isSample ? "샘플 프로젝트는 삭제할 수 없어요" : undefined,
            disabled: project.isSample,
            onSelect: () => setConfirmOpen(true),
          },
        ]}
        renderTrigger={(props) => (
          <IconButton
            {...props}
            icon="more"
            label={`${project.name} 프로젝트 메뉴`}
            className="text-muted"
          />
        )}
      />
      {confirmOpen && (
        <DeleteProjectDialog
          project={project}
          onClose={() => setConfirmOpen(false)}
          onDelete={(projectId) => deletion.mutateAsync(Number(projectId))}
        />
      )}
    </>
  );
}
