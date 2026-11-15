import Input from "@/components/Input/Input";
import { cn } from "@/utils/cn";

import AuthButton from "./AuthButton";
import GoogleLoginButton from "./GoogleLoginButton";
import LoginError from "./LoginError";

type EmailFormProps = {
  email: string;
  onEmailChange: (email: string) => void;
  /* 코드 요청·구글 로그인 실패 문구 (L10 네트워크 오류 포함) */
  errorMessage: string | null;
  /* 코드 요청 중 */
  pending: boolean;
  onContinue: () => void;
  onGoogleCredential: (credential: string) => void;
};

export default function EmailForm({
  email,
  onEmailChange,
  errorMessage,
  pending,
  onContinue,
  onGoogleCredential,
}: EmailFormProps) {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-6">
        <p className="login-description text-center text-sm leading-normal text-black">
          로그인하면 고객이 어디서, 왜 이탈하는지 진단하고 UX 개선 방향까지 스마트하게 확인할 수
          있습니다.
        </p>
        {errorMessage && <LoginError message={errorMessage} />}
        <form
          noValidate
          aria-busy={pending}
          className={cn("flex flex-col gap-2.5", errorMessage && "mt-4")}
          aria-describedby={errorMessage ? "login-error" : undefined}
          onSubmit={(event) => {
            event.preventDefault();
            onContinue();
          }}
        >
          <label htmlFor="login-email" className="sr-only">
            이메일 주소
          </label>
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            placeholder="이메일 주소를 입력하세요"
            value={email}
            onChange={(event) => onEmailChange(event.target.value)}
            className="h-12.5 rounded-full border border-gray-300 bg-surface px-6 placeholder:text-gray-300"
          />
          <AuthButton type="submit" disabled={pending} muted={!email.trim() || pending}>
            계속
          </AuthButton>
        </form>
      </div>
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-3 text-xs text-muted">
          <span className="h-px flex-1 bg-line" />
          <span className="login-divider-label">또는</span>
          <span className="h-px flex-1 bg-line" />
        </div>
        <GoogleLoginButton onCredential={onGoogleCredential} />
      </div>
    </div>
  );
}
