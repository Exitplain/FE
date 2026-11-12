import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";

import { queryKeys } from "@/apis/queryKeys";
import ProjectPageHeader from "@/components/ProjectPageHeader/ProjectPageHeader";
import Stepper from "@/components/Stepper/Stepper";
import { findSampleProject, type SampleProject } from "@/constants/projects";
import { buildPath } from "@/constants/routes";
import { usePersonaRun } from "@/hooks/usePersonaRun";
import { useNewTestStore } from "@/stores/useNewTestStore";

import ConfirmStep from "./components/ConfirmStep";
import PersonaStep from "./components/PersonaStep";
import SiteStep from "./components/SiteStep";
import TaskTargetStep from "./components/TaskTargetStep";
import { useConfirmRun } from "./hooks/useNewTestMutations";
import {
  buildConfirmRequest,
  clampStep,
  furthestAllowedStep,
  isPlanExpired,
  isPlanExpiredMessage,
  parseStep,
  STEP_LABELS,
  STEPS,
  type StepKey,
} from "./utils/newTest";

/* BE agent/persona_dashboard.py PROFILES 개수 */
const DEFAULT_PROFILE_COUNT = 3;

const EXPIRED_NOTICE = "탐색 결과가 만료됐어요. 사이트를 다시 확인해 주세요";

/*
  P02~P05c 새 테스트 (단계: ?step=site|task|persona|confirm)
  프로젝트가 바뀌면 key 로 위저드를 새로 그려 입력·안내·요청 상태를 모두 처음으로 돌립니다.
*/
export default function NewTestPage() {
  const { projectId } = useParams();
  const project = findSampleProject(projectId);

  if (!project) {
    return (
      <section className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold text-ink">프로젝트를 찾을 수 없어요</h1>
        <p className="text-sm text-subtle">
          주소를 확인하거나 사이드바에서 프로젝트를 골라 주세요.
        </p>
      </section>
    );
  }

  return <NewTestWizard key={project.id} project={project} />;
}

/*
  - 입력은 useNewTestStore 에 두어 단계를 오가도 남습니다. 화면을 떠나면 비밀번호가 남지 않게 지웁니다.
  - 주소로 들어오거나 뒤로가기로 앞 단계 검증을 건너뛰지 못하게, 갈 수 있는 단계까지만 보여주고 주소도 맞춥니다.
*/
function NewTestWizard({ project }: { project: SampleProject }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentRun = usePersonaRun();
  const confirm = useConfirmRun();
  const [notice, setNotice] = useState<string | null>(null);

  const { storeProjectId, plan, taskCount, targetDescription, loginMode, accountCount } =
    useNewTestStore(
      useShallow((state) => ({
        storeProjectId: state.projectId,
        plan: state.plan,
        taskCount: state.taskIds.length,
        targetDescription: state.targetDescription,
        loginMode: state.loginMode,
        accountCount: state.accounts.length,
      })),
    );

  /* 화면에 그리기 전에 이 프로젝트의 입력으로 시작하고, 떠날 때 지웁니다 */
  useLayoutEffect(() => {
    useNewTestStore.getState().reset(project.id, project.url);
    return () => useNewTestStore.getState().reset("", "");
  }, [project.id, project.url]);

  const requested = parseStep(searchParams.get("step"));
  const allowed = furthestAllowedStep({ hasPlan: plan != null, taskCount, targetDescription });
  const step: StepKey = clampStep(requested, allowed);

  /* 보여주는 단계와 주소가 다르면 주소를 맞춥니다 (뒤로가기 기록은 남기지 않음) */
  useEffect(() => {
    if (step === requested && (step !== "site" || !searchParams.has("step"))) return;
    setSearchParams(step === "site" ? {} : { step }, { replace: true });
  }, [step, requested, searchParams, setSearchParams]);

  /*
    단계가 바뀌면 지난 실행 시작 오류는 지웁니다.
    요청이 진행 중이면 지우지 않습니다: reset 은 진행 중인 요청의 화면 이동 콜백까지 끊어,
    서버에서는 실행이 시작됐는데 화면은 위저드에 남게 됩니다.
  */
  const { reset: resetConfirm } = confirm;
  const confirmPending = useRef(false);
  useEffect(() => {
    confirmPending.current = confirm.isPending;
  });
  useEffect(() => {
    if (!confirmPending.current) resetConfirm();
  }, [step, resetConfirm]);

  if (storeProjectId !== project.id) return null;

  /* BE 고정 프로필은 GET /api/personas 응답에 있습니다. 받기 전에는 세션 수 계산에 BE 기본값(3)을 씁니다 */
  const profiles = currentRun.data?.profiles ?? [];
  const profileCount = profiles.length || DEFAULT_PROFILE_COUNT;

  const goTo = (next: StepKey) => {
    setSearchParams(next === "site" ? {} : { step: next });
    window.scrollTo({ top: 0 });
  };

  const backToSite = (message: string) => {
    useNewTestStore.getState().clearPlan();
    setNotice(message);
    setSearchParams({});
  };

  const start = () => {
    const state = useNewTestStore.getState();
    if (!state.plan) return;
    if (state.discoveredAt != null && isPlanExpired(state.discoveredAt)) {
      backToSite(EXPIRED_NOTICE);
      return;
    }
    confirm.mutate(buildConfirmRequest(state.plan, state), {
      onSuccess: (run) => {
        navigate(buildPath("testRun", { projectId: project.id, runId: run.id ?? "current" }));
      },
      onError: (error) => {
        if (error.status === 400 && isPlanExpiredMessage(error.message)) {
          backToSite(EXPIRED_NOTICE);
        }
        /* 다른 탭 등에서 시작된 실행을 링크로 보여주려고 현재 실행을 다시 받습니다 */
        if (error.status === 409) {
          void queryClient.invalidateQueries({ queryKey: queryKeys.personas.current() });
        }
      },
    });
  };

  return (
    <div className="flex flex-col gap-12">
      <ProjectPageHeader
        projectId={project.id}
        breadcrumb={`${project.name} / 사전 테스트 · 테스트`}
        title="새 테스트"
        activeTab="tests"
      />

      <Stepper steps={STEPS.map((key) => STEP_LABELS[key])} current={STEPS.indexOf(step)} />

      {step === "site" && (
        <SiteStep
          notice={notice}
          /* 사이트를 다시 확인하면 만료 안내는 지웁니다 */
          onDiscovered={() => setNotice(null)}
          onNext={() => goTo("task")}
        />
      )}
      {step === "task" && plan && (
        <TaskTargetStep
          plan={plan}
          profileCount={profileCount}
          onPrev={() => goTo("site")}
          onNext={() => goTo("persona")}
        />
      )}
      {step === "persona" && (
        <PersonaStep
          profiles={profiles}
          taskCount={taskCount}
          accountCount={loginMode === "account" ? accountCount : 0}
          onPrev={() => goTo("task")}
          onNext={() => goTo("confirm")}
        />
      )}
      {step === "confirm" && plan && (
        <ConfirmStep
          projectId={project.id}
          plan={plan}
          profileCount={profileCount}
          isStarting={confirm.isPending}
          error={confirm.error}
          currentRunId={currentRun.data?.id ?? null}
          onPrev={() => goTo("persona")}
          onStart={start}
          onExpired={() => backToSite(EXPIRED_NOTICE)}
        />
      )}
    </div>
  );
}
