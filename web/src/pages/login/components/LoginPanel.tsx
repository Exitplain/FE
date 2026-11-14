import IconButton from "@/components/IconButton/IconButton";

import { useLoginPrototype } from "../hooks/useLoginPrototype";
import AuthCard from "./AuthCard";
import EmailForm from "./EmailForm";
import SessionExpiredCard from "./SessionExpiredCard";
import VerificationForm from "./VerificationForm";

/* 단독 페이지와 모달에서 같은 폼과 화면 전환을 재사용합니다. */
export default function LoginPanel({
  mode = "page",
  onClose,
}: {
  mode?: "page" | "dialog";
  onClose?: () => void;
}) {
  const login = useLoginPrototype(mode);
  if (login.view === "expired")
    return <SessionExpiredCard onLogin={() => login.changeView("email")} />;

  return (
    <AuthCard title={login.isVerification ? "이메일을 확인하세요" : "로그인 또는 회원가입"}>
      {onClose && (
        <IconButton
          icon="close"
          size="sm"
          label="로그인 창 닫기"
          onClick={onClose}
          className="absolute top-6 right-6"
        />
      )}
      {login.isVerification ? (
        <VerificationForm
          email={login.email || "maker@example.com"}
          code={login.code}
          onCodeChange={login.setCode}
          error={login.view === "code-error"}
          loading={login.view === "loading"}
          resent={login.resent}
          onResend={login.resendCode}
          onSubmit={login.completeLogin}
        />
      ) : (
        <EmailForm
          email={login.email}
          onEmailChange={login.setEmail}
          networkError={login.view === "network-error"}
          onContinue={login.continueWithEmail}
          onGoogle={login.completeLogin}
        />
      )}
    </AuthCard>
  );
}
