import IconButton from "@/components/IconButton/IconButton";

import { useLoginFlow } from "../hooks/useLoginFlow";
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
  const login = useLoginFlow(mode);
  if (login.step === "expired") return <SessionExpiredCard onLogin={login.restart} />;

  const isVerification = login.step === "code";
  return (
    <AuthCard title={isVerification ? "이메일을 확인하세요" : "로그인 또는 회원가입"}>
      {onClose && (
        <IconButton
          icon="close"
          size="sm"
          label="로그인 창 닫기"
          onClick={onClose}
          className="absolute top-6 right-6"
        />
      )}
      {isVerification ? (
        <VerificationForm
          email={login.email}
          code={login.code}
          onCodeChange={login.setCode}
          errorMessage={login.codeError}
          loading={login.verifying}
          complete={login.codeComplete}
          resent={login.resent}
          resendError={login.resendError}
          cooldown={login.cooldown}
          resending={login.requesting}
          onResend={login.resendCode}
          onSubmit={login.submitCode}
        />
      ) : (
        <EmailForm
          email={login.email}
          onEmailChange={login.setEmail}
          errorMessage={login.emailError}
          pending={login.emailBusy}
          onContinue={login.continueWithEmail}
          onGoogleCredential={login.continueWithGoogle}
        />
      )}
    </AuthCard>
  );
}
