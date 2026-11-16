import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { loginWithGoogle, requestEmailCode, verifyEmailCode } from "@/apis/auth.api";
import { buildPath } from "@/constants/routes";
import { useApplySession } from "@/hooks/useAuthSession";
import { useDemoSessionStore } from "@/stores/useDemoSessionStore";
import type { ApiError } from "@/types/api.type";
import type { AuthSession, EmailVerifyRequest } from "@/types/auth.type";

import { getAuthErrorMessage, getRetryAfter } from "../authErrors";
import { useCooldown } from "./useCooldown";

type LoginStep = "email" | "code" | "expired";

/*
  로그인 화면 흐름 (L01~L05, L10). 단독 페이지와 모달이 같은 훅을 씁니다.
  - email: 이메일 입력·구글 로그인 → 코드 요청(202)이면 code 로
  - code: 6자리 코드 확인 → 성공하면 세션을 채우고 페이지는 대시보드로, 모달은 닫습니다
  - expired: /login?view=expired 로 들어온 세션 만료 안내 (L09)
*/
export function useLoginFlow(mode: "page" | "dialog" = "page") {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const applySession = useApplySession();
  const cooldown = useCooldown();

  const [step, setStep] = useState<LoginStep>(() =>
    mode === "page" && params.get("view") === "expired" ? "expired" : "email",
  );
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  /* 재전송 실패는 코드 오류(입력칸 빨간 테두리)와 따로 보여줍니다 */
  const [resendError, setResendError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

  /*
    세션 반영은 훅 옵션의 onSuccess 에 둡니다. 응답 전에 모달을 닫아 이 훅이 사라져도 실행돼,
    서버는 로그인됐는데 화면만 비로그인으로 남는 일이 없습니다. 화면 이동만 mutate 콜백에서 합니다.
  */
  const requestCode = useMutation<void, ApiError, string>({ mutationFn: requestEmailCode });
  const verify = useMutation<AuthSession, ApiError, EmailVerifyRequest>({
    mutationFn: verifyEmailCode,
    onSuccess: applySession,
  });
  const google = useMutation<AuthSession, ApiError, string>({
    mutationFn: loginWithGoogle,
    onSuccess: applySession,
  });
  const signingIn = verify.isPending || google.isPending;

  function finish() {
    if (mode === "page") navigate(buildPath("dashboard"));
    else useDemoSessionStore.getState().closeDialog();
  }

  /* 이미 코드를 보낸 직후라 429 가 오면, 받은 코드를 입력할 수 있게 코드 화면으로 넘어갑니다 */
  function handleResendTooSoon(error: ApiError) {
    const seconds = getRetryAfter(error);
    if (!seconds) return false;
    cooldown.start(seconds);
    setStep("code");
    return true;
  }

  function continueWithEmail() {
    const target = email.trim();
    if (!target || requestCode.isPending || signingIn) return;
    setEmailError(null);
    requestCode.mutate(target, {
      onSuccess: () => {
        setEmail(target);
        setCode("");
        setCodeError(null);
        setResendError(null);
        setResent(false);
        setStep("code");
      },
      onError: (error) => {
        if (handleResendTooSoon(error)) {
          setEmail(target);
          return;
        }
        setEmailError(getAuthErrorMessage(error));
      },
    });
  }

  function resendCode() {
    if (cooldown.remaining > 0 || requestCode.isPending) return;
    setResent(false);
    setResendError(null);
    requestCode.mutate(email, {
      onSuccess: () => {
        setCode("");
        setCodeError(null);
        setResent(true);
      },
      onError: (error) => {
        if (!handleResendTooSoon(error)) setResendError(getAuthErrorMessage(error));
      },
    });
  }

  function submitCode() {
    /* CodeInput 은 빈 칸을 공백으로 채운 6글자라 공백을 빼고 보냅니다 */
    const digits = code.replace(/\s/g, "");
    if (digits.length !== 6 || verify.isPending) return;
    setCodeError(null);
    setResendError(null);
    setResent(false);
    verify.mutate(
      { email, code: digits },
      {
        onSuccess: finish,
        onError: (error) => setCodeError(getAuthErrorMessage(error)),
      },
    );
  }

  function continueWithGoogle(credential: string) {
    if (signingIn || requestCode.isPending) return;
    setEmailError(null);
    google.mutate(credential, {
      onSuccess: finish,
      onError: (error) => setEmailError(getAuthErrorMessage(error)),
    });
  }

  return {
    step,
    email,
    setEmail,
    code,
    setCode,
    emailError,
    codeError,
    resendError,
    resent,
    cooldown: cooldown.remaining,
    requesting: requestCode.isPending,
    /* 코드 요청이나 구글 로그인이 진행 중이면 이메일 화면의 버튼을 막습니다 */
    emailBusy: requestCode.isPending || google.isPending,
    verifying: verify.isPending || verify.isSuccess,
    codeComplete: code.replace(/\s/g, "").length === 6,
    continueWithEmail,
    resendCode,
    submitCode,
    continueWithGoogle,
    restart: () => {
      setStep("email");
      /* 새로고침했을 때 만료 안내가 다시 나오지 않게 주소의 view 를 지웁니다 */
      if (mode === "page" && params.has("view"))
        setParams(
          (previous) => {
            const next = new URLSearchParams(previous);
            next.delete("view");
            return next;
          },
          { replace: true },
        );
    },
  };
}
