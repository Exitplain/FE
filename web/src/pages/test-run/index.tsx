import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { buttonVariants } from "@/components/Button/buttonVariants";
import Button from "@/components/Button/Button";
import ProjectPageHeader from "@/components/ProjectPageHeader/ProjectPageHeader";
import StatusBadge from "@/components/StatusBadge/StatusBadge";
import { findSampleProject, type SampleProject } from "@/constants/projects";
import { buildPath } from "@/constants/routes";
import { usePersonaReports } from "@/hooks/usePersonaReports";
import { usePersonaRun } from "@/hooks/usePersonaRun";
import type { PersonaRun } from "@/types/persona.type";

import ActionFeed from "./components/ActionFeed";
import RunProgress from "./components/RunProgress";
import { PreparingChecklist, RunCompleted, RunFailed } from "./components/RunStates";
import SessionBoard from "./components/SessionBoard";
import SessionLive from "./components/SessionLive";
import { runPhase, type RunPhase, taskOptions } from "./utils/runView";

const PHASE_BADGE = {
  preparing: { icon: "status-wait", label: "준비 중", tone: "muted" },
  running: { icon: "play", label: "실행 중", tone: "strong" },
  completed: { icon: "check", label: "완료", tone: "muted" },
  failed: { icon: "status-error", label: "실패", tone: "alert" },
} as const satisfies Record<Exclude<RunPhase, "idle">, object>;

/*
  P08~P11 실행 화면 (/projects/:projectId/runs/:runId, 세션 라이브는 ?session=)
  - GET /api/personas 를 실행 중일 때 2초마다 조회합니다(usePersonaRun).
  - BE 는 현재 실행 하나만 조회할 수 있어, 주소의 runId 가 현재 실행이 아니면 목록·리포트로 안내합니다.
  - P06 페르소나 생성 중 · P07 페르소나 확인은 BE confirm 이 바로 실행을 시작해 없습니다.
*/
export default function TestRunPage() {
  const { projectId, runId } = useParams();
  const project = findSampleProject(projectId);

  if (!project || !runId) {
    return (
      <section className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold text-ink">프로젝트를 찾을 수 없어요</h1>
        <p className="text-sm text-subtle">
          주소를 확인하거나 사이드바에서 프로젝트를 골라 주세요.
        </p>
      </section>
    );
  }
  return <RunView project={project} runId={runId} />;
}

function RunView({ project, runId }: { project: SampleProject; runId: string }) {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session");
  const currentRun = usePersonaRun();
  const run = currentRun.data;

  if (currentRun.isPending) {
    return (
      <p role="status" className="py-8 text-sm text-muted">
        실행 상태를 불러오는 중이에요…
      </p>
    );
  }
  if (currentRun.isError && !run) {
    return (
      <div
        role="alert"
        className="flex items-center justify-between gap-4 rounded-lg bg-gray-50 p-4"
      >
        <p className="text-sm text-ink">
          실행 상태를 불러오지 못했어요. 서버 연결을 확인해 주세요.
        </p>
        <Button variant="secondary" icon="retry" onClick={() => void currentRun.refetch()}>
          다시 시도
        </Button>
      </div>
    );
  }
  if (!run || run.id !== runId || run.status === "idle") {
    return <RunNotCurrent project={project} runId={runId} />;
  }

  const session = sessionId ? run.sessions.find((item) => item.id === sessionId) : undefined;
  if (sessionId && session) return <SessionLive project={project} session={session} />;

  return (
    <RunDashboard project={project} run={run} missingSession={sessionId != null && !session} />
  );
}

function RunDashboard({
  project,
  run,
  missingSession,
}: {
  project: SampleProject;
  run: PersonaRun;
  missingSession: boolean;
}) {
  const phase = runPhase(run);
  const tasks = taskOptions(run.sessions);
  const [taskId, setTaskId] = useState<string | null>(null);
  const activeTaskId = taskId ?? tasks[0]?.id ?? "";
  const elapsedMs = useElapsed(run.created_at, phase === "preparing" || phase === "running");

  const title =
    tasks.length > 1
      ? `${tasks[0].name} 외 ${tasks.length - 1}개`
      : (tasks[0]?.name ?? "사전 테스트");
  const profileCount = new Set(run.sessions.map((session) => session.profile_id)).size;
  const badge = phase === "idle" ? null : PHASE_BADGE[phase];

  return (
    <div className="flex flex-col gap-12">
      <ProjectPageHeader
        projectId={project.id}
        breadcrumb={`${project.name} / 사전 테스트 · 테스트`}
        title={title}
        description={`과업 ${tasks.length}개 · 프로필 ${profileCount}개 · 세션 ${run.sessions.length}개 · 동시 3세션`}
        activeTab="tests"
        actions={badge && <StatusBadge {...badge} />}
      />

      {missingSession && (
        <p role="status" className="rounded-lg bg-gray-50 p-3 text-caption text-subtle">
          고른 세션을 이 실행에서 찾지 못해 실행 화면을 보여드려요
        </p>
      )}

      {phase === "failed" ? (
        <RunFailed run={run} projectId={project.id} />
      ) : (
        <>
          {phase === "completed" && <RunCompleted run={run} projectId={project.id} />}
          <RunProgress
            sessions={run.sessions}
            taskId={activeTaskId}
            onTaskChange={setTaskId}
            elapsedMs={phase === "completed" ? null : elapsedMs}
          />
          {phase === "preparing" && <PreparingChecklist run={run} />}
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <SessionBoard
                key={activeTaskId}
                sessions={run.sessions.filter((session) => session.task_id === activeTaskId)}
              />
            </div>
            <ActionFeed
              sessions={run.sessions.filter((session) => session.task_id === activeTaskId)}
            />
          </div>
        </>
      )}
    </div>
  );
}

/* 실행 시작 시각부터 지난 시간. 진행 중일 때만 1초마다 갱신합니다 */
function useElapsed(createdAt: string | undefined, ticking: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!ticking) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [ticking]);
  if (!createdAt) return null;
  const started = new Date(createdAt).getTime();
  return Number.isNaN(started) ? null : now - started;
}

/* 주소의 실행이 현재 실행이 아님 — 완료된 실행이면 리포트로, 아니면 목록으로 */
function RunNotCurrent({ project, runId }: { project: SampleProject; runId: string }) {
  const reports = usePersonaReports();
  const isCompleted = reports.data?.some((report) => report.run_id === runId) ?? false;

  return (
    <div className="flex flex-col gap-12">
      <ProjectPageHeader
        projectId={project.id}
        breadcrumb={`${project.name} / 사전 테스트 · 테스트`}
        title="사전 테스트 실행"
        activeTab="tests"
      />
      <section className="flex flex-col items-start gap-4 rounded-xl bg-gray-50 p-6">
        <h2 className="text-lg font-bold text-ink">
          {isCompleted ? "이미 끝난 실행이에요" : "이 실행을 찾을 수 없어요"}
        </h2>
        <p className="text-sm text-subtle">
          {isCompleted
            ? "결과는 리포트에서 볼 수 있어요."
            : "지금 개발 서버는 진행 중인 실행 하나만 보여줄 수 있어요."}
        </p>
        <div className="flex gap-2">
          {isCompleted && (
            <Link
              to={buildPath("report", { projectId: project.id, runId })}
              className={buttonVariants()}
            >
              리포트 보기
            </Link>
          )}
          <Link
            to={buildPath("testList", { projectId: project.id })}
            className={buttonVariants({ variant: "secondary" })}
          >
            사전 테스트 목록
          </Link>
        </div>
      </section>
    </div>
  );
}
