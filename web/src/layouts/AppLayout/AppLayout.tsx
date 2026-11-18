import { useEffect } from "react";
import { Outlet, useSearchParams } from "react-router-dom";

import MeshBackground from "@/components/MeshBackground/MeshBackground";
import ProjectCreateDialogHost from "@/components/Projects/ProjectCreateDialogHost";
import { useAuthSession } from "@/hooks/useAuthSession";
import { useSessionExpiry } from "@/hooks/useSessionExpiry";
import AuthDialog from "@/pages/login/components/AuthDialog";
import { useDemoSessionStore } from "@/stores/useDemoSessionStore";

import Sidebar from "./Sidebar";

/*
  로그인 후 화면 공통 레이아웃 (Figma W01 기준)
  메쉬 배경 위에 사이드바(256px, 투명) + 흰 작업 영역(Surface/Work).
  화면마다 바뀌는 것은 <Outlet /> 자리의 페이지 컴포넌트뿐입니다.
*/
export default function AppLayout() {
  const [params, setParams] = useSearchParams();
  /* 들어올 때 서버 세션으로 사이드바 계정 표시를 맞춥니다. 조회에 실패하면 지금 표시를 유지합니다 */
  const { data: session } = useAuthSession();
  useSessionExpiry(session);
  useEffect(() => {
    if (params.get("auth") !== "expired") return;
    useDemoSessionStore.getState().expire();
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.delete("auth");
        return next;
      },
      { replace: true },
    );
  }, [params, setParams]);
  return (
    <div className="grid min-h-full grid-cols-[var(--spacing-sidebar)_minmax(0,1fr)]">
      <MeshBackground />
      <Sidebar />
      <main className="min-w-0 bg-surface p-10 shadow-surface">
        <Outlet />
      </main>
      <AuthDialog />
      <ProjectCreateDialogHost />
    </div>
  );
}
