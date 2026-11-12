import { type ReactNode, type RefObject, useLayoutEffect, useRef } from "react";
import { generatePath, Link, NavLink, useLocation } from "react-router-dom";

import logoMark from "@/assets/brand/logo-mark.svg";
import Icon from "@/components/Icon/Icon";
import type { IconName } from "@/components/Icon/iconNames";
import { iconButtonVariants } from "@/components/IconButton/iconButtonVariants";
import { ROUTES } from "@/constants/routes";
import { cn } from "@/utils/cn";

/*
  로그인 후 화면 공통 사이드바 (Figma W01 `Sidebar`, 256px).
  템플릿 단계라 프로젝트 목록과 계정 정보는 정적 예시 값입니다.
  API 가 붙으면 SAMPLE_PROJECTS·SAMPLE_ACCOUNT 를 조회 결과로 바꿉니다.
*/

const SAMPLE_PROJECTS = [
  { id: "banchan", name: "반찬로드" },
  { id: "studio", name: "스튜디오 예약" },
  { id: "phone", name: "중고폰 매입" },
] as const;

const SAMPLE_ACCOUNT = { name: "메이커", email: "maker@example.com" } as const;

/*
  치수는 Figma `Sidebar` 컴포넌트(현재=대시보드) 좌표 기준입니다.
  - 항목: x=12, 높이 40, 간격 8, 아이콘 x=32(20px), 글자 x=64 (사이드바 기준 절대 좌표)
  - 선택 안 된 항목·계정 행은 폭 220(오른쪽 24 여백), 선택 표시는 오른쪽 끝까지(244) + Tab corner
  - 글자: 14px Regular #262626, 선택 시 Bold #0a0a0a / 아이콘: #525252, 선택 시 #0a0a0a
*/
const NAV_ICON = "size-5";

const WORKSPACE_ITEMS = [
  { route: ROUTES.dashboard, icon: "dashboard" },
  { route: ROUTES.diagnosisHistory, icon: "history" },
  { route: ROUTES.issues, icon: "flag" },
] as const;

const itemClass = "relative flex h-10 items-center gap-3 pl-5 text-sm text-gray-800";
const idleItemClass = "mr-6 rounded-full hover:bg-surface/50";

/* 선택 표시가 찾는 항목 표시. 이 속성 + aria-current="page"(NavLink 가 붙임) 인 항목으로 이동합니다 */
const ITEM_ATTR = "data-sidebar-item";

/*
  선택된 항목 위치로 흰 pill 을 옮깁니다.
  리렌더 없이 DOM style 만 바꿉니다. 경로가 바뀌면 이동하고, 크기가 바뀌면(글꼴 로딩 등) 바로 맞춥니다.
  선택된 항목이 없는 화면(/projects, /settings 등)에서는 숨깁니다.
*/
function useSidebarIndicator(
  containerRef: RefObject<HTMLElement | null>,
  indicatorRef: RefObject<HTMLElement | null>,
) {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    const container = containerRef.current;
    const indicator = indicatorRef.current;
    if (!container || !indicator) return;

    const place = (animate: boolean) => {
      const active = container.querySelector<HTMLElement>(`[${ITEM_ATTR}][aria-current="page"]`);
      const wasVisible = indicator.style.opacity === "1";

      /* 선택 항목이 없는 화면으로 가면 항상 서서히 사라집니다 */
      if (!active) {
        indicator.dataset.animate = String(wasVisible);
        indicator.style.opacity = "0";
        return;
      }

      /* nav 는 positioned 가 아니라 offsetParent 가 aside 입니다 (스크롤 보정 불필요) */
      const top = active.offsetTop;
      const transform = `translateY(${top}px)`;

      /*
        위치가 그대로면 손대지 않습니다. ResizeObserver 는 등록 직후에도 한 번 불리는데,
        여기서 data-animate 를 false 로 덮으면 방금 시작한 이동 애니메이션이 사라집니다.
      */
      if (wasVisible && indicator.style.transform === transform) return;

      /* 숨어 있다가 나타날 때는 위에서 미끄러져 오지 않고 제자리에 나타납니다 */
      indicator.dataset.animate = String(animate && wasVisible);
      indicator.style.transform = transform;
      indicator.style.opacity = "1";
    };

    place(true);

    /* 글꼴 로딩 등으로 항목 위치가 바뀌면 애니메이션 없이 다시 맞춥니다 */
    const observer = new ResizeObserver(() => place(false));
    container.querySelectorAll("nav").forEach((nav) => observer.observe(nav));
    return () => observer.disconnect();
    /* pathname 은 본문에서 읽지 않지만, 경로가 바뀔 때 다시 배치하려고 의존성에 둡니다 */
  }, [containerRef, indicatorRef, pathname]);
}

function SidebarLink({ to, icon, children }: { to: string; icon: IconName; children: ReactNode }) {
  return (
    <NavLink
      to={to}
      data-sidebar-item="" /* = ITEM_ATTR */
      /* "/" 만 정확히 일치. 프로젝트는 하위 경로(/tests, /analytics 등)에서도 선택 상태 유지 */
      end={to === ROUTES.dashboard.path}
      className={({ isActive }) =>
        /* 선택된 항목의 흰 배경은 아래 선택 표시(indicator)가 그립니다 */
        cn(itemClass, isActive ? "font-bold text-ink" : idleItemClass)
      }
    >
      {({ isActive }) => (
        <>
          <Icon name={icon} className={cn(NAV_ICON, isActive ? "text-ink" : "text-subtle")} />
          {children}
        </>
      )}
    </NavLink>
  );
}

