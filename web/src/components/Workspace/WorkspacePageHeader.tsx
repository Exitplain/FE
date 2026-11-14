import type { ReactNode } from "react";

export default function WorkspacePageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-1">
      <p className="text-xs leading-4 text-muted">워크스페이스</p>
      <div className="flex min-h-10 flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-ink">{title}</h1>
        {actions}
      </div>
      {description && <p className="text-caption text-subtle">{description}</p>}
    </header>
  );
}
