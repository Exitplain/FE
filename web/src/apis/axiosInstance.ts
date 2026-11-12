import axios, { isAxiosError } from "axios";

import { ApiError, type DevApiErrorBody, type ProductApiErrorBody } from "@/types/api.type";

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || undefined,
  headers: { "Content-Type": "application/json" },
});

function toApiError(error: unknown): ApiError {
  if (!isAxiosError(error)) {
    return new ApiError({ status: 0, message: "알 수 없는 오류가 발생했습니다." });
  }

  if (!error.response) {
    return new ApiError({ status: 0, message: "서버에 연결할 수 없습니다." });
  }

  const { status, data } = error.response;
  const body = data as Partial<DevApiErrorBody> | Partial<ProductApiErrorBody> | undefined;
  const errorField = body?.error;

  if (typeof errorField === "string") {
    return new ApiError({ status, message: errorField });
  }

  if (errorField && typeof errorField === "object") {
    return new ApiError({
      status,
      message: errorField.message,
      code: errorField.code,
      fields: errorField.fields,
    });
  }

  return new ApiError({ status, message: `요청에 실패했습니다. (${status})` });
}

/* 화면에서는 항상 ApiError 만 받도록 오류 형태를 여기 한 곳에서 맞춥니다 */
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(toApiError(error)),
);

export default axiosInstance;
