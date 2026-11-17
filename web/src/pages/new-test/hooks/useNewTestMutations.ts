import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

import {
  checkSite,
  confirmPlan,
  createDiscovery,
  createPlan,
  createRun,
  getPlan,
  getRevisionPersonas,
  getTestAccounts,
  patchPlan,
  putTestAccounts,
} from "@/apis/plan.api";
import { queryKeys } from "@/apis/queryKeys";
import { useNewTestStore } from "@/stores/useNewTestStore";
import { ApiError } from "@/types/api.type";
import type { Plan, PlanPatch, RevisionPersonas, RunCreated, SiteCheck } from "@/types/plan.type";

import { toWizardPlan, withServerPlan, type TestAccount, type WizardPlan } from "../utils/newTest";

export type DiscoverInput = {
  projectId: number;
  entryUrl: string;
  loginMode: "none" | "account";
  variant: "fixed" | "problem";
};

/*
  P02·P03 사이트 확인 → 기능 탐색 → 계획 만들기 (POST check → discoveries → plans).
  - 주소 확인(check)이 실패해도 탐색은 진행합니다. 결과는 plan.check 로 경고만 보여 줍니다.
    로그인 필요(401)·권한 없음(403)은 탐색도 같은 결과라 바로 오류로 돌려줍니다.
  - 탐색은 서버가 브라우저로 시작 화면을 읽어 수 초 걸립니다.
*/
/* 사이트 확인 중 지금 하는 일 (P02b 상태 띠 문구) */
export type DiscoverPhase = "check" | "discover" | "plan";

export function useDiscoverPlan() {
  /* 탐색이 1~2분 걸려 멈춘 것처럼 보이지 않게 지금 단계를 화면에 알려 줍니다 */
  const [phase, setPhase] = useState<DiscoverPhase | null>(null);
  const mutation = useMutation<{ plan: WizardPlan; server: Plan }, ApiError, DiscoverInput>({
    mutationFn: async ({ projectId, entryUrl, loginMode, variant }) => {
      setPhase("check");
      let check: SiteCheck | null = null;
      try {
        check = (await checkSite(projectId)).check;
      } catch (error) {
        if (error instanceof ApiError && (error.status === 401 || error.status === 403))
          throw error;
      }
      setPhase("discover");
      const discovery = await createDiscovery(projectId, {
        entry_url: entryUrl,
        login_mode: loginMode === "account" ? "test_account" : "none",
        variant,
      });
      setPhase("plan");
      const server = await createPlan(projectId, discovery.id);
      return { plan: toWizardPlan(discovery, server, check), server };
    },
    onSettled: () => setPhase(null),
  });
  return { ...mutation, phase };
}

function isRevisionConflict(error: unknown) {
  return error instanceof ApiError && error.code === "REVISION_CONFLICT";
}

/*
  P05·P05b 계획 저장 (PATCH /api/v1/plans/{id}, If-Match: revision).
  - 저장은 한 줄로 세워 보냅니다. 앞 저장의 새 revision 으로 다음 저장을 보내야 409 가 나지 않습니다.
  - 다른 곳에서 먼저 고쳐 409 REVISION_CONFLICT 이면 최신 계획을 받아 그 revision 으로 한 번 더 보냅니다
    (지금 화면의 입력이 사용자가 마지막으로 고른 값이라 그대로 덮어씁니다).
  - 기다리는 사이 사이트를 다시 확인해 계획이 바뀌었으면, 이전 계획의 저장은 보내지도 반영하지도 않습니다.
*/
export function useSavePlan() {
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const mutation = useMutation<WizardPlan, ApiError, PlanPatch>({
    mutationFn: (patch) => {
      const planId = useNewTestStore.getState().plan?.planId;
      const run = async () => {
        const store = useNewTestStore.getState();
        const plan = store.plan;
        if (!plan || plan.planId !== planId) {
          throw new ApiError({ status: 0, message: "사이트를 다시 확인해 주세요" });
        }
        let server: Plan;
        try {
          server = await patchPlan(plan.planId, plan.revision, patch);
        } catch (error) {
          if (!isRevisionConflict(error)) throw error;
          const latest = await getPlan(plan.planId);
          server = await patchPlan(plan.planId, latest.revision, patch);
        }
        useNewTestStore
          .getState()
          .updatePlan((current) =>
            current.planId === server.id ? withServerPlan(current, server) : current,
          );
        return withServerPlan(plan, server);
      };
      const next = queue.current.then(run, run);
      queue.current = next.catch(() => {});
      return next;
    },
  });
  return mutation;
}

export type ConfirmedPlan = { planRevisionId: string; personas: RevisionPersonas };

/* 409 ALREADY_CONFIRMED 의 fields.plan_revision_id — 이미 확정한 revision 이면 그 id 를 그대로 씁니다 */
function confirmedRevisionId(error: unknown): string | null {
  if (!(error instanceof ApiError) || error.code !== "ALREADY_CONFIRMED") return null;
  const value = error.fields?.plan_revision_id;
  const id = Array.isArray(value) ? value[0] : value;
  return typeof id === "string" ? id : null;
}

