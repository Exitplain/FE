import type {
  Discovery,
  DiscoveryRequest,
  Plan,
  PlanPatch,
  PlanSnapshot,
  RevisionPersonas,
  RunCreated,
  RunCreateRequest,
  SiteCheckResponse,
  TestAccounts,
  TestAccountsRequest,
} from "@/types/plan.type";

import axiosInstance from "./axiosInstance";

/*
  제품 API 새 테스트 위저드 (P02~P07) + 실행 시작.
  모두 로그인 + 프로젝트 소유자만 됩니다 (401 AUTH_REQUIRED · 403 FORBIDDEN).
*/

/* P02 사이트 주소 확인 (프로젝트 주소로 실제 GET). 접속하지 못해도 200 + status "failed" */
export async function checkSite(projectId: number): Promise<SiteCheckResponse> {
  const { data } = await axiosInstance.post<SiteCheckResponse>(
    `/api/v1/projects/${projectId}/check`,
  );
  return data;
}

/* P03 기능 탐색 — 서버가 브라우저로 시작 화면을 읽어 수 초 걸립니다 */
export async function createDiscovery(
  projectId: number,
  body: DiscoveryRequest,
): Promise<Discovery> {
  const { data } = await axiosInstance.post<Discovery>(
    `/api/v1/projects/${projectId}/discoveries`,
    body,
  );
  return data;
}

/* P05 계획 만들기 (탐색 결과 기준, revision 1) */
export async function createPlan(projectId: number, discoveryId: string): Promise<Plan> {
  const { data } = await axiosInstance.post<Plan>(`/api/v1/projects/${projectId}/plans`, {
    discovery_id: discoveryId,
  });
  return data;
}

export async function getPlan(planId: string): Promise<Plan> {
  const { data } = await axiosInstance.get<Plan>(`/api/v1/plans/${encodeURIComponent(planId)}`);
  return data;
}

/*
  P05·P05b 계획 고치기. 지금 revision 을 If-Match 로 보내고, 성공하면 revision 이 1 오릅니다.
  다른 곳에서 먼저 고쳤으면 409 REVISION_CONFLICT 입니다.
*/
export async function patchPlan(planId: string, revision: number, body: PlanPatch): Promise<Plan> {
  const { data } = await axiosInstance.patch<Plan>(
    `/api/v1/plans/${encodeURIComponent(planId)}`,
    body,
    { headers: { "If-Match": `"${revision}"` } },
  );
  return data;
}

/*
  P05c → P06 계획 확정 (페르소나 생성). 같은 revision 을 다시 확정하면
  409 ALREADY_CONFIRMED 이고 fields.plan_revision_id 에 이미 만든 id 가 있습니다.
*/
export async function confirmPlan(planId: string, revision: number): Promise<PlanSnapshot> {
  const { data } = await axiosInstance.post<PlanSnapshot>(
    `/api/v1/plans/${encodeURIComponent(planId)}/confirmations`,
    { revision },
  );
  return data;
}

/* P07 확정한 계획의 페르소나 */
export async function getRevisionPersonas(planRevisionId: string): Promise<RevisionPersonas> {
  const { data } = await axiosInstance.get<RevisionPersonas>(
    `/api/v1/plan-revisions/${encodeURIComponent(planRevisionId)}/personas`,
  );
  return data;
}

/* P04 저장된 테스트 계정 (비밀번호는 응답에 없음) */
export async function getTestAccounts(projectId: number): Promise<TestAccounts> {
  const { data } = await axiosInstance.get<TestAccounts>(
    `/api/v1/projects/${projectId}/test-accounts`,
  );
  return data;
}

/* P04 테스트 계정 — 목록 전체를 바꿉니다. 기존 계정은 id 를 보내면 비밀번호를 생략해도 유지됩니다 */
export async function putTestAccounts(
  projectId: number,
  body: TestAccountsRequest,
): Promise<TestAccounts> {
  const { data } = await axiosInstance.put<TestAccounts>(
    `/api/v1/projects/${projectId}/test-accounts`,
    body,
  );
  return data;
}

/*
  P07 실행 시작. 같은 Idempotency-Key 로 다시 보내면 새 실행 대신 앞서 만든 실행을 돌려줍니다
  (응답이 오기 전에 네트워크가 끊겨 다시 눌러도 실행이 두 번 생기지 않게).
*/
export async function createRun(
  body: RunCreateRequest,
  idempotencyKey: string,
): Promise<RunCreated> {
  const { data } = await axiosInstance.post<RunCreated>("/api/v1/runs", body, {
    headers: { "Idempotency-Key": idempotencyKey },
  });
  return data;
}
