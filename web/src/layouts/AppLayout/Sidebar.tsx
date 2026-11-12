import { type ReactNode, type RefObject, useEffect, useLayoutEffect, useRef } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";

import logoMark from "@/assets/brand/logo-mark.svg";
import Icon from "@/components/Icon/Icon";
import type { IconName } from "@/components/Icon/iconNames";
import { iconButtonVariants } from "@/components/IconButton/iconButtonVariants";
import { SAMPLE_PROJECTS, type SampleProject } from "@/constants/projects";
import { buildPath, ROUTES } from "@/constants/routes";
import { cn } from "@/utils/cn";

/*
  로그인 후 화면 공통 사이드바 (Figma W01 `Sidebar`, 256px).
  템플릿 단계라 프로젝트 목록과 계정 정보는 정적 예시 값입니다.
  API 가 붙으면 SAMPLE_PROJECTS·SAMPLE_ACCOUNT 를 조회 결과로 바꿉니다.
*/

const SAMPLE_ACCOUNT = { name: "메이커", email: "maker@example.com" } as const;

/*
  치수는 Figma `Sidebar` 컴포넌트(현재=대시보드) 좌표 기준입니다.
  - 항목: x=12, 높이 40, 간격 8, 아이콘 x=32(20px), 글자 x=64 (사이드바 기준 절대 좌표)
  - 선택 안 된 항목·계정 행은 폭 220(오른쪽 24 여백), 선택 표시는 오른쪽 끝까지(244) + Tab corner
  - 글자: 14px Regular #262626, 선택 시 Bold #0a0a0a / 아이콘: #525252, 선택 시 #0a0a0a
*/
const NAV_ICON = "size-5";

/* 선택 표시 이동 시간. styles/index.css 의 sidebar-indicator transition-duration 과 같게 둡니다 */
const MOVE_MS = 300;

const WORKSPACE_ITEMS = [
  { route: ROUTES.dashboard, icon: "dashboard" },
  { route: ROUTES.diagnosisHistory, icon: "history" },
  { route: ROUTES.issues, icon: "flag" },
] as const;

const itemClass = "relative flex h-10 items-center gap-3 pl-5 text-sm text-gray-800";
const idleItemClass = "mr-6 rounded-full hover:bg-surface/50";

/*
  선택 표시가 찾는 항목 표시. 이 속성 + aria-current="page" 인 항목으로 이동합니다.
  aria-current 는 NavLink(워크스페이스) 또는 ProjectNavItem 이 붙입니다.
  값 "sub" 는 하위 메뉴 항목(작은 선택 표시)입니다.
*/
const ITEM_ATTR = "data-sidebar-item";

/*
  선택 항목이 최종적으로 놓일 y.
  경로가 바뀌면 위쪽 하위 메뉴가 접히거나 펴지는 동안(0.3초) 아래 항목 위치가 계속 바뀝니다.
  매 프레임 다시 겨누면 선택 표시가 느리게 따라오므로, 선택 항목보다 위에 있는 하위 메뉴들이
  다 접히고 펴진 뒤의 높이 차이를 미리 더해 처음부터 최종 위치로 한 번 이동합니다.
*/
function finalOffsetTop(container: HTMLElement, active: HTMLElement) {
  /*
    offsetTop 은 정수로 반올림돼 있어 소수 높이와 섞으면 1px 씩 흔들립니다.
    화면 좌표(소수)로 구하고 반올림은 마지막에 한 번만 합니다. aside 가 스크롤되면 그만큼 더합니다.
  */
  let top =
    active.getBoundingClientRect().top -
    container.getBoundingClientRect().top +
    container.scrollTop;
  container.querySelectorAll<HTMLElement>("[data-submenu]").forEach((wrapper) => {
    if (wrapper.contains(active)) return;
    const isAbove = wrapper.compareDocumentPosition(active) & Node.DOCUMENT_POSITION_FOLLOWING;
    if (!isAbove) return;
    const list = wrapper.firstElementChild as HTMLElement | null;
    const finalHeight = wrapper.dataset.open === "true" ? (list?.scrollHeight ?? 0) : 0;
    top += finalHeight - wrapper.getBoundingClientRect().height;
  });
  return Math.round(top);
}

