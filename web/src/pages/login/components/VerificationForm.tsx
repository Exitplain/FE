import { formatCooldown } from "../authErrors";
import AuthButton from "./AuthButton";
import CodeInput from "./CodeInput";

type VerificationFormProps = {
  email: string;
  code: string;
  onCodeChange: (code: string) => void;
  /* L04 코드 오류 등. 없으면 null */
  errorMessage: string | null;
  /* L05 로그인 중 */
  loading: boolean;
  /* 6자리를 모두 입력했는지 */
  complete: boolean;
  resent: boolean;
  /* 재전송 실패 문구 (503 EMAIL_SEND_FAILED 등). 코드 오류와 달리 입력칸을 오류로 표시하지 않습니다 */
  resendError: string | null;
  /* 재전송까지 남은 초 (L03 "0:42 후 ·코드 재전송") */
  cooldown: number;
  resending: boolean;
  onResend: () => void;
  onSubmit: () => void;
};

export default function VerificationForm({
  email,
  code,
  onCodeChange,
  errorMessage,
  loading,
  complete,
  resent,
  resendError,
  cooldown,
  resending,
  onResend,
  onSubmit,
}: VerificationFormProps) {
  const error = !!errorMessage;
  return (
    <div className="flex flex-col gap-6">
      <p className="text-center text-sm leading-normal break-words text-gray-700">
        {email}으로 보낸 6자리 코드를 입력하세요
      </p>
      <form
        noValidate
        aria-busy={loading}
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <CodeInput value={code} onChange={onCodeChange} error={error} disabled={loading} />
        {error && (
          <p id="code-error" role="alert" className="text-center text-caption text-danger">
            {errorMessage}
          </p>
        )}
        <AuthButton type="submit" disabled={loading} muted={!complete || loading}>
          {loading ? "로그인 중…" : "로그인"}
        </AuthButton>
      </form>
      {!loading && (
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-caption text-gray-700">
          {!error && <span>코드가 아직 안왔나요?</span>}
          <button
            type="button"
            onClick={onResend}
            disabled={cooldown > 0 || resending}
            className="rounded hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink disabled:cursor-not-allowed disabled:hover:text-gray-700"
          >
            {cooldown > 0 ? `${formatCooldown(cooldown)} 후 ·코드 재전송` : "코드 재전송"}
          </button>
          {resent && (
            <p role="status" className="w-full text-center">
              코드를 다시 보냈어요
            </p>
          )}
          {resendError && (
            <p role="alert" className="w-full text-center text-danger">
              {resendError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
