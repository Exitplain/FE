import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";

import { buttonVariants } from "@/components/Button/buttonVariants";
import Button from "@/components/Button/Button";
import ProjectPageHeader from "@/components/ProjectPageHeader/ProjectPageHeader";
import StatusBadge from "@/components/StatusBadge/StatusBadge";
import { findSampleProject, type SampleProject } from "@/constants/projects";
import { buildPath } from "@/constants/routes";
import { useRetestStore } from "@/stores/useRetestStore";
import { usePersonaReports } from "@/hooks/usePersonaReports";
import { usePersonaRun } from "@/hooks/usePersonaRun";
import type { PersonaRun } from "@/types/persona.type";
import { RUN_CONDITIONS } from "@/pages/new-test/utils/newTest";

import RunProgress from "./components/RunProgress";
import {
  AnalyzingChecklist,
  PreparingChecklist,
  RunCompleted,
  RunFailed,
  RunStopped,
} from "./components/RunStates";
import SessionBoard from "./components/SessionBoard";
import SessionLive from "./components/SessionLive";
import ThinkAloudFeed from "./components/ThinkAloudFeed";
import { useRunTitle } from "./hooks/useRunTitle";
import {
  FILTER_LABELS,
  runPhase,
  type RunPhase,
  type SessionFilter,
  taskOptions,
} from "./utils/runView";

const FILTER_KEYS = Object.keys(FILTER_LABELS) as SessionFilter[];

/* Figma 제목 오른쪽 상태 (E12 비용 상한은 배너로 알려 상태 표시가 없습니다) */
const PHASE_BADGE = {
  preparing: { icon: "status-wait", label: "준비 중", tone: "muted" },
  running: { icon: "play", label: "실행 중", tone: "strong" },
  analyzing: { icon: "search", label: "분석 중", tone: "muted" },
  completed: { icon: "check", label: "완료", tone: "muted" },
  failed: { icon: "status-error", label: "실패", tone: "alert" },
} as const satisfies Record<Exclude<RunPhase, "idle" | "stopped">, object>;

/* 실행 조건 첫 항목 ("모바일 390") */
const DEVICE = RUN_CONDITIONS.split(" · ")[0];

