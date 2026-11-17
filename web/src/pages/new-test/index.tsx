import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";

import ProjectPageHeader from "@/components/ProjectPageHeader/ProjectPageHeader";
import Stepper from "@/components/Stepper/Stepper";
import { useCurrentProject, type CurrentProject } from "@/components/Projects/currentProject";
import { queryKeys } from "@/apis/queryKeys";
import { buildPath } from "@/constants/routes";
import { useCalibrations } from "@/hooks/useCalibrations";
import { useRunList } from "@/hooks/useRunList";
import { useNewTestStore } from "@/stores/useNewTestStore";
import type { ApiError } from "@/types/api.type";
import type { PlanPatch } from "@/types/plan.type";
import { ACTIVE_RUN_STATUSES } from "@/types/run.type";

import ConfirmStep from "./components/ConfirmStep";
import PersonaReviewStep from "./components/PersonaReviewStep";
import PersonaStep from "./components/PersonaStep";
import SiteStep from "./components/SiteStep";
import TaskTargetStep from "./components/TaskTargetStep";
import { useSavePlan, useStartRun } from "./hooks/useNewTestMutations";
import {
  agentRange,
  clampStep,
  formatMonthDay,
  furthestAllowedStep,
  inRange,
  parseStep,
  REVIEW_STEP,
  RUN_DEVICE,
  STEP_LABELS,
  segmentsPatch,
  STEPS,
  type StepKey,
  sum,
  taskTargetPatch,
  type WizardPlan,
} from "./utils/newTest";

const EXPIRED_NOTICE = "탐색 결과가 만료됐어요. 사이트를 다시 확인해 주세요";

/*
  P02~P07 새 테스트 (단계: ?step=site|task|persona|confirm, 시작 전 확인 뒤 ?step=personas 는 P06·P07)
  제품 API: 사이트 확인 → 탐색 → 계획(PATCH, If-Match) → 확정 → 페르소나 → 실행(POST /api/v1/runs).
  모두 로그인 + 프로젝트 소유자만 됩니다 (401·403 은 각 단계에서 안내).
  프로젝트가 바뀌면 key 로 위저드를 새로 그려 입력·안내·요청 상태를 모두 처음으로 돌립니다.
*/
export default function NewTestPage() {
  const project = useCurrentProject();

  return <NewTestWizard key={project.id} project={project} />;
}

