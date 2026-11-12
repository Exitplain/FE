import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import ProjectPageHeader from "@/components/ProjectPageHeader/ProjectPageHeader";
import Stepper from "@/components/Stepper/Stepper";
import { findSampleProject } from "@/constants/projects";
import { buildPath } from "@/constants/routes";
import { usePersonaRun } from "@/hooks/usePersonaRun";
import { PROFILES } from "@/mocks/fixtures/personas";
import { useNewTestStore } from "@/stores/useNewTestStore";

import ConfirmStep from "./components/ConfirmStep";
import PersonaStep from "./components/PersonaStep";
import SiteStep from "./components/SiteStep";
import TaskTargetStep from "./components/TaskTargetStep";
import { useConfirmRun } from "./hooks/useNewTestMutations";
import { buildConfirmRequest, parseStep, STEP_LABELS, STEPS, type StepKey } from "./utils/newTest";

/*
  P02~P05c 새 테스트 (단계: ?step=site|task|persona|confirm)
  - 입력은 useNewTestStore 에 두어 단계를 오가도 남습니다. 프로젝트가 바뀌면 처음부터 시작합니다.
  - 사이트 확인(탐색 계획)이 없으면 어느 단계 주소로 들어와도 첫 단계를 보여줍니다.
*/
export default function NewTestPage() {
  const { projectId } = useParams();
  const project = findSampleProject(projectId);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const store = useNewTestStore();
  const currentRun = usePersonaRun();
  const confirm = useConfirmRun();
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (project && store.projectId !== project.id) store.reset(project.id, project.url);
  }, [project, store]);

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
  /* 다른 프로젝트의 입력이 한 번이라도 보이지 않게 초기화가 끝날 때까지 기다립니다 */
  if (store.projectId !== project.id) return null;

  const plan = store.plan;
  const step: StepKey = plan ? parseStep(searchParams.get("step")) : "site";
  /* 실행 전에는 현재 실행 응답의 고정 프로필을 쓰고, 아직 못 받았으면 BE 와 같은 기본값 */
  const profiles = currentRun.data?.profiles.length ? currentRun.data.profiles : PROFILES;

  const goTo = (next: StepKey) => {
    setNotice(null);
    confirm.reset();
    setSearchParams(next === "site" ? {} : { step: next });
    window.scrollTo?.({ top: 0 });
  };

  const backToSite = (message: string) => {
    store.clearPlan();
    setNotice(message);
    setSearchParams({});
  };

  const start = () => {
    if (!plan) return;
    confirm.mutate(buildConfirmRequest(plan, store), {
      onSuccess: (run) => {
        store.reset(project.id, project.url);
        navigate(buildPath("testRun", { projectId: project.id, runId: run.id ?? "current" }));
      },
      onError: (error) => {
        if (error.status === 400) {
          backToSite(`탐색 결과가 만료됐어요 · ${error.message} 사이트를 다시 확인해 주세요`);
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

      {step === "site" && <SiteStep notice={notice} onNext={() => goTo("task")} />}
      {step === "task" && plan && (
        <TaskTargetStep
          plan={plan}
          profileCount={profiles.length}
          onPrev={() => goTo("site")}
          onNext={() => goTo("persona")}
        />
      )}
      {step === "persona" && (
        <PersonaStep
          profiles={profiles}
          taskCount={store.taskIds.length}
          accountCount={store.loginMode === "account" ? store.accounts.length : 0}
          onPrev={() => goTo("task")}
          onNext={() => goTo("confirm")}
        />
      )}
      {step === "confirm" && plan && (
        <ConfirmStep
          projectId={project.id}
          plan={plan}
          profileCount={profiles.length}
          isStarting={confirm.isPending}
          error={confirm.error}
          currentRunId={currentRun.data?.id ?? null}
          onPrev={() => goTo("persona")}
          onStart={start}
          onExpired={() => backToSite("사이트를 다시 확인해 주세요")}
        />
      )}
    </div>
  );
}
