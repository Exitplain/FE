import { NavLink, Outlet } from "react-router-dom";

import { ROUTES } from "@/constants/routes";
import { cn } from "@/utils/cn";

const NAV_ITEMS = [
  ROUTES.dashboard,
  ROUTES.diagnosisHistory,
  ROUTES.issues,
  ROUTES.projectList,
  ROUTES.newTest,
] as const;

const FOOTER_ITEMS = [ROUTES.settings, ROUTES.guide] as const;

function NavItem({ path, title }: { path: string; title: string }) {
  return (
    <NavLink
      to={path}
      end={path === "/"}
      className={({ isActive }) =>
        cn(
          "flex h-10 items-center rounded-lg px-3 text-sm text-gray-900 hover:bg-surface/40",
          isActive && "bg-surface/30 font-semibold text-ink",
        )
      }
    >
      {title}
    </NavLink>
  );
}

/* 로그인 후 화면 공통 레이아웃 — 사이드바(257px) + 흰 작업 영역 (Figma W01 기준) */
export default function AppLayout() {
  return (
    <div className="grid min-h-full grid-cols-[var(--spacing-sidebar)_minmax(0,1fr)]">
      <aside className="flex flex-col px-6 pt-10 pb-6">
        <NavLink to="/" className="mb-9 flex items-center gap-1">
          <img src="/logo.svg" alt="" className="size-9" />
          <span className="font-logo text-2xl">EXITPLAIN</span>
        </NavLink>
        <nav className="flex flex-col gap-2">
          {NAV_ITEMS.map((item) => (
            <NavItem key={item.path} path={item.path} title={item.title} />
          ))}
        </nav>
        <nav className="mt-auto flex flex-col gap-2 pt-8">
          {FOOTER_ITEMS.map((item) => (
            <NavItem key={item.path} path={item.path} title={item.title} />
          ))}
        </nav>
      </aside>
      <main className="min-w-0 bg-surface px-10 py-8">
        <Outlet />
      </main>
    </div>
  );
}
