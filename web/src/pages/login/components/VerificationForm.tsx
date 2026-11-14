import AuthButton from "./AuthButton";
import CodeInput from "./CodeInput";

type VerificationFormProps = {
  email: string;
  code: string;
  onCodeChange: (code: string) => void;
  error: boolean;
  loading: boolean;
  resent: boolean;
  onResend: () => void;
  onSubmit: () => void;
};

export default function VerificationForm({
  email,
  code,
  onCodeChange,
  error,
  loading,
  resent,
  onResend,
  onSubmit,
}: VerificationFormProps) {
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
            코드가 맞지 않습니다. 다시 한번 입력해 주세요
          </p>
        )}
        <AuthButton type="submit" disabled={loading} muted={!code.trim() || loading}>
          {loading ? "로그인 중…" : "로그인"}
        </AuthButton>
      </form>
      {!loading && (
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-caption text-gray-700">
          {!error && <span>코드가 아직 안왔나요?</span>}
          <button
            type="button"
            onClick={onResend}
            className="rounded hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
          >
            코드 재전송
          </button>
          {resent && (
            <p role="status" className="w-full text-center">
              코드를 다시 보냈어요
            </p>
          )}
        </div>
      )}
    </div>
  );
}
