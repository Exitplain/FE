import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { buildPath } from "@/constants/routes";
import { useDemoSessionStore } from "@/stores/useDemoSessionStore";

const VIEWS = ["email", "code", "code-error", "network-error", "loading", "expired"] as const;
type LoginView = (typeof VIEWS)[number];

/* 화면 전환만 담당합니다. BE 테스트 계정 API가 준비되면 이벤트를 인증 mutation으로 교체합니다. */
export function useLoginPrototype(mode: "page" | "dialog" = "page") {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [dialogView, setDialogView] = useState<LoginView>("email");
  const requestedView = mode === "dialog" ? dialogView : params.get("view");
  const view: LoginView = VIEWS.find((view) => view === requestedView) ?? "email";
  const [email, setEmail] = useState(() =>
    requestedView === "network-error" ? "maker@example.com" : "",
  );
  const [code, setCode] = useState("");
  const [resent, setResent] = useState(false);

  function changeView(next: LoginView) {
    if (mode === "dialog") {
      setDialogView(next);
      return;
    }
    setParams((previous) => {
      const nextParams = new URLSearchParams(previous);
      if (next === "email") nextParams.delete("view");
      else nextParams.set("view", next);
      return nextParams;
    });
  }

  function attemptLogin(next: LoginView) {
    // API 연결 전 오류 → 재시도 흐름을 확인하는 일회성 시나리오입니다.
    // 일반 /login에서는 입력 없이 정상 화면 전환을 유지합니다.
    if (mode === "page" && params.get("simulate") === "network-error") {
      setParams((previous) => {
        const nextParams = new URLSearchParams(previous);
        nextParams.delete("simulate");
        nextParams.set("view", "network-error");
        return nextParams;
      });
      return;
    }
    changeView(next);
  }

  // 화면 확인용 이동입니다. 인증 상태나 토큰을 만들지 않습니다.
  useEffect(() => {
    if (view !== "loading") return;
    const timer = window.setTimeout(() => {
      useDemoSessionStore.getState().signIn(email);
      if (mode === "page") navigate(buildPath("dashboard"));
    }, 650);
    return () => window.clearTimeout(timer);
  }, [view, navigate, mode, email]);

  return {
    view,
    email,
    setEmail,
    code,
    setCode,
    resent,
    changeView,
    isVerification: view === "code" || view === "code-error" || view === "loading",
    continueWithEmail: () => attemptLogin("code"),
    completeLogin: () => attemptLogin("loading"),
    resendCode: () => {
      setCode("");
      setResent(true);
      changeView("code");
    },
  };
}
