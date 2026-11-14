import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { buttonVariants } from "@/components/Button/buttonVariants";
import Icon from "@/components/Icon/Icon";
import { buildPath } from "@/constants/routes";
import type { ProjectRecord } from "@/types/project.type";

import "./projects.css";

export default function ProjectContextHeader({
  project,
  title,
  description,
  actions,
}: {
  project: ProjectRecord;
  title?: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="space-y-1">
      <p className="text-xs text-muted">{title ? project.name : "프로젝트"}</p>
      <div className="flex min-h-10 flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{title ?? project.name}</h1>
        {actions ??
          (!title && (
            <Link
              className={buttonVariants({ variant: "primary" })}
              to={buildPath("newTest", { projectId: project.id })}
            >
              <Icon name="plus" />새 테스트 시작하기
            </Link>
          ))}
      </div>
      <p className="text-caption text-subtle">{description ?? project.url}</p>
    </header>
  );
}