/* 동작 줄이기 설정이면 CSS 가 이동 애니메이션을 끄므로 모서리 크기도 바로 바꿉니다 */
function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

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
  /* 모서리 크기 변경 예약. 경로가 0.3초 안에 다시 바뀌어도 예약이 사라지지 않게 effect 밖에 둡니다 */
  const sizeTimer = useRef<number | undefined>(undefined);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const indicator = indicatorRef.current;
    if (!container || !indicator) return;

    const applySize = (size: string) => {
      window.clearTimeout(sizeTimer.current);
      sizeTimer.current = undefined;
      indicator.dataset.size = size;
    };

    const place = (animate: boolean) => {
      const active = container.querySelector<HTMLElement>(`[${ITEM_ATTR}][aria-current="page"]`);
      const wasVisible = indicator.style.opacity === "1";

      /* 선택 항목이 없는 화면으로 가면 항상 서서히 사라집니다 */
      if (!active) {
        indicator.dataset.animate = String(wasVisible);
        indicator.style.opacity = "0";
        return;
      }

      /*
        nav 는 positioned 가 아니라 offsetParent 가 aside 입니다 (x·높이는 스크롤 보정 불필요, y 는 finalOffsetTop 이 보정).
        하위 메뉴 항목은 더 안쪽·더 낮게 그려지므로 선택된 항목의 시작 x 와 높이를 그대로 따릅니다.
      */
      const transform = `translateY(${finalOffsetTop(container, active)}px)`;
      const left = `${active.offsetLeft}px`;
      const height = `${active.offsetHeight}px`;
      const size = active.getAttribute(ITEM_ATTR) === "sub" ? "sub" : "main";

      /*
        위치가 그대로면 손대지 않습니다. ResizeObserver 는 등록 직후·하위 메뉴가 접히는 동안에도 불리는데,
        여기서 data-animate 를 false 로 덮으면 방금 시작한 이동 애니메이션이 사라집니다.
        다만 예약 없이 모서리 크기만 어긋나 있으면(예약 중 화면이 바뀐 경우) 바로 맞춥니다.
      */
      if (
        wasVisible &&
        indicator.style.transform === transform &&
        indicator.style.left === left &&
        indicator.style.height === height &&
        indicator.dataset.targetSize === size
      ) {
        if (sizeTimer.current === undefined && indicator.dataset.size !== size) applySize(size);
        return;
      }

      /* 숨어 있다가 나타날 때는 위에서 미끄러져 오지 않고 제자리에 나타납니다 */
      const shouldAnimate = animate && wasVisible;
      indicator.dataset.animate = String(shouldAnimate);
      indicator.style.transform = transform;
      indicator.style.left = left;
      indicator.style.height = height;
      indicator.style.opacity = "1";

      /*
        모서리 크기(data-size)는 이동이 끝난 뒤 바꿉니다.
        이동 시작과 함께 바꾸면 이전 자리에서 이미 작은(또는 큰) 모서리로 그려져 0.3초 동안 어긋나 보입니다.
      */
      indicator.dataset.targetSize = size;
      if (shouldAnimate && !prefersReducedMotion() && indicator.dataset.size !== size) {
        window.clearTimeout(sizeTimer.current);
        sizeTimer.current = window.setTimeout(() => applySize(size), MOVE_MS);
      } else {
        applySize(size);
      }
    };

    place(true);

    /*
      크기 변화(글꼴 로딩, 하위 메뉴 접힘·펼침)가 생기면 애니메이션 없이 다시 맞춥니다.
      하위 메뉴가 접히는 동안에는 목표(최종 위치)가 그대로라 아무것도 하지 않습니다.
      nav 만 보면 위 메뉴가 접히고 아래 메뉴가 펴질 때 전체 높이가 그대로라 놓치므로 하위 메뉴도 봅니다.
    */
    const observer = new ResizeObserver(() => place(false));
    container
      .querySelectorAll("nav, [data-submenu]")
      .forEach((element) => observer.observe(element));

    /* 하위 메뉴 접힘·펼침이 끝나면 혹시 남은 차이(반올림 등)를 한 번 더 맞춥니다 */
    /* 중간에 끊긴 전환(transitioncancel)도 같은 보정을 합니다 */
    const onTransitionEnd = (event: TransitionEvent) => {
      if (event.propertyName === "grid-template-rows") place(true);
    };
    container.addEventListener("transitionend", onTransitionEnd);
    container.addEventListener("transitioncancel", onTransitionEnd);

    return () => {
      observer.disconnect();
      container.removeEventListener("transitionend", onTransitionEnd);
      container.removeEventListener("transitioncancel", onTransitionEnd);
    };
    /* pathname 은 본문에서 읽지 않지만, 경로가 바뀔 때 다시 배치하려고 의존성에 둡니다 */
  }, [containerRef, indicatorRef, pathname]);

  /* 사이드바가 사라질 때만 예약을 지웁니다 */
  useEffect(
    () => () => {
      window.clearTimeout(sizeTimer.current);
      sizeTimer.current = undefined;
    },
    [],
  );
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

