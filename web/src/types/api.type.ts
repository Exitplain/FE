/*
  BE 오류 응답 형태 (docs/API_SPEC.md 2절, 8절)
  - 개발 API(/api/*):   { "error": "사용자에게 표시할 메시지" }
  - 제품 API(/api/v1): { error: { code, message, fields }, request_id }
  EXITPLAIN BE 는 성공 응답을 별도 래퍼로 감싸지 않습니다. (Allway 의 ApiResponse<T> 없음)
*/

export type DevApiErrorBody = { error: string };

export type ProductApiErrorBody = {
  error: { code: string; message: string; fields?: Record<string, string> };
  request_id?: string;
};

/* apis/axiosInstance.ts 가 두 형태를 이 객체 하나로 바꿉니다 */
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly fields?: Record<string, string>;

  constructor(params: {
    status: number;
    message: string;
    code?: string;
    fields?: Record<string, string>;
  }) {
    super(params.message);
    this.name = "ApiError";
    this.status = params.status;
    this.code = params.code;
    this.fields = params.fields;
  }
}
