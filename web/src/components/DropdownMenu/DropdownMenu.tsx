import {
  type KeyboardEvent,
  type ReactNode,
  type Ref,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import Icon from "@/components/Icon/Icon";
import { cn } from "@/utils/cn";

export type DropdownMenuItem = {
  key: string;
  label: ReactNode;
  /* 아래 작은 회색 설명 (예: "A4 · 요약부터 세션 근거까지") */
  description?: ReactNode;
  disabled?: boolean;
  /* 값이 있으면 고르는 메뉴(menuitemradio)로 보고, true 인 항목에 체크를 붙입니다 */
  selected?: boolean;
  onSelect: () => void;
};

export type DropdownTriggerProps = {
  ref: Ref<HTMLButtonElement>;
  id: string;
  "aria-haspopup": "menu";
  "aria-expanded": boolean;
  "aria-controls": string | undefined;
  onClick: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
};

type DropdownMenuProps = {
  /* 메뉴 이름 (스크린 리더용). 예: "내보내기 형식", "실행 선택" */
  label: string;
  items: DropdownMenuItem[];
  /* 여는 버튼. 받은 props 를 버튼에 그대로 펼칩니다 */
  renderTrigger: (props: DropdownTriggerProps) => ReactNode;
  /* 메뉴를 버튼의 왼쪽(start)·오른쪽(end) 끝에 맞춥니다 */
  align?: "start" | "end";
  className?: string;
};

/*
  Figma Menu/Export(P13 내보내기)·P12c 실행 선택 드롭다운.
  - 열면 선택된 항목(없으면 첫 항목)으로 초점을 옮기고, ↑↓·Home·End 로 이동, Enter·Space 로 고릅니다.
    여는 버튼에서 ↑ 로 열면 마지막 항목부터 시작합니다 (WAI-ARIA 메뉴 버튼 패턴).
  - Escape·Tab·바깥 클릭으로 닫고, 닫으면 여는 버튼으로 초점을 돌려줍니다(Tab·바깥 클릭 제외).
  - 비활성 항목은 보이기만 하고 키보드 이동에서 건너뜁니다.
  - 메뉴는 포털 없이 버튼 아래에 absolute 로 붙습니다. overflow-hidden 인 부모 안에 두면 잘립니다.

  사용 예
    <DropdownMenu label="내보내기 형식" align="end" items={[...]}
      renderTrigger={(props) => <Button variant="secondary" icon="download" {...props}>내보내기</Button>} />
*/
export default function DropdownMenu({
  label,
  items,
  renderTrigger,
  align = "start",
  className,
}: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  /* 열린 직후 초점을 줄 위치. 버튼에서 ↑ 로 열 때만 last */
  const startAt = useRef<"first" | "last">("first");
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const triggerId = useId();
  const menuId = useId();
  const radio = items.some((item) => item.selected !== undefined);
  const enabled = items.flatMap((item, index) => (item.disabled ? [] : [index]));

  const focusItem = (index: number | undefined) => {
    if (index !== undefined) itemRefs.current[index]?.focus();
  };

  const close = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  };

  /* 열린 직후 초점: (↑ 로 열면 마지막 활성 항목) → 선택된 항목 → 첫 활성 항목 */
  useEffect(() => {
    if (!open) return;
    const selected = items.findIndex((item) => item.selected && !item.disabled);
    if (startAt.current === "last") focusItem(enabled.at(-1));
    else focusItem(selected >= 0 ? selected : enabled[0]);
    startAt.current = "first";
    // 열릴 때 한 번만 맞춥니다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      startAt.current = event.key === "ArrowUp" ? "last" : "first";
      setOpen(true);
    } else if (event.key === "Escape" && open) {
      /* 모든 항목이 비활성이면 초점이 버튼에 남아 있으므로 여기서도 닫습니다 */
      event.stopPropagation();
      close(true);
    }
  };

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = enabled.indexOf(itemRefs.current.indexOf(document.activeElement as never));
    const move = (to: number) => focusItem(enabled[(to + enabled.length) % enabled.length]);

    if (event.key === "ArrowDown") move(current + 1);
    else if (event.key === "ArrowUp") move(current < 0 ? enabled.length - 1 : current - 1);
    else if (event.key === "Home") move(0);
    else if (event.key === "End") move(enabled.length - 1);
    else if (event.key === "Escape") {
      event.stopPropagation();
      close(true);
    } else if (event.key === "Tab") {
      close(false);
      return;
    } else return;
    event.preventDefault();
  };

  return (
    <div ref={rootRef} className={cn("relative inline-flex", className)}>
      {renderTrigger({
        ref: triggerRef,
        id: triggerId,
        "aria-haspopup": "menu",
        "aria-expanded": open,
        "aria-controls": open ? menuId : undefined,
        onClick: () => setOpen((value) => !value),
        onKeyDown: onTriggerKeyDown,
      })}
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKeyDown}
          className={cn(
            "absolute top-full z-40 mt-2 flex min-w-64 flex-col gap-0.5 rounded-xl border border-line bg-surface p-1 shadow-tooltip",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          {items.map((item, index) => (
            <button
              key={item.key}
              ref={(element) => {
                itemRefs.current[index] = element;
              }}
              type="button"
              role={radio ? "menuitemradio" : "menuitem"}
              aria-checked={radio ? Boolean(item.selected) : undefined}
              aria-disabled={item.disabled || undefined}
              tabIndex={-1}
              onClick={() => {
                if (item.disabled) return;
                item.onSelect();
                close(true);
              }}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left",
                /* 선택 표시(회색 바탕)와 구분되도록 초점은 테두리로 보여줍니다 */
                "outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink",
                item.disabled ? "cursor-not-allowed" : "hover:bg-gray-50",
                item.selected && "bg-gray-100",
              )}
            >
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span
                  className={cn(
                    "text-sm font-medium",
                    item.disabled ? "text-muted" : "text-ink",
                    item.selected && "font-bold",
                  )}
                >
                  {item.label}
                </span>
                {item.description != null && (
                  <span className="text-xs text-muted">{item.description}</span>
                )}
              </span>
              {item.selected && <Icon name="check" className="shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
