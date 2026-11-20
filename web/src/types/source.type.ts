import type { DiscoveryProgressEvent } from "./plan.type";

/*
  코드 연결 (BE sources · 기능명세서 SRC-01~03). 코드는 읽기만 하고 서버에서 실행하지 않습니다.
  POST /api/v1/projects/{id}/source-snapshots → 202 (state "running"), GET /api/v1/source-snapshots/{id} 로 진행·결과.
*/
export type SourceState = "running" | "ready" | "failed";
/* static: URL 없이 미리보기로 열 수 있음 · needs_build: 빌드가 필요해 코드 분석만 · unknown: 판단 불가 */
export type SourceRunnable = "static" | "needs_build" | "unknown";

export type SourceRoute = { pattern: string; file: string; line: number; dynamic: boolean };

export type SourceSnapshot = {
  id: string;
  project_id: number;
  connection_id: number;
  provider: "zip" | "git";
  repository_url: string;
  connection_status: "active" | "revoked";
  ref: string;
  commit_sha: string;
  subdirectory: string;
  tree_digest: string;
  state: SourceState;
  runnable: SourceRunnable;
  static_root: string;
  file_count: number;
  total_bytes: number;
  /* 저장하지 않은 파일 수 (이유별): secret_like · excluded_dir · too_large · unsafe_path · symlink */
  skipped: Record<string, number>;
  framework: {
    framework?: string | null;
    router?: string | null;
    status?: string;
    reason?: string | null;
  };
  analysis: {
    status?: string;
    reason?: string | null;
    routes?: SourceRoute[];
    counts?: { routes: number; edges: number; global_edges: number; unresolved: number };
  };
  progress: DiscoveryProgressEvent[];
  error: { code: string; message: string } | null;
  files_available: boolean;
  /* URL 없이 미리보기로 사이트 확인·실행할 수 있음 (정적 사이트 + 파일 있음 + 연결 유지). 이전 BE 에는 없음 */
  previewable?: boolean;
  created_at: string;
  updated_at: string;
};

export type GitSourceRequest = { git_url: string; ref?: string; subdirectory?: string };
