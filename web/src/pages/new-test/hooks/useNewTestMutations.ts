import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import {
  checkSite,
  confirmPlan,
  createDiscovery,
  createPlan,
  createRun,
  getDiscovery,
  getPlan,
  getRevisionPersonas,
  getTestAccounts,
  patchPlan,
  putTestAccounts,
} from "@/apis/plan.api";
import { queryKeys } from "@/apis/queryKeys";
import { useNewTestStore } from "@/stores/useNewTestStore";
import {
  RESULT_TTL_MS,
  type SiteCheckRequest,
  type SiteCheckResult,
  useSiteCheckStore,
} from "@/stores/useSiteCheckStore";
import { ApiError } from "@/types/api.type";
import type {
  Discovery,
  DiscoveryProgressEvent,
  Plan,
  PlanPatch,
  RevisionPersonas,
  RunCreated,
  SiteCheck,
} from "@/types/plan.type";

import { toWizardPlan, withServerPlan, type TestAccount, type WizardPlan } from "../utils/newTest";

export type DiscoverInput = {
  projectId: number;
  entryUrl: string;
  loginMode: "none" | "account";
  variant: "fixed" | "problem";
  /* 코드로 확인 (받은 정적 사이트 스냅샷). 있으면 entryUrl 대신 이 코드의 미리보기를 둘러봅니다 */
  sourceSnapshotId?: string;
};

export type { DiscoverPhase } from "@/stores/useSiteCheckStore";

/* 위저드가 지금 이 요청의 입력을 보고 있으면 결과를 넣어도 됩니다 */
function wizardMatches(projectKey: string, request: SiteCheckRequest) {
  const wizard = useNewTestStore.getState();
  return (
    wizard.projectId === projectKey &&
    wizard.siteUrl === request.siteUrl &&
    wizard.variant === request.variant &&
    wizard.loginMode === request.loginMode
  );
}

/* 기능 탐색 진행을 다시 묻는 간격 (테스트는 바로) */
export const DISCOVERY_POLL_MS = import.meta.env.MODE === "test" ? 0 : 1000;
/* 조회가 연달아 이만큼 실패하면 멈춥니다 (잠깐 끊긴 연결은 넘깁니다) */
const POLL_RETRIES = 3;
/* 서버가 멈춘 확인을 2분 안에 실패로 바꾸지만, 그래도 끝나지 않으면 이 시간 뒤 그만 묻습니다 */
const POLL_LIMIT_MS = 15 * 60 * 1000;
/* 서버가 실패로 끝낸 확인의 오류 코드 → 동기 응답이었다면 받았을 HTTP 상태 (나머지는 503) */
const FAILURE_STATUS: Record<string, number> = {
  TEST_ACCOUNT_LOGIN_FAILED: 409,
  NO_FEATURES_FOUND: 422,
};
const UNREACHABLE_MESSAGE = "사이트를 살펴보지 못했습니다. 잠시 뒤 다시 확인해주세요.";

/*
  비동기로 시작한 기능 탐색(status "running")이 끝날 때까지 GET 으로 묻고, 진행 사건을 onProgress 로 넘깁니다.
  - status 가 없으면(이전 BE 의 동기 응답) 바로 끝난 결과로 돌려줍니다.
  - 실패로 끝나면 동기 응답과 같은 상태·코드의 ApiError 를 던져 기존 오류 안내를 그대로 씁니다.
*/
async function waitForDiscovery(
  first: Discovery,
  onProgress: (progress: DiscoveryProgressEvent[]) => void,
): Promise<Discovery> {
  let discovery = first;
  let failures = 0;
  const until = Date.now() + POLL_LIMIT_MS;
  if (discovery.progress) onProgress(discovery.progress);
  while (discovery.status === "running") {
    if (Date.now() > until) {
      throw new ApiError({ status: 503, code: "DISCOVERY_TIMEOUT", message: UNREACHABLE_MESSAGE });
    }
    await new Promise((resolve) => setTimeout(resolve, DISCOVERY_POLL_MS));
    try {
      discovery = await getDiscovery(discovery.id);
      failures = 0;
    } catch (error) {
      /* 로그인 만료·권한·없는 탐색은 다시 물어도 같습니다 */
      if (error instanceof ApiError && error.status > 0 && error.status < 500) throw error;
      failures += 1;
      if (failures >= POLL_RETRIES) throw error;
      continue;
    }
    if (discovery.progress) onProgress(discovery.progress);
  }
  if (discovery.status === "failed") {
    const code = discovery.error?.code ?? "SITE_UNREACHABLE";
    throw new ApiError({
      status: FAILURE_STATUS[code] ?? 503,
      code,
      message: discovery.error?.message || UNREACHABLE_MESSAGE,
    });
  }
  return discovery;
}