/*
  P08~P11 실행 화면 (/projects/:projectId/runs/:runId, 세션 라이브는 ?session=)
  - GET /api/personas 를 실행 중일 때 2초마다 조회합니다(usePersonaRun).
  - BE 는 현재 실행 하나만 조회할 수 있어, 주소의 runId 가 현재 실행이 아니면 목록·리포트로 안내합니다.
  - P08 준비 → P09 실행 → P10 분석 → 리포트(자동 이동), 실패는 E05, 비용 상한은 E12.
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
  /* 실행 화면으로 돌아갈 때 과업·필터는 남기고 세션만 뺍니다 */
  const backParams = new URLSearchParams(searchParams);
  backParams.delete("session");
  const backSearch = backParams.toString() ? `?${backParams}` : "";

  return (
    <>
      {/* 받아 둔 화면은 그대로 두고, 최신 상태를 못 받는 동안 알립니다 (polling 중 서버 끊김 등) */}
      {currentRun.isError && (
        <div
          role="alert"
          className="mb-6 flex items-center justify-between gap-4 rounded-lg bg-gray-50 p-3"
        >
          <p className="text-caption text-ink">
            최신 상태를 불러오지 못했어요 · 아래는 마지막으로 받은 상태예요
          </p>
          <Button
            variant="secondary"
            icon="retry"
            disabled={currentRun.isFetching}
            onClick={() => void currentRun.refetch()}
          >
            다시 시도
          </Button>
        </div>
      )}
      {sessionId && session ? (
        <SessionLive project={project} run={run} session={session} backSearch={backSearch} />
      ) : (
        <RunDashboard project={project} run={run} missingSession={sessionId != null && !session} />
      )}
    </>
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
  const navigate = useNavigate();
  const tasks = taskOptions(run.sessions);
  const { order, summary, title } = useRunTitle(run);
  /* 과업·상태 필터는 주소에 두어 세션 라이브에 갔다 와도 유지합니다 */
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTask = searchParams.get("task");
  const activeTaskId = tasks.some((task) => task.id === requestedTask)
    ? requestedTask!
    : (tasks[0]?.id ?? "");
  const requestedFilter = searchParams.get("filter");
  const filter: SessionFilter = (FILTER_KEYS as string[]).includes(requestedFilter ?? "")
    ? (requestedFilter as SessionFilter)
    : "all";
  /* 과업·필터를 바꾸면 찾지 못한 세션 값(?session=)도 함께 지웁니다 */
  const updateQuery = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    next.delete("session");
    for (const [key, value] of Object.entries(patch)) {
      if (value == null) next.delete(key);
      else next.set(key, value);
    }
    setSearchParams(next, { replace: true });
  };
  const taskSessions = run.sessions.filter((session) => session.task_id === activeTaskId);
  const elapsedMs = useElapsed(
    run.created_at,
    phase === "preparing" || phase === "running" || phase === "analyzing",
  );

  /*
    P10: 분석 화면을 보던 중 끝나면 리포트로 자동 이동합니다 (이미 끝난 실행을 연 경우는 요약만).
    P17 에서 "끝나면 자동으로 비교하기"를 고른 재테스트는 리포트 대신 P18 전후 비교로 갑니다.
  */
  const sawAnalyzing = useRef(false);
  useEffect(() => {
    if (phase === "analyzing") sawAnalyzing.current = true;
    if (phase !== "completed" || !sawAnalyzing.current || !run.id) return;
    const retest = useRetestStore.getState().byRunId[run.id];
    if (retest?.autoCompare) {
      useRetestStore.getState().consumeAutoCompare(run.id);
      navigate(
        {
          pathname: buildPath("retest", { projectId: project.id, runId: retest.baseRunId }),
          search: `?b=${encodeURIComponent(run.id)}`,
        },
        { replace: true },
      );
      return;
    }
    navigate(buildPath("report", { projectId: project.id, runId: run.id }), { replace: true });
  }, [phase, run.id, project.id, navigate]);

  const panelSize =
    run.panel?.reduce((total, segment) => total + segment.count, 0) ?? taskSessions.length;
  const seeds = run.seeds ?? { current: 1, total: 1 };
  const condition = [
    `과업 ${tasks.length}개`,
    /* Figma P10 은 기기 조건을 빼고 보여줍니다 */
    ...(phase === "analyzing" ? [] : [DEVICE]),
    `${panelSize}명 × 시드 ${seeds.total}회 (${seeds.current}/${seeds.total})`,
  ].join(" · ");
  const ended = phase === "failed" || phase === "stopped";
  const badge = phase === "idle" || phase === "stopped" ? null : PHASE_BADGE[phase];

  return (
    <div className="flex flex-col gap-12">
      <ProjectPageHeader
        projectId={project.id}
        breadcrumb={`${project.name} / 사전 테스트 · 테스트`}
        /* E05·E12 는 "과업 · n차" 순서이고 실행 조건 줄이 없습니다 */
        title={ended ? `${summary} · ${order}차` : title}
        description={ended ? undefined : condition}
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
      ) : phase === "stopped" ? (
        <RunStopped run={run} projectId={project.id} />
      ) : (
        <>
          {phase === "completed" && <RunCompleted run={run} projectId={project.id} />}
          <RunProgress
            phase={phase}
            sessions={run.sessions}
            taskId={activeTaskId}
            onTaskChange={(id) => {
              /* 지금 과업을 다시 누른 경우에는 필터를 그대로 둡니다 */
              if (id !== activeTaskId) updateQuery({ task: id, filter: null });
            }}
            elapsedMs={phase === "completed" ? null : elapsedMs}
            nextHint={
              phase === "preparing"
                ? `다음: 세션 ${taskSessions.length}개와 Think-aloud (자동 전환)`
                : phase === "analyzing"
                  ? "다음: 리포트 (자동 이동)"
                  : undefined
            }
            checklist={
              phase === "preparing" ? (
                <PreparingChecklist run={run} panelSize={panelSize} />
              ) : phase === "analyzing" ? (
                <AnalyzingChecklist run={run} />
              ) : undefined
            }
          />
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <SessionBoard
                sessions={taskSessions}
                filterable={phase === "running"}
                filter={filter}
                onFilterChange={(next) => updateQuery({ filter: next === "all" ? null : next })}
                sessionSearch={(id) => {
                  const next = new URLSearchParams(searchParams);
                  next.set("session", id);
                  return `?${next}`;
                }}
              />
            </div>
            <ThinkAloudFeed sessions={taskSessions} />
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
  /* 목록을 받기 전에는 "찾을 수 없음"을 먼저 보여주지 않습니다 */
  const title = reports.isPending
    ? "실행을 확인하는 중이에요"
    : isCompleted
      ? "이미 끝난 실행이에요"
      : "이 실행을 찾을 수 없어요";

  return (
    <div className="flex flex-col gap-12">
      <ProjectPageHeader
        projectId={project.id}
        breadcrumb={`${project.name} / 사전 테스트 · 테스트`}
        title="사전 테스트 실행"
        activeTab="tests"
      />
      <section className="flex flex-col items-start gap-4 rounded-xl bg-gray-50 p-6">
        <h2 className="text-lg font-bold text-ink">{title}</h2>
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