async function confirmOrReuse(planId: string, revision: number) {
  try {
    return (await confirmPlan(planId, revision)).plan_revision_id;
  } catch (error) {
    const existing = confirmedRevisionId(error);
    if (!existing) throw error;
    return existing;
  }
}

/*
  P05c "페르소나 생성" → P06·P07: 계획 확정(POST confirmations) 후 그 revision 의 페르소나를 받습니다.
  - 확정 전에 남은 저장이 끝나야 하므로, 시작 전 확인에서 저장을 마친 뒤에 이 화면으로 옵니다.
  - 다른 곳에서 계획이 바뀌어 409 REVISION_CONFLICT 이면 최신 revision 을 받아 한 번 더 확정합니다.
*/
export function useConfirmPlan() {
  return useMutation<ConfirmedPlan, ApiError, { planId: string; revision: number }>({
    mutationFn: async ({ planId, revision }) => {
      let planRevisionId: string;
      try {
        planRevisionId = await confirmOrReuse(planId, revision);
      } catch (error) {
        if (!isRevisionConflict(error)) throw error;
        const latest = await getPlan(planId);
        useNewTestStore
          .getState()
          .updatePlan((current) =>
            current.planId === latest.id ? withServerPlan(current, latest) : current,
          );
        planRevisionId = await confirmOrReuse(planId, latest.revision);
      }
      return { planRevisionId, personas: await getRevisionPersonas(planRevisionId) };
    },
  });
}

/*
  P07 실행 시작 (POST /api/v1/runs). 같은 확정본으로 다시 누르면 같은 Idempotency-Key 를 보내
  실행이 두 번 생기지 않게 합니다. 끝나면 실행 목록을 다시 받습니다.
*/
export function useStartRun() {
  const queryClient = useQueryClient();
  return useMutation<RunCreated, ApiError, { planRevisionId: string; idempotencyKey: string }>({
    mutationFn: ({ planRevisionId, idempotencyKey }) =>
      createRun({ plan_revision_id: planRevisionId }, idempotencyKey),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.runs.all });
      /* 프로젝트의 마지막 사전 테스트(사이드바·개요 단계)도 바뀝니다 */
      void queryClient.invalidateQueries({ queryKey: queryKeys.projectsV1.all });
      /* 실행 화면(P08~P11)은 아직 개발 API 의 현재 실행을 봅니다 */
      void queryClient.invalidateQueries({ queryKey: queryKeys.personas.all });
    },
  });
}

/*
  P04 서버에 저장된 테스트 계정. 위저드에 들어올 때 받아 와서
  - 에이전트 수(계정 수)를 서버와 맞추고
  - 목록 전체를 바꾸는 저장(PUT)이 기존 계정을 지우지 않게 합니다.
  로그인하지 않았거나 권한이 없으면 빈 목록으로 둡니다 (탐색 단계에서 안내).
*/
export function useTestAccounts(projectId: number) {
  return useQuery({
    queryKey: queryKeys.testAccounts(projectId),
    queryFn: async () => {
      try {
        return await getTestAccounts(projectId);
      } catch (error) {
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          return null;
        }
        throw error;
      }
    },
    retry: false,
  });
}

/*
  P04 테스트 계정 저장 (PUT /api/v1/projects/{id}/test-accounts — 로그인 화면 주소와 목록 전체를 바꿈).
  서버에 있던 계정은 id 와 함께 보내고, 비밀번호를 비워 두면 서버가 기존 비밀번호를 유지합니다.
  응답의 id 를 같은 순서의 계정에 붙여 돌려줍니다 (비밀번호는 응답에 없어 화면 값을 그대로 둠).
*/
export function useSaveTestAccounts() {
  const queryClient = useQueryClient();
  return useMutation<
    TestAccount[],
    ApiError,
    { projectId: number; loginUrl: string; accounts: TestAccount[] }
  >({
    onSuccess: (_saved, { projectId }) =>
      void queryClient.invalidateQueries({ queryKey: queryKeys.testAccounts(projectId) }),
    mutationFn: async ({ projectId, loginUrl, accounts }) => {
      const saved = await putTestAccounts(projectId, {
        /* 목록 전체를 바꾸는 요청이라 빠뜨리면 서버의 로그인 화면 주소가 지워집니다 */
        login_url: loginUrl,
        accounts: accounts.map((account) =>
          account.id
            ? {
                id: account.id,
                username: account.username,
                ...(account.password ? { password: account.password } : {}),
              }
            : { username: account.username, password: account.password },
        ),
      });
      const items = [...saved.items].sort((a, b) => a.position - b.position);
      return accounts.map((account, index) => ({ ...account, id: items[index]?.id ?? account.id }));
    },
  });
}
