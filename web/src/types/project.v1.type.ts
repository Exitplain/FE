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

/* 실측 연결 상태. 수집 키가 없으면 unconnected, 키는 있는데 받은 수집이 없으면 waiting, 받았으면 connected */
export type V1ProjectMeasurement = {
  /* CSV 로 올린 기록만 있어도 connected 입니다 */
  status: "unconnected" | "waiting" | "connected";
  last_received_at: string | null;
  /* 마지막으로 CSV 를 올린 시각 (예전 서버 응답에는 없을 수 있음) */
  last_imported_at?: string | null;
};

/* 가장 최근 보정. 없거나 기본 모형으로 되돌렸으면 before (revision 등은 null) */
export type V1ProjectCalibration = {
  status: "before" | "applied";
  revision: number | null;
  applied_at: string | null;
  /* 보정 기준 실측 대비 평균 오차(%p). 사람 관측만이거나 되돌린 리비전은 null */
  mean_error_pp: number | null;
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
  /* 대시보드 실측·보정 열 (BE #44). 배포 전 서버는 주지 않을 수 있어 선택값으로 둡니다 */
  measurement?: V1ProjectMeasurement;
  calibration?: V1ProjectCalibration;
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
  /* 선택. 비우면 주소 없는 프로젝트가 되고, 새 테스트 1단계에서 입력한 주소를 서버가 등록합니다 */
  entry_url?: string;
  journey_note?: string;
};
