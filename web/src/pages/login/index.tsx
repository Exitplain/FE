import authBackground from "@/assets/login/auth-background.svg?no-inline";

import LoginPanel from "./components/LoginPanel";

import "./login.css";

export default function LoginPage() {
  return (
    <main
      className="login-page flex flex-col items-center justify-center"
      aria-label="로그인"
      style={{ backgroundImage: `url("${authBackground}")` }}
    >
      <LoginPanel />
    </main>
  );
}
