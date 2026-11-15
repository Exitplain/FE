import type { AuthSession, EmailVerifyRequest } from "@/types/auth.type";

import axiosInstance from "./axiosInstance";

/* 로그인 상태 (L08·L09). 로그인하지 않았으면 200 { authenticated: false } 입니다 */
export async function getSession(): Promise<AuthSession> {
  const { data } = await axiosInstance.get<AuthSession>("/api/v1/auth/session");
  return data;
}

/* 구글 로그인 (L01). Google Identity Services 가 준 credential 을 id_token 으로 보냅니다 */
export async function loginWithGoogle(idToken: string): Promise<AuthSession> {
  const { data } = await axiosInstance.post<AuthSession>("/api/v1/auth/google", {
    id_token: idToken,
  });
  return data;
}

/* 이메일 코드 요청 (L02). 202 로 끝나고 본문은 없습니다 */
export async function requestEmailCode(email: string): Promise<void> {
  await axiosInstance.post("/api/v1/auth/email/request", { email });
}

/* 이메일 코드 확인 (L03~L05). 성공 응답은 구글 로그인과 같은 세션 정보입니다 */
export async function verifyEmailCode(body: EmailVerifyRequest): Promise<AuthSession> {
  const { data } = await axiosInstance.post<AuthSession>("/api/v1/auth/email/verify", body);
  return data;
}

/* 로그아웃 (L08). 204 */
export async function logout(): Promise<void> {
  await axiosInstance.post("/api/v1/auth/logout");
}