type SubMenuKey = "tests" | "history" | "issues";

const SUB_MENU: {
  key: SubMenuKey;
  label: string;
  route: "testList" | "projectHistory" | "projectIssues";
}[] = [
  { key: "tests", label: "테스트", route: "testList" },
  { key: "history", label: "진단 기록", route: "projectHistory" },
  { key: "issues", label: "발견한 문제", route: "projectIssues" },
];

/* 프로젝트 경로 뒤쪽(/tests, /runs/..., /history 등)으로 현재 하위 메뉴를 고릅니다 */
function activeSubMenu(rest: string): SubMenuKey | null {
  /*
    "테스트" 메뉴 = 프로젝트 탭(테스트 목록 · 실측 분석 · 보정)과 그 안의 사전 테스트 흐름
    (새 테스트·실행·리포트·세션·재테스트). Figma R01·K01 도 사이드바 선택이 "테스트"에 남습니다.
  */
  if (/^\/(tests|runs|analytics|calibration)(\/|$)/.test(rest)) return "tests";
  if (/^\/history\/?$/.test(rest)) return "history";
  if (/^\/issues\/?$/.test(rest)) return "issues";
  return null;
}

/*
  프로젝트 항목 + 하위 메뉴 (Figma Sidebar `현재=반찬로드 · 테스트` 등)
  - 그 프로젝트 화면(/projects/:id/*)에 있으면 열린 폴더 + 굵은 글자로 바꾸고 하위 메뉴를 펼칩니다.
  - 흰 선택 표시는 하위 메뉴(테스트·진단 기록·발견한 문제)에 두고, 프로젝트 개요에서만
    프로젝트 항목에 둡니다 (Figma `현재=반찬로드 · 개요`).
  - 하위 메뉴는 접고 펼 때 높이가 자연스럽게 바뀌도록 DOM 에 남겨 두고, 접힌 동안은 inert 로
    Tab 이동·화면 낭독기에서 뺍니다.
  치수 (Figma): 하위 항목 x=52 · 높이 36 · 글자 안쪽 20(x=72), 프로젝트 항목과 4px, 다음 프로젝트와 8px
*/
function ProjectNavItem({ project }: { project: SampleProject }) {
  const { pathname } = useLocation();
  const base = buildPath("projectDetail", { projectId: project.id });
  const inProject = pathname === base || pathname.startsWith(`${base}/`);
  const activeKey = inProject ? activeSubMenu(pathname.slice(base.length)) : null;

  return (
    <div className="flex flex-col">
      <Link
        to={base}
        data-sidebar-item="" /* = ITEM_ATTR */
        aria-current={inProject && !activeKey ? "page" : undefined}
        className={cn(itemClass, inProject ? "font-bold text-ink" : idleItemClass)}
      >
        <Icon
          name={inProject ? "folder-open" : "folder"}
          className={cn(NAV_ICON, inProject ? "text-ink" : "text-subtle")}
        />
        {project.name}
      </Link>

      <div
        data-submenu={project.id}
        data-open={inProject}
        inert={!inProject}
        aria-hidden={inProject ? undefined : true}
        className="sidebar-submenu"
      >
        <ul aria-label={`${project.name} 메뉴`} className="flex min-h-0 flex-col overflow-hidden">
          {SUB_MENU.map((item, index) => {
            const active = item.key === activeKey;
            return (
              <li key={item.key} className={index === 0 ? "pt-1" : undefined}>
                <Link
                  to={buildPath(item.route, { projectId: project.id })}
                  data-sidebar-item="sub" /* = ITEM_ATTR, 작은 선택 표시 */
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative ml-10 flex h-9 items-center pl-5 text-sm text-gray-800",
                    active ? "font-bold text-ink" : idleItemClass,
                  )}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
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
          <ProjectNavItem key={project.id} project={project} />
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
