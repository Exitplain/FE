import { Outlet } from "react-router-dom";

/* 사이드바가 없는 화면 레이아웃 — 로그인(L) */
export default function AuthLayout() {
  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <div className="w-full max-w-3xl">
        <Outlet />
      </div>
    </div>
  );
}
