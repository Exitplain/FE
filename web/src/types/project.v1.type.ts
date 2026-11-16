/*
  제품 API 프로젝트 타입. 기준: BE backend/projects
  화면의 프로젝트(constants/projects.ts, 문자열 id)와 달리 id 가 숫자입니다.
*/

/* GET /api/v1/sample/projects 의 항목 */
export type V1ProjectSummary = {
  id: number;
  name: string;
  entry_url: string;
  domain: string;
  is_sample: boolean;
  archived_at: string | null;
  last_pretest: unknown;
  updated_at: string;
};
