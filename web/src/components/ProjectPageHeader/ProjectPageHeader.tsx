import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { buildPath } from "@/constants/routes";
import { cn } from "@/utils/cn";

export type ProjectTab = "tests" | "analytics" | "calibration";

const TABS: { key: ProjectTab; label: string; route: "testList" | "analytics" | "calibration" }[] =
  [
    { key: "tests", label: "테스트 목록", route: "testList" },
    { key: "analytics", label: "실측 분석", route: "analytics" },
    { key: "calibration", label: "보정", route: "calibration" },
  ];

type ProjectPageHeaderProps = {
  projectId: string;
  /* 위쪽 회색 경로 (예: "반찬로드 · 테스트", "반찬로드 / 사전 테스트 · 테스트") */
  breadcrumb: string;
  title: string;
  /* 제목 아래 한 줄 (사이트 주소, 실행 조건 등) */
  description?: ReactNode;
  /* 제목 오른쪽 (버튼, 상태 배지) */
  actions?: ReactNode;
  activeTab: ProjectTab;
};

/*
  Figma 프로젝트 화면 머리말(`PageHeader` + `DS/Tabs/Project`) — P01~P11, R·K 화면 공통.
  사전 테스트 흐름(P02~P11)도 "테스트 목록" 탭 안의 화면이라 activeTab="tests" 로 둡니다.
*/
export default function ProjectPageHeader({
  projectId,
  breadcrumb,
  title,
  description,
  actions,
  activeTab,
}: ProjectPageHeaderProps) {
  return (
    <header className="flex flex-col gap-4">
      <p className="text-xs text-muted">{breadcrumb}</p>
      <div className="flex min-h-10 items-center gap-3">
        <h1 className="flex-1 text-2xl font-bold text-ink">{title}</h1>
        {actions != null && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {description != null && <p className="text-sm text-subtle">{description}</p>}
      <nav aria-label="프로젝트 메뉴" className="flex gap-6 border-b border-line">
        {TABS.map((tab) => {
          const active = tab.key === activeTab;
          return (
            <Link
              key={tab.key}
              to={buildPath(tab.route, { projectId })}
              aria-current={active ? "page" : undefined}
              className={cn(
                "-mb-px flex min-h-12 items-center border-b-2 text-sm",
                active ? "border-ink font-bold text-ink" : "border-transparent text-subtle",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