/* 그룹 라벨: x=24, 12px Medium #737373, 줄 높이 16 (Figma Group label) */
function Caption({ children }: { children: ReactNode }) {
  return <p className="pl-3 text-xs leading-4 font-medium text-muted">{children}</p>;
}

export default function Sidebar() {
  const asideRef = useRef<HTMLElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  useSidebarIndicator(asideRef, indicatorRef);

  return (
    <aside
      ref={asideRef}
      className="sticky top-0 scrollbar-none flex h-dvh flex-col overflow-y-auto pt-9 pb-6 pl-3"
    >
      {/*
        선택 표시: x=12 부터 오른쪽 끝까지, 높이 40. 항목(relative)보다 뒤에 그려집니다.
        위치·투명도·data-animate 는 useSidebarIndicator 가 DOM 에 직접 씁니다.
        이 span 에 key, style, 바뀌는 data-animate prop 을 붙이면 React 가 값을 덮어써 애니메이션이 깨집니다.
      */}
      <span
        ref={indicatorRef}
        aria-hidden
        data-animate="false"
        className="pointer-events-none sidebar-indicator absolute top-0 right-0 left-3 h-10 rounded-l-full bg-surface opacity-0"
      />

      {/* 로고: x=24, y=36, 마크 37×36, 글자까지 3px */}
      <Link to={ROUTES.dashboard.path} className="flex h-9 items-center gap-0.75 pl-3">
        <img src={logoMark} alt="" className="h-9 w-auto" />
        <span className="font-logo text-2xl leading-9 text-black">EXITPLAIN</span>
      </Link>

      {/* 로고 하단 72 → 라벨 104~120 → 첫 항목 124 */}
      <div className="mt-8">
        <Caption>워크스페이스</Caption>
      </div>
      <nav aria-label="워크스페이스" className="mt-1 flex flex-col gap-2">
        {WORKSPACE_ITEMS.map(({ route, icon }) => (
          <SidebarLink key={route.path} to={route.path} icon={icon}>
            {route.title}
          </SidebarLink>
        ))}
      </nav>

      {/* 마지막 항목 하단 260 → 행 280~312: 라벨 292~308, 검색 버튼(32×32) 281~313 (Figma 처럼 첫 항목과 1px 겹침) */}
      <div className="mt-5 mr-6 flex h-8 items-start justify-between">
        <div className="pt-3">
          <Caption>{ROUTES.projectList.title}</Caption>
        </div>
        {/* C02 프로젝트 찾기 */}
        <Link
          to={ROUTES.projectList.path}
          aria-label="프로젝트 찾기"
          className={cn(iconButtonVariants({ size: "md" }), "mt-px text-muted")}
        >
          <Icon name="search" />
        </Link>
      </div>
      <nav aria-label="프로젝트" className="flex flex-col gap-2">
        {SAMPLE_PROJECTS.map((project) => (
          <SidebarLink
            key={project.id}
            to={generatePath(ROUTES.projectDetail.path, { projectId: project.id })}
            icon="folder"
          >
            {project.name}
          </SidebarLink>
        ))}
        {/* C03 새 프로젝트 모달은 프로젝트 화면에서 엽니다 */}
        <Link to={ROUTES.projectList.path} className={cn(itemClass, idleItemClass, "text-subtle")}>
          <Icon name="plus" className={NAV_ICON} />새 프로젝트
        </Link>
      </nav>

      <div className="mt-auto pt-8">
        {/*
          Figma 에는 없는 임시 링크입니다. Figma 에서는 계정 메뉴(계정 → 설정 / 시작 가이드 / 로그아웃)로
          들어가며, 메뉴를 만들 때 이 줄을 지웁니다. 지금은 경로만 닿도록 둡니다.
        */}
        <nav aria-label="계정" className="mb-2 flex gap-4 pl-6 text-xs text-muted">
          <Link to={ROUTES.settings.path} className="hover:text-ink">
            {ROUTES.settings.title}
          </Link>
          <Link to={ROUTES.guide.path} className="hover:text-ink">
            {ROUTES.guide.title}
          </Link>
        </nav>
        {/*
          AccountRow: x=12, 폭 220, 높이 48, 아래 여백 24.
          아바타 32(#999, "메" 13px Bold)와 이름(14px Medium)은 행 위에서 8px, 이메일(12px #737373)은 이름 아래 2px
        */}
        <div className="mr-6 flex h-12 items-start gap-3 px-3 pt-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-avatar text-caption font-bold text-ink">
            {SAMPLE_ACCOUNT.name.slice(0, 1)}
          </span>
          <div className="min-w-0">
            <p className="text-sm leading-5 font-medium">{SAMPLE_ACCOUNT.name}</p>
            <p className="mt-0.5 truncate text-xs leading-4 text-muted">{SAMPLE_ACCOUNT.email}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
