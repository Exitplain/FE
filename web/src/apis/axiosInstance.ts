import axios, { isAxiosError, type InternalAxiosRequestConfig } from "axios";

import {
  ApiError,
  CSRF_FAILED,
  type DevApiErrorBody,
  type ProductApiErrorBody,
} from "@/types/api.type";

declare module "axios" {
  interface AxiosRequestConfig {
    /* CSRF 토큰을 새로 받아 이미 한 번 재시도한 요청 */
    csrfRetried?: boolean;
  }
}

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || undefined,
  headers: { "Content-Type": "application/json" },
});

/*
  제품 API(/api/v1)는 Django 세션 + CSRF 를 씁니다. (BE backend/exitplain/settings.py)
  - GET /api/v1/auth/csrf 가 토큰을 주고 csrftoken 쿠키를 심습니다.
  - POST·PUT·PATCH·DELETE 는 X-CSRFToken 헤더에 같은 토큰을 보내야 하고, 없으면 HTML 403 입니다.
  - 브라우저에서는 dev 프록시·Vercel rewrite 덕분에 같은 origin 이라 쿠키가 자동으로 실립니다.
  개발 API(/api/personas 등)는 CSRF 를 쓰지 않으므로 손대지 않습니다.
*/
const CSRF_HEADER = "X-CSRFToken";
const CSRF_URL = "/api/v1/auth/csrf";
const UNSAFE_METHODS = new Set(["post", "put", "patch", "delete"]);

let csrfToken: string | null = null;
let csrfRequest: Promise<string | null> | null = null;
/* reset 할 때마다 올립니다. reset 전에 시작한 발급 응답이 새 토큰 자리를 덮어쓰지 못하게 합니다 */
let csrfGeneration = 0;

/* 같은 origin 상대 경로만 대상입니다. 다른 호스트로 토큰이 나가지 않게 합니다 */
function needsCsrf(config: InternalAxiosRequestConfig) {
  const method = (config.method ?? "get").toLowerCase();
  return UNSAFE_METHODS.has(method) && (config.url ?? "").startsWith("/api/v1/");
}

/*
  토큰은 한 번 받아 두고 같이 씁니다. 동시에 여러 요청이 와도 발급 요청은 하나입니다.
  발급에 실패하면(mock 모드에서 BE 가 없을 때 등) 토큰 없이 보내고, 다음 요청에서 다시 받습니다.
  인터셉터를 다시 타지 않도록 axiosInstance 가 아닌 axios 로 부릅니다.
*/
function getCsrfToken() {
  if (csrfToken) return Promise.resolve(csrfToken);
  if (csrfRequest) return csrfRequest;

  const generation = csrfGeneration;
  const request = axios
    .get<{ csrf_token?: string }>(CSRF_URL, { baseURL: axiosInstance.defaults.baseURL })
    .then(({ data }) => {
      const token = data.csrf_token ?? null;
      if (generation === csrfGeneration) csrfToken = token;
      return token;
    })
    .catch(() => null)
    .finally(() => {
      if (csrfRequest === request) csrfRequest = null;
    });
  csrfRequest = request;
  return request;
}

/* 로그인·로그아웃으로 세션이 바뀌면 토큰도 바뀌므로 비웁니다. (테스트 사이에도 사용) */
export function resetCsrfToken() {
  csrfGeneration += 1;
  csrfToken = null;
  csrfRequest = null;
}

/*
  실패한 요청이 보낸 토큰이 지금 토큰과 같을 때만 비웁니다.
  같은 옛 토큰으로 보낸 요청 여러 개가 동시에 403 을 받아도 새 발급은 한 번으로 모입니다.
*/
function invalidateCsrfToken(config: InternalAxiosRequestConfig) {
  const sent = config.headers.get(CSRF_HEADER);
  if (!sent || sent === csrfToken) resetCsrfToken();
}

axiosInstance.interceptors.request.use(async (config) => {
  if (!needsCsrf(config)) return config;
  const token = await getCsrfToken();
  if (token) config.headers.set(CSRF_HEADER, token);
  return config;
});

function isProductErrorBody(data: unknown): data is ProductApiErrorBody {
  const errorField = (data as Partial<ProductApiErrorBody> | undefined)?.error;
  return !!errorField && typeof errorField === "object";
}

/* BE 의 JSON 403(FORBIDDEN 등)은 권한 문제라 재시도하지 않고, 코드 없는 403 만 CSRF 실패로 봅니다 */
function isCsrfFailure(error: unknown) {
  if (!isAxiosError(error) || !error.response || !error.config) return false;
  return (
    error.response.status === 403 &&
    needsCsrf(error.config) &&
    !isProductErrorBody(error.response.data)
  );
}

function toApiError(error: unknown): ApiError {
  if (!isAxiosError(error)) {
    return new ApiError({ status: 0, message: "알 수 없는 오류가 발생했습니다." });
  }

  if (!error.response) {
    return new ApiError({ status: 0, message: "서버에 연결할 수 없습니다." });
  }

  const { status, data } = error.response;

  if (isProductErrorBody(data)) {
    return new ApiError({
      status,
      message: data.error.message,
      code: data.error.code,
      fields: data.error.fields,
      requestId: data.request_id,
    });
  }

  const errorField = (data as Partial<DevApiErrorBody> | undefined)?.error;
  if (typeof errorField === "string") {
    return new ApiError({ status, message: errorField });
  }

  if (isCsrfFailure(error)) {
    return new ApiError({
      status,
      code: CSRF_FAILED,
      message: "보안 확인에 실패했습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.",
    });
  }

  return new ApiError({ status, message: `요청에 실패했습니다. (${status})` });
}

/*
  responseType 이 blob(PDF)·text(Markdown)인 요청은 오류 본문도 Blob·문자열 그대로 옵니다.
  JSON 오류 본문이면 풀어서 다른 요청과 같은 메시지를 쓰게 합니다.
*/
async function parseErrorBody(error: unknown) {
  if (!isAxiosError(error) || !error.response) return;
  const { data } = error.response;
  if (!(data instanceof Blob) && typeof data !== "string") return;
  try {
    error.response.data = JSON.parse(data instanceof Blob ? await data.text() : data);
  } catch {
    /* JSON 이 아니면 상태 코드 기본 문구를 씁니다 */
  }
}

/* 화면에서는 항상 ApiError 만 받도록 오류 형태를 여기 한 곳에서 맞춥니다 */
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    await parseErrorBody(error);

    /* 토큰이 만료·교체됐을 수 있으니 새로 받아 한 번만 다시 보냅니다 */
    if (isCsrfFailure(error) && isAxiosError(error) && error.config && !error.config.csrfRetried) {
      invalidateCsrfToken(error.config);
      return axiosInstance({ ...error.config, csrfRetried: true });
    }

    return Promise.reject(toApiError(error));
  },
);

export default axiosInstance;
