import type { RunStatus } from "./run.type";

/*
  제품 API 프로젝트 타입. 기준: BE backend/projects (services.project_summary / project_detail)
  화면 주소의 :projectId 는 이 숫자 id 를 문자열로 쓴 값입니다.
*/

/* 프로젝트의 마지막 사전 테스트 (없으면 null) */
export type V1LastPretest = {
  run_id: string;
  sequence_no: number;
  status: RunStatus;
  created_at: string;
  finished_at: string | null;
};

/* GET /api/v1/projects, GET /api/v1/sample/projects 의 항목 */
export type V1ProjectSummary = {
  id: number;
  name: string;
  entry_url: string;
  domain: string;
  is_sample: boolean;
  archived_at: string | null;
  last_pretest: V1LastPretest | null;
  updated_at: string;
};

/* GET /api/v1/projects/{id}, POST /api/v1/projects 응답 */
export type V1ProjectDetail = V1ProjectSummary & {
  allowed_origins: string[];
  login_mode: "none" | "test_account";
  journey_note: string;
  check: {
    status: "unchecked" | "ok" | "failed";
    http_status: number | null;
    elapsed_ms: number | null;
    checked_at: string | null;
  };
  runs: { total: number; active: number; last_pretest: V1LastPretest | null };
  created_at: string;
};

/* POST /api/v1/projects 요청 (정의 밖 필드를 보내면 422) */
export type V1ProjectCreateRequest = {
  name: string;
  entry_url: string;
  journey_note?: string;
};
