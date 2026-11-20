import AuthButton from "./AuthButton";
import AuthCard from "./AuthCard";

export default function SessionExpiredCard({ onLogin }: { onLogin: () => void }) {
  return (
    <AuthCard title="다시 로그인해 주세요">
      <p className="text-sm leading-normal text-black">
        보안을 위해 로그인이 만료됐어요. 입력 중인 내용은 이 브라우저에 잠시 보관했다가 로그인 후
        이어서 보여줘요
      </p>
      <AuthButton onClick={onLogin}>다시 로그인</AuthButton>
    </AuthCard>
  );
}
