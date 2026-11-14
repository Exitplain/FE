import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";

import adminShield from "@/assets/login/admin-shield.svg";
import workspaceSettings from "@/assets/login/workspace-settings.svg";
import Button from "@/components/Button/Button";
import Icon from "@/components/Icon/Icon";
import { ROUTES } from "@/constants/routes";
import { useDemoSessionStore } from "@/stores/useDemoSessionStore";
import { cn } from "@/utils/cn";

const menuItem =
  "flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm text-gray-800 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-ink";

export default function AccountControls() {
  const account = useDemoSessionStore((state) => state.account);
  const openLogin = useDemoSessionStore((state) => state.openLogin);
  const signOut = useDemoSessionStore((state) => state.signOut);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function dismiss(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);

  if (!account)
    return (
      <div className="mr-6 flex min-h-35 flex-col justify-between gap-6 pl-3">
        <p className="text-xs leading-4.5 text-subtle">
          로그인하면 AI 고객 테스트를 저장하고 리포트를 공유할 수 있어요
        </p>
        <Button variant="outline" className="w-full rounded-lg" onClick={openLogin}>
          로그인
        </Button>
      </div>
    );

  return (
    <div
      ref={root}
      className="relative mr-3"
      onBlur={(event) => {
        if (!root.current?.contains(event.relatedTarget as Node)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      {open && (
        <nav
          id={menuId}
          aria-label="계정 메뉴"
          className="absolute right-0 bottom-full left-0 z-20 mb-2 rounded-xl bg-surface p-1 py-2 shadow-tooltip"
        >
          <Link to={ROUTES.settings.path} className={menuItem} onClick={() => setOpen(false)}>
            <img src={workspaceSettings} alt="" className="size-4 shrink-0" />
            워크스페이스 설정
          </Link>
          <Link to={ROUTES.guide.path} className={menuItem} onClick={() => setOpen(false)}>
            <Icon name="help" />
            시작 가이드
          </Link>
          <button
            type="button"
            disabled
            title="운영 콘솔 연결 예정"
            className={cn(menuItem, "cursor-not-allowed")}
          >
            <img src={adminShield} alt="" className="size-4" />
            운영 콘솔 · 관리자
          </button>
          <div className="my-1 border-t border-line" />
          <button
            type="button"
            className={menuItem}
            onClick={() => {
              setOpen(false);
              signOut();
            }}
          >
            <Icon name="logout" />
            로그아웃
          </button>
        </nav>
      )}
      <button
        ref={trigger}
        type="button"
        aria-label={`${account.name} 계정 메뉴`}
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        className={cn(
          "flex h-12 w-full items-center gap-3 rounded-tooltip px-3 text-left hover:bg-surface/70 focus-visible:outline-2 focus-visible:outline-ink",
          open && "bg-surface/70",
        )}
        onClick={() => setOpen(!open)}
        onKeyDown={(event) => {
          if (event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            window.requestAnimationFrame(() =>
              root.current?.querySelector<HTMLAnchorElement>("nav a")?.focus(),
            );
          }
        }}
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-avatar text-caption font-bold text-ink">
          {account.name.slice(0, 1)}
        </span>
        <span className="min-w-0">
          <span className="block text-sm leading-5 font-medium">{account.name}</span>
          <span className="mt-0.5 block truncate text-xs leading-4 text-muted">
            {account.email}
          </span>
        </span>
      </button>
    </div>
  );
}