/*
  P02·P03 사이트 확인 → 기능 탐색 → 계획 만들기 (POST check → discoveries → plans).
  - 주소 확인(check)이 실패해도 탐색은 진행합니다. 결과는 plan.check 로 경고만 보여 줍니다.
    로그인 필요(401)·권한 없음(403)은 탐색도 같은 결과라 바로 오류로 돌려줍니다.
  - 탐색은 서버가 브라우저로 사이트를 둘러봐 1~2분 걸립니다. 비동기로 시작하고 끝날 때까지 진행 사건을 받아
    작업(progress)에 넣습니다 (P02b 자세히 보기).
  - 화면이 아니라 useSiteCheckStore 에서 돌아, 확인 중에 다른 화면에 갔다 와도 끊기지 않습니다.
    결과는 위저드가 같은 입력을 보고 있으면 바로 넣고, 아니면 남겨 두었다가 돌아왔을 때 넣습니다(restoreSiteCheck).
*/
export async function runSiteCheck(
  projectKey: string,
  input: DiscoverInput,
  request: SiteCheckRequest,
): Promise<SiteCheckResult> {
  const store = useSiteCheckStore.getState();
  store.setJob(projectKey, {
    request,
    status: "pending",
    phase: "check",
    startedAt: Date.now(),
    finishedAt: null,
    result: null,
    error: null,
  });
  /* 이 작업이 아직 그 프로젝트의 최신 작업일 때만 상태를 바꿉니다 (지운 뒤 늦게 끝난 응답 무시) */
  const current = () => useSiteCheckStore.getState().jobs[projectKey]?.request === request;
  try {
    let check: SiteCheck | null = null;
    /* 코드로 확인할 때는 프로젝트 주소에 접속해 보지 않습니다 (서버가 받은 코드를 미리보기로 엽니다) */
    if (!input.sourceSnapshotId) {
      try {
        check = (await checkSite(input.projectId)).check;
      } catch (error) {
        if (error instanceof ApiError && (error.status === 401 || error.status === 403))
          throw error;
      }
    }
    if (current()) store.updateJob(projectKey, { phase: "discover" });
    const started = await createDiscovery(
      input.projectId,
      input.sourceSnapshotId
        ? { source_snapshot_id: input.sourceSnapshotId, login_mode: "none", variant: input.variant }
        : {
            entry_url: input.entryUrl,
            login_mode: input.loginMode === "account" ? "test_account" : "none",
            variant: input.variant,
          },
    );
    const discovery = await waitForDiscovery(started, (progress) => {
      if (current()) store.updateJob(projectKey, { progress });
    });
    if (current()) store.updateJob(projectKey, { phase: "plan" });
    const server = await createPlan(input.projectId, discovery.id);
    const result = { plan: toWizardPlan(discovery, server, check), server };
    if (current()) {
      if (wizardMatches(projectKey, request)) {
        useNewTestStore.getState().setPlan(result.plan, result.server);
        store.clearJob(projectKey);
      } else {
        store.updateJob(projectKey, {
          status: "success",
          phase: null,
          result,
          finishedAt: Date.now(),
        });
      }
    }
    return result;
  } catch (cause) {
    const error =
      cause instanceof ApiError ? cause : new ApiError({ status: 0, message: String(cause) });
    if (current()) {
      store.updateJob(projectKey, { status: "error", phase: null, error, finishedAt: Date.now() });
      /* 다시 확인이 실패하면 이전 결과로 다음 단계에 가지 않도록 지웁니다 */
      if (wizardMatches(projectKey, request)) useNewTestStore.getState().clearPlan();
    }
    throw error;
  }
}

