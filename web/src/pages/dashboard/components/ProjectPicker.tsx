import { useEffect, useId, useRef, useState } from "react";

import Icon from "@/components/Icon/Icon";
import type { WorkspaceProject } from "@/types/workspace.type";
import { cn } from "@/utils/cn";

import "./project-picker.css";

type ProjectPickerProps = {
  id: string;
  projects: WorkspaceProject[];
  value: string;
  onChange: (id: string) => void;
  onCreate: () => void;
};

/* W07 전용 선택창. 기본 select를 쓰는 다른 화면의 필터는 변경하지 않습니다. */
export default function ProjectPicker({
  id,
  projects,
  value,
  onChange,
  onCreate,
}: ProjectPickerProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = projects.find((project) => project.id === value);

  function show() {
    setActiveIndex(
      Math.max(
        0,
        projects.findIndex((project) => project.id === value),
      ),
    );
    setOpen(true);
  }

  function choose(index: number) {
    setOpen(false);
    if (index === projects.length) onCreate();
    else if (projects[index]) onChange(projects[index].id);
  }

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);

  useEffect(() => {
    if (open)
      document.getElementById(`${listId}-${activeIndex}`)?.scrollIntoView?.({ block: "nearest" });
  }, [open, activeIndex, listId]);

  return (
    <div
      ref={root}
      className="relative"
      onBlur={(event) => {
        if (!root.current?.contains(event.relatedTarget as Node)) setOpen(false);
      }}
    >
      <button
        id={id}
        type="button"
        role="combobox"
        aria-label="테스트할 프로젝트"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? `${listId}-${activeIndex}` : undefined}
        className="flex min-h-10 w-full items-center justify-between gap-3 rounded-lg border border-gray-300 bg-surface px-3 py-2 text-left text-sm text-gray-800 outline-none focus-visible:ring-2 focus-visible:ring-ink"
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={(event) => {
          if (event.key === "Escape" && open) {
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
          } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            if (!open) show();
            else
              setActiveIndex((index) =>
                Math.max(
                  0,
                  Math.min(projects.length, index + (event.key === "ArrowDown" ? 1 : -1)),
                ),
              );
          } else if ((event.key === "Home" || event.key === "End") && open) {
            event.preventDefault();
            setActiveIndex(event.key === "Home" ? 0 : projects.length);
          } else if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (open) choose(activeIndex);
            else show();
          } else if (event.key === "Tab") setOpen(false);
        }}
      >
        <span className="truncate">
          {selected
            ? `${selected.name} · ${new URL(selected.url).hostname}`
            : "프로젝트를 선택하세요"}
        </span>
        <Icon name="chevron-down" className="size-5 text-subtle" />
      </button>
      {open && (
        <div
          id={listId}
          role="listbox"
          aria-label="프로젝트 목록"
          className="project-picker-menu absolute top-full right-0 left-0 z-20 mt-1 max-h-72 overflow-y-auto rounded-lg border border-line bg-surface p-2"
        >
          {[
            ...projects.map((project) => ({
              id: project.id,
              name: project.name,
              description: new URL(project.url).hostname,
            })),
            { id: "new", name: "+ 새 프로젝트", description: "새 사이트 등록" },
          ].map((option, index) => (
            <button
              key={option.id}
              id={`${listId}-${index}`}
              type="button"
              role="option"
              aria-selected={option.id === value}
              tabIndex={-1}
              className={cn(
                "flex min-h-14 w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm text-ink hover:bg-gray-100",
                option.id === value && "bg-surface-pressed",
                index === activeIndex && option.id !== value && "bg-gray-50",
              )}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(index)}
            >
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span
                  className={cn("block leading-5 break-words", option.id === value && "font-bold")}
                >
                  {option.name}
                </span>
                <span className="block text-xs leading-4 break-all text-muted">
                  {option.description}
                </span>
              </span>
              {option.id === value && <Icon name="check" className="size-5" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
