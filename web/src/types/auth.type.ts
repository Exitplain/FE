/*
  로그인 API (/api/v1/auth/*) 타입. BE 필드 이름(snake_case)을 그대로 씁니다.
  비로그인 세션은 401 이 아니라 200 { authenticated: false } 로 옵니다. 이때 user·workspace 는 없습니다.
  user·workspace 의 세부 필드는 명세에 아직 없어서, 화면에서 쓰는 값만 느슨하게 둡니다.
*/
export type AuthUser = {
  id?: number | string;
  email: string;
  name?: string | null;
};

export type AuthWorkspace = {
  id: number | string;
  name?: string | null;
};

export type AuthSession = {
  authenticated: boolean;
  user?: AuthUser | null;
  workspace?: AuthWorkspace | null;
  session_expires_at?: string | null;
};

export type EmailVerifyRequest = { email: string; code: string };

/* 화면이 직접 분기하는 BE 오류 코드. 나머지는 BE 의 message 를 그대로 보여줍니다 */
export const AUTH_ERROR = {
  RESEND_TOO_SOON: "RESEND_TOO_SOON",
  CODE_INVALID: "CODE_INVALID",
  AUTH_REQUIRED: "AUTH_REQUIRED",
} as const;