/*
  위저드에 들어올 때(초기화 직후) 그 프로젝트의 사이트 확인을 이어 받습니다.
  - 확인 중이면 그때의 사이트 입력을 다시 채웁니다 (끝나면 runSiteCheck 이 결과를 넣음)
  - 끝났으면 입력과 결과(계획)까지 넣습니다. 서버 계획이 만료되는 15분이 지났으면 버립니다.
    넣은 뒤에도 지우지 않습니다 (다음 확인·주소 입력 때, 또는 다음에 같은 입력으로 돌아왔을 때(kept) 지워짐)
  - 실패했던 확인은 이어 받지 않고 지웁니다 (돌아오면 처음부터)
  - kept: 위저드 입력이 그대로 남아 있으면(같은 프로젝트로 돌아옴) 진행 중인 확인만 이어 받습니다.
    끝난 결과는 위저드가 같은 입력이었다면 이미 들어가 있고, 아니면 그 뒤에 바꾼 입력·저장한 계획을 덮어쓰게 되어 버립니다.
*/
export function restoreSiteCheck(projectKey: string, kept = false) {
  const store = useSiteCheckStore.getState();
  const job = store.jobs[projectKey];
  if (!job) return;
  const expired =
    job.status === "success" &&
    (kept || job.finishedAt == null || Date.now() - job.finishedAt > RESULT_TTL_MS);
  if (job.status === "error" || expired) {
    store.clearJob(projectKey);
    return;
  }
  const wizard = useNewTestStore.getState();
  wizard.setSiteUrl(job.request.siteUrl);
  wizard.setVariant(job.request.variant);
  wizard.setLoginMode(job.request.loginMode);
  if (job.status === "success" && job.result) {
    /* 만료(15분) 판단은 확인이 끝난 시각부터 셉니다 */
    useNewTestStore
      .getState()
      .setPlan(job.result.plan, job.result.server, job.finishedAt ?? undefined);
  }
}

/*
  사이트 단계 화면이 쓰는 확인 상태. 작업은 store 에 있어 화면이 사라졌다 돌아와도 그대로입니다.
  mutate 의 onSuccess·onError 는 화면이 그대로 있을 때만 부릅니다 (다음 단계로 이동 등 화면 일).
*/
export function useDiscoverPlan(projectKey: string) {
  const job = useSiteCheckStore((state) => state.jobs[projectKey]);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const mutate = (
    variables: DiscoverInput & { request: SiteCheckRequest },
    callbacks: {
      onSuccess?: (result: SiteCheckResult) => void;
      onError?: (error: ApiError) => void;
    },
  ) => {
    if (useSiteCheckStore.getState().jobs[projectKey]?.status === "pending") return;
    const { request, ...input } = variables;
    runSiteCheck(projectKey, input, request).then(
      (result) => mounted.current && callbacks.onSuccess?.(result),
      (error: ApiError) => mounted.current && callbacks.onError?.(error),
    );
  };
  return {
    isPending: job?.status === "pending",
    isError: job?.status === "error",
    error: job?.status === "error" ? job.error : null,
    phase: job?.phase ?? null,
    startedAt: job?.startedAt ?? null,
    /* 기능 탐색 진행 사건 (확인 중일 때만) */
    progress: job?.status === "pending" ? (job.progress ?? []) : [],
    /* 실패한 시각 (E08 안내) */
    failedAt: job?.status === "error" && job.finishedAt ? new Date(job.finishedAt) : null,
    mutate,
    reset: () => useSiteCheckStore.getState().clearJob(projectKey),
  };
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
  return useMutation<
    RunCreated,
    ApiError,
    { projectId: string; planRevisionId: string; idempotencyKey: string }
  >({
    mutationFn: ({ planRevisionId, idempotencyKey }) =>
      createRun({ plan_revision_id: planRevisionId }, idempotencyKey),
    onSuccess: (_run, { projectId }) => {
      /*
        실행을 시작한 프로젝트의 새 테스트를 처음으로 돌립니다 (돌아와도 이미 실행한 계획이 남지 않게).
        화면을 떠난 뒤 응답이 와도 지우도록 화면 콜백이 아니라 여기서 합니다.
        그 사이 다른 프로젝트의 새 테스트를 열었으면 그 입력은 건드리지 않습니다.
        위저드가 열려 있으면 비워진 것을 보고 그 프로젝트의 처음 입력으로 다시 시작합니다.
      */
      useSiteCheckStore.getState().clearJob(projectId);
      if (useNewTestStore.getState().projectId === projectId) {
        useNewTestStore.getState().reset("", "");
      }
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