/*
  - 입력은 useNewTestStore 에 두어 단계를 오가도 남습니다. 화면을 떠나면 비밀번호가 남지 않게 지웁니다.
  - 주소로 들어오거나 뒤로가기로 앞 단계 검증을 건너뛰지 못하게, 갈 수 있는 단계까지만 보여주고 주소도 맞춥니다.
*/
function NewTestWizard({ project }: { project: CurrentProject }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const save = useSavePlan();
  const startRun = useStartRun();
  const runs = useRunList(project.v1Id);
  const [notice, setNotice] = useState<string | null>(null);
  /* 같은 확정본으로 다시 누르면 같은 Idempotency-Key 를 보내 실행이 두 번 생기지 않게 합니다 */
  const runKeys = useRef(new Map<string, string>());
  /* 마지막으로 서버 계획에 저장한 값 (계획마다). 바뀐 입력만 다시 저장하는 데 씁니다 */
  const saved = useRef<{ planId: string; body: Record<string, unknown> } | null>(null);

  const calibrations = useCalibrations(project.id);
  const {
    storeProjectId,
    plan,
    taskIds,
    taskCount,
    targetDescription,
    segmentsValid,
    panel,
    seedCount,
  } = useNewTestStore(
    useShallow((state) => ({
      storeProjectId: state.projectId,
      plan: state.plan,
      taskIds: state.taskIds,
      taskCount: state.taskIds.length,
      panel: sum(state.segmentCounts),
      seedCount: state.seedCount,
      targetDescription: state.targetDescription,
      segmentsValid: inRange(
        sum(state.segmentCounts),
        agentRange(state.plan, state.loginMode, state.accounts.length),
      ),
    })),
  );

  /* 화면에 그리기 전에 이 프로젝트의 입력으로 시작하고, 떠날 때 지웁니다 */
  useLayoutEffect(() => {
    useNewTestStore.getState().reset(project.id, project.url);
    return () => useNewTestStore.getState().reset("", "");
  }, [project.id, project.url]);

  /*
    P06·P07 은 Stepper 밖의 화면이라 단계 목록에 넣지 않고, 시작 전 확인까지 갈 수 있을 때만 보여줍니다.
    갈 수 없으면 시작 전 확인을 요청한 것처럼 갈 수 있는 단계로 돌려보냅니다.
  */
  const reviewRequested = searchParams.get("step") === REVIEW_STEP;
  const requested: StepKey = reviewRequested ? "confirm" : parseStep(searchParams.get("step"));
  const allowed = furthestAllowedStep({
    hasPlan: plan != null,
    taskCount,
    targetDescription,
    segmentsValid,
  });
  const step: StepKey = clampStep(requested, allowed);
  const reviewing = reviewRequested && step === "confirm";

  /* 보여주는 단계와 주소가 다르면 주소를 맞춥니다 (뒤로가기 기록은 남기지 않음) */
  useEffect(() => {
    if (reviewing) return;
    if (step === requested && (step !== "site" || !searchParams.has("step"))) return;
    setSearchParams(step === "site" ? {} : { step }, { replace: true });
  }, [reviewing, step, requested, searchParams, setSearchParams]);

  /*
    단계가 바뀌면 지난 실행 시작 오류는 지웁니다.
    요청이 진행 중이면 지우지 않습니다: reset 은 진행 중인 요청의 화면 이동 콜백까지 끊어,
    서버에서는 실행이 시작됐는데 화면은 위저드에 남게 됩니다.
  */
  const { reset: resetStart } = startRun;
  const { reset: resetSave } = save;
  const startPending = useRef(false);
  useEffect(() => {
    startPending.current = startRun.isPending;
  });
  useEffect(() => {
    if (!startPending.current) resetStart();
    resetSave();
  }, [step, reviewing, resetStart, resetSave]);

  if (storeProjectId !== project.id) return null;

  /*
    가장 최근 보정 적용일 (P05b·P05c). 응답 순서에 기대지 않고 적용 시각으로 고릅니다.
    불러오는 중이거나 받지 못하면 undefined(표시 안 함 — 보정 API 는 서버에 아직 없음), 이력이 없으면 null(보정 전).
  */
  const latestCalibration = [...(calibrations.data ?? [])].sort((a, b) =>
    b.applied_at.localeCompare(a.applied_at),
  )[0];
  const calibratedLabel =
    calibrations.isPending || calibrations.isError
      ? undefined
      : formatMonthDay(latestCalibration?.applied_at);

  const goTo = (next: StepKey | typeof REVIEW_STEP) => {
    setSearchParams(next === "site" ? {} : { step: next });
    window.scrollTo({ top: 0 });
  };

  const backToSite = (message: string) => {
    useNewTestStore.getState().clearPlan();
    setNotice(message);
    setSearchParams({});
  };

  const savePatch = (patch: PlanPatch, onSaved: (plan: WizardPlan) => void) =>
    save.mutate(patch, {
      onSuccess: (result) => {
        const body = saved.current?.planId === result.planId ? saved.current.body : {};
        saved.current = { planId: result.planId, body: { ...body, ...patch } };
        onSaved(result);
      },
    });

  /* 단계를 넘어가기 전에 입력을 서버 계획에 저장합니다 (실패하면 이 단계에 머물며 이유를 보여 줌) */
  const saveThen = (patch: PlanPatch, next: StepKey) => savePatch(patch, () => goTo(next));

  /*
    "페르소나 생성" — 확정하기 전에 화면 입력이 서버 계획과 같은지 봅니다.
    "변경 · n단계"로 가서 고친 뒤 "다음" 없이 돌아오면 저장되지 않은 입력이 남아, 그 부분만 먼저 저장합니다.
    저장한 뒤 확정을 막는 이유가 생기면 시작 전 확인에 머물러 이유를 보여 줍니다.
  */
  const review = (plan: WizardPlan) => {
    const state = useNewTestStore.getState();
    const current: Record<string, unknown> = {
      ...taskTargetPatch(plan, state),
      ...segmentsPatch(plan, state.segmentCounts, state.seedCount),
    };
    const last = saved.current?.planId === plan.planId ? saved.current.body : {};
    const dirty = Object.fromEntries(
      Object.entries(current).filter(
        ([key, value]) => JSON.stringify(last[key]) !== JSON.stringify(value),
      ),
    );
    if (Object.keys(dirty).length === 0) {
      goTo(REVIEW_STEP);
      return;
    }
    savePatch(dirty as PlanPatch, (result) => {
      const blocked = result.review.blocking.some((item) => item.code !== "DISCOVERY_EXPIRED");
      if (!blocked) goTo(REVIEW_STEP);
    });
  };

  /*
    P07 실행 시작. 확정본으로 실행하므로 탐색 만료(15분)와 상관없이 시작합니다.
    같은 확정본은 같은 Idempotency-Key 로 보내되, 서버가 확정적으로 거절(4xx)하면 다음 시도는 새 키로 보냅니다.
  */
  const start = (planRevisionId: string) => {
    let idempotencyKey = runKeys.current.get(planRevisionId);
    if (!idempotencyKey) {
      idempotencyKey = crypto.randomUUID();
      runKeys.current.set(planRevisionId, idempotencyKey);
    }
    startRun.mutate(
      { planRevisionId, idempotencyKey },
      {
        onSuccess: (run) => {
          navigate(buildPath("testRun", { projectId: project.id, runId: run.run_id }));
        },
        /* 다른 탭 등에서 시작된 실행을 링크로 보여주려고 실행 목록을 다시 받습니다 */
        onError: (error) => {
          if (error.status >= 400 && error.status < 500) runKeys.current.delete(planRevisionId);
          if (error.code === "RUN_IN_PROGRESS") void runs.refetch();
        },
      },
    );
  };

  const activeRunId =
    runs.data?.pages
      .flatMap((page) => page.items)
      .find((item) => ACTIVE_RUN_STATUSES.includes(item.status))?.id ?? null;

  if (reviewing && plan) {
    const tasks = plan.tasks.filter((task) => taskIds.includes(task.id));
    const taskSummary =
      tasks.length > 1 ? `${tasks[0].name} 외 ${tasks.length - 1}개` : (tasks[0]?.name ?? "");
    return (
      <div className="flex flex-col gap-12">
        {/* Figma P06·P07: Stepper 없이 제목 "페르소나 확인" (P07 은 실행 조건 한 줄을 덧붙임) */}
        <ProjectPageHeader
          projectId={project.id}
          breadcrumb={`${project.name} / 사전 테스트 / 새 테스트 · 테스트`}
          title="페르소나 확인"
          description={`${taskSummary} · ${RUN_DEVICE} · ${panel}명 × 시드 ${seedCount}회 (1/${seedCount})`}
          activeTab="tests"
        />
        <PersonaReviewStep
          projectId={project.id}
          planId={plan.planId}
          revision={plan.revision}
          isStarting={startRun.isPending}
          error={startRun.error}
          currentRunId={activeRunId}
          onPrev={() => goTo("confirm")}
          onStart={start}
          onExpired={() => backToSite(EXPIRED_NOTICE)}
          /*
            서버의 테스트 계정이 바뀌었으면 받아 둔 목록을 버리고 1단계에서 다시 받습니다 (SiteStep 이 새로 받아 맞춤).
            계정 수가 계획과 달라지므로 1단계 "다음"이 다시 확인(재탐색)해 인원 기준을 맞춥니다.
            여기서 store 계정을 먼저 비우면 주소가 바뀌기 전 렌더에서 인원이 어긋나 3단계로 돌아가므로 비우지 않습니다.
          */
          onAccountsChanged={() => {
            queryClient.removeQueries({ queryKey: queryKeys.testAccounts(project.v1Id) });
            goTo("site");
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-12">
      <ProjectPageHeader
        projectId={project.id}
        breadcrumb={`${project.name} / 사전 테스트 · 테스트`}
        title="새 테스트"
        activeTab="tests"
      />

      <Stepper steps={STEPS.map((key) => STEP_LABELS[key])} current={STEPS.indexOf(step)} />

      {save.error && <SaveError error={save.error} />}

      {step === "site" && (
        <SiteStep
          projectId={project.v1Id}
          notice={notice}
          /* 사이트를 다시 확인하면 만료 안내는 지웁니다 */
          onDiscovered={() => setNotice(null)}
          onNext={() => goTo("task")}
        />
      )}
      {step === "task" && plan && (
        <TaskTargetStep
          plan={plan}
          saving={save.isPending}
          onPrev={() => goTo("site")}
          onNext={() => {
            const state = useNewTestStore.getState();
            saveThen(taskTargetPatch(plan, state), "persona");
          }}
        />
      )}
      {step === "persona" && plan && (
        <PersonaStep
          calibratedLabel={calibratedLabel}
          saving={save.isPending}
          onPrev={() => goTo("task")}
          onNext={() => {
            const state = useNewTestStore.getState();
            saveThen(segmentsPatch(plan, state.segmentCounts, state.seedCount), "confirm");
          }}
        />
      )}
      {step === "confirm" && plan && (
        <ConfirmStep
          plan={plan}
          calibratedLabel={calibratedLabel}
          onPrev={() => goTo("persona")}
          saving={save.isPending}
          onNext={() => review(plan)}
          onExpired={() => backToSite(EXPIRED_NOTICE)}
        />
      )}
    </div>
  );
}

/* 계획을 저장하지 못했을 때 (PATCH) — 401 로그인 · 403 권한 · 그 밖은 서버 message */
function SaveError({ error }: { error: ApiError }) {
  const text =
    error.status === 0
      ? "서버에 연결할 수 없어요"
      : error.status === 401
        ? "로그인이 필요해요"
        : error.status === 403
          ? "이 프로젝트에서는 실행할 수 없어요"
          : error.message;
  return (
    <p role="alert" className="text-caption font-medium text-danger">
      입력을 저장하지 못했어요 · {text}
    </p>
  );
}
