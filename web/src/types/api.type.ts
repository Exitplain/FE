/*
  BE 오류 응답 형태 (docs/API_SPEC.md 2절, 8절)
  - 개발 API(/api/*):   { "error": "사용자에게 표시할 메시지" }
  - 제품 API(/api/v1): { error: { code, message, fields }, request_id }
  EXITPLAIN BE 는 성공 응답을 별도 래퍼로 감싸지 않습니다. (Allway 의 ApiResponse<T> 없음)
*/

export type DevApiErrorBody = { error: string };

/* fields 는 입력별 메시지 외에 계획 확정 차단 사유(fields.blocking 배열) 같은 값도 담습니다 */
export type ProductApiErrorBody = {
  error: { code: string; message: string; fields?: Record<string, unknown> };
  request_id?: string;
};

/* 제품 API 목록 응답 { items, next_cursor, total } (cursor 기반 페이지) */
export type Page<T> = {
  items: T[];
  next_cursor: string | null;
  total: number;
};

/*
  CSRF 검사 실패. Django 미들웨어가 JSON 이 아닌 HTML 403 을 돌려주므로 BE 코드가 없습니다.
  apis/axiosInstance.ts 가 토큰을 새로 받아 한 번 재시도한 뒤에도 실패하면 이 코드를 붙입니다.
*/
export const CSRF_FAILED = "CSRF_FAILED";

/* apis/axiosInstance.ts 가 두 형태를 이 객체 하나로 바꿉니다 */
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly fields?: Record<string, unknown>;
  /* 제품 API 의 request_id. BE 에 문의할 때 함께 전달합니다 */
  readonly requestId?: string;

  constructor(params: {
    status: number;
    message: string;
    code?: string;
    fields?: Record<string, unknown>;
    requestId?: string;
  }) {
    super(params.message);
    this.name = "ApiError";
    this.status = params.status;
    this.code = params.code;
    this.fields = params.fields;
    this.requestId = params.requestId;
  }
}
