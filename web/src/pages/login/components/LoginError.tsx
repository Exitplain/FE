import Icon from "@/components/Icon/Icon";

type LoginErrorProps = {
  message?: string;
};

/* 서버 연결 후에도 같은 안내 박스에 인증 오류 메시지를 전달합니다. */
export default function LoginError({
  message = "로그인하지 못했어요 · 네트워크 연결을 확인하고 다시 시도하세요",
}: LoginErrorProps) {
  return (
    <div
      id="login-error"
      role="alert"
      className="login-error flex items-center gap-2 rounded-2xl p-4 text-caption font-medium text-danger"
    >
      <Icon name="status-error" className="size-5 shrink-0" />
      <p className="login-error-message">{message}</p>
    </div>
  );
}
