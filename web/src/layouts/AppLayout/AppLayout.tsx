import { useEffect } from "react";
import { Outlet, useSearchParams } from "react-router-dom";

import MeshBackground from "@/components/MeshBackground/MeshBackground";
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
    </div>
  );
}
