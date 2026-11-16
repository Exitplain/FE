import type { ApiError } from "@/types/api.type";
import { AUTH_ERROR } from "@/types/auth.type";

/* Figma L10 */
export const NETWORK_ERROR_MESSAGE =
  "로그인하지 못했어요 · 네트워크 연결을 확인하고 다시 시도하세요";
/* Figma L04 */
export const CODE_INVALID_MESSAGE = "코드가 맞지 않습니다. 다시 한번 입력해 주세요";

/*
  Figma 에 문구가 있는 경우만 화면 문구를 쓰고, 나머지는 BE 가 내려준 message 를 그대로 보여줍니다.
  (CODE_EXPIRED, CODE_NOT_REQUESTED, TOO_MANY_ATTEMPTS, EMAIL_SEND_FAILED, GOOGLE_TOKEN_INVALID, VALIDATION_ERROR 등)
*/
export function getAuthErrorMessage(error: ApiError) {
  if (error.status === 0) return NETWORK_ERROR_MESSAGE;
  if (error.code === AUTH_ERROR.CODE_INVALID) return CODE_INVALID_MESSAGE;
  return error.message;
}

/* 429 RESEND_TOO_SOON 의 남은 초 (fields.retry_after). 없거나 이상하면 0 */
export function getRetryAfter(error: ApiError) {
  if (error.code !== AUTH_ERROR.RESEND_TOO_SOON) return 0;
  const seconds = Number(error.fields?.retry_after);
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : 0;
}

/* Figma L03 "0:42 후 ·코드 재전송" 의 m:ss */
export function formatCooldown(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
