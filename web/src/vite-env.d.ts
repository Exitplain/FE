/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_API_PROXY_TARGET?: string;
  readonly VITE_USE_MOCK_API?: "true" | "false";
  /* Google Identity Services 클라이언트 ID. 비어 있으면 구글 로그인 버튼을 비활성화합니다 */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
