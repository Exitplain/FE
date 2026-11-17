import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";

import { buttonVariants } from "@/components/Button/buttonVariants";
import Button from "@/components/Button/Button";
import ProjectPageHeader from "@/components/ProjectPageHeader/ProjectPageHeader";
import StatusBadge from "@/components/StatusBadge/StatusBadge";
import { useCurrentProject, type CurrentProject } from "@/components/Projects/currentProject";
import { buildPath } from "@/constants/routes";
import { useRetestStore } from "@/stores/useRetestStore";
import { useRunDetail } from "@/pages/report/hooks/useRunReport";
import { useToastStore } from "@/stores/useToastStore";
import { ApiError } from "@/types/api.type";
import type { PersonaRun } from "@/types/persona.type";
import type { RunDetail } from "@/types/run.type";
import { RUN_DEVICE } from "@/pages/new-test/utils/newTest";

import RunProgress from "./components/RunProgress";
import {
  AnalyzingChecklist,
  PreparingChecklist,
  RunCancelled,
  RunCompleted,
  RunFailed,
} from "./components/RunStates";
import SessionBoard from "./components/SessionBoard";
import SessionLive from "./components/SessionLive";
import ThinkAloudFeed from "./components/ThinkAloudFeed";
import { useCancelRun, useRunEvents, useRunSessions } from "./hooks/useRunData";
import { runTitle } from "./hooks/useRunTitle";
import { toPersonaRun, v1Phase } from "./utils/runAdapter";
import { FILTER_LABELS, type RunPhase, type SessionFilter, taskOptions } from "./utils/runView";

const FILTER_KEYS = Object.keys(FILTER_LABELS) as SessionFilter[];

/* Figma 제목 오른쪽 상태 (중지는 Figma 에 없어 임시 표시) */
const PHASE_BADGE = {
  preparing: { icon: "status-wait", label: "준비 중", tone: "muted" },
  running: { icon: "play", label: "실행 중", tone: "strong" },
  analyzing: { icon: "search", label: "분석 중", tone: "muted" },
  completed: { icon: "check", label: "완료", tone: "muted" },
  failed: { icon: "status-error", label: "실패", tone: "alert" },
  cancelled: { icon: "close", label: "중지됨", tone: "muted" },
} as const satisfies Record<Exclude<RunPhase, "idle" | "stopped">, object>;

/* 실행 조건 첫 항목 ("모바일 390") */
const DEVICE = RUN_DEVICE;

/*
  P08~P11 실행 화면 (/projects/:projectId/runs/:runId, 세션 라이브는 ?session=)
  - 제품 API: 실행 상태(GET /api/v1/runs/{id}) · 세션(/sessions) · 관찰·행동 이벤트(/events?after=)를
    진행 중일 때 2초마다 받습니다. 화면 값으로는 utils/runAdapter 가 한 번에 바꿉니다.
  - P08 준비 → P09 실행 → P10 분석 → 리포트(자동 이동), 실패는 E05, 중지는 임시 상태.
  - 진행 중이면 중지할 수 있습니다 (POST /api/v1/runs/{id}/cancel, 프로젝트 소유자만).
*/
export default function TestRunPage() {
  const { runId } = useParams();
  const project = useCurrentProject();

  if (!runId) {
    return (
      <section className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold text-ink">프로젝트를 찾을 수 없어요</h1>
        <p className="text-sm text-subtle">
          주소를 확인하거나 사이드바에서 프로젝트를 골라 주세요.
        </p>
      </section>
    );
  }
  /* 다른 실행으로 옮기면 이벤트 커서·완료 감지 같은 화면 상태를 처음부터 다시 둡니다 */
  return <RunView key={runId} project={project} runId={runId} />;
}

function RunView({ project, runId }: { project: CurrentProject; runId: string }) {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session");
  const detail = useRunDetail(runId);
  const phase = detail.data ? v1Phase(detail.data) : null;
  const active = phase === "preparing" || phase === "running" || phase === "analyzing";
  const sessions = useRunSessions(runId, active);
  const events = useRunEvents(runId, active);
  /*
    이 화면에서 진행 중인 실행을 본 적이 있는지. 끝나면 리포트로 자동 이동하는 조건입니다
    (분석 단계가 polling 간격보다 짧게 지나가도, 세션 라이브를 보던 중이어도 이동하도록 여기서 기억).
    처음부터 끝난 실행을 열었다면 이동하지 않고 요약만 보여 줍니다.
  */
  const [sawActive, setSawActive] = useState(false);
  if (active && !sawActive) setSawActive(true);

  /* 끝나는 순간 마지막 세션·이벤트를 한 번 더 받습니다 (진행 중에만 주기 조회하므로) */
  const wasActive = useRef(active);
  const { refetch: refetchSessions } = sessions;
  const { refetch: refetchEvents } = events;
  useEffect(() => {
    if (wasActive.current && !active) {
      void refetchSessions();
      void refetchEvents();
    }
    wasActive.current = active;
  }, [active, refetchSessions, refetchEvents]);

  if (detail.isPending) {
    return (
      <p role="status" className="py-8 text-sm text-muted">
        실행 상태를 불러오는 중이에요…
      </p>
    );
  }
  if (detail.isError && !detail.data) {
    const status = detail.error instanceof ApiError ? detail.error.status : null;
    if (status === 404) return <RunNotFound project={project} />;
    return (
      <div
        role="alert"
        className="flex items-center justify-between gap-4 rounded-lg bg-gray-50 p-4"
      >
        <p className="text-sm text-ink">
          {status === 401
            ? "로그인이 필요해요"
            : status === 403
              ? "이 실행을 볼 권한이 없어요"
              : "실행 상태를 불러오지 못했어요. 서버 연결을 확인해 주세요."}
        </p>
        <Button variant="secondary" icon="retry" onClick={() => void detail.refetch()}>
          다시 시도
        </Button>
      </div>
    );
  }

  /* ?session= 으로 들어왔는데 세션 목록이 아직 없으면 "찾지 못함" 안내가 깜박이지 않게 기다립니다 */
  if (sessionId && sessions.isPending) {
    return (
      <p role="status" className="py-8 text-sm text-muted">
        실행 상태를 불러오는 중이에요…
      </p>
    );
  }

  const run = toPersonaRun(detail.data!, sessions.data?.items ?? [], events.data);
  const session = sessionId ? run.sessions.find((item) => item.id === sessionId) : undefined;
  /* 실행 화면으로 돌아갈 때 과업·필터는 남기고 세션만 뺍니다 */
  const backParams = new URLSearchParams(searchParams);
  backParams.delete("session");
  const backSearch = backParams.toString() ? `?${backParams}` : "";
  const failedToRefresh = detail.isError || sessions.isError || events.isError;

  return (
    <>
      {/* 받아 둔 화면은 그대로 두고, 최신 상태를 못 받는 동안 알립니다 (polling 중 서버 끊김 등) */}
      {failedToRefresh && (
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
            disabled={detail.isFetching || sessions.isFetching || events.isFetching}
            onClick={() => {
              void detail.refetch();
              void sessions.refetch();
              void events.refetch();
            }}
          >
            다시 시도
          </Button>
        </div>
      )}
      {sessionId && session ? (
        <SessionLive project={project} run={run} session={session} backSearch={backSearch} />
      ) : (
        <RunDashboard
          project={project}
          detail={detail.data!}
          phase={phase!}
          run={run}
          totalSessions={sessions.data?.total ?? run.sessions.length}
          autoNavigate={sawActive}
          missingSession={sessionId != null && !session}
        />
      )}
    </>
  );
}

function RunDashboard({
  project,
  detail,
  phase,
  run,
  totalSessions,
  autoNavigate,
  missingSession,
}: {
  project: CurrentProject;
  detail: RunDetail;
  phase: RunPhase;
  run: PersonaRun;
  /* 서버의 전체 세션 수 (한 번에 200개까지만 받아 화면 수보다 많을 수 있음) */
  totalSessions: number;
  /* 진행 중인 실행을 이 화면에서 봤으면 끝날 때 리포트로 자동 이동합니다 */
  autoNavigate: boolean;
  missingSession: boolean;
}) {
  const navigate = useNavigate();
  const tasks = taskOptions(run.sessions);
  const { order, summary, title } = runTitle(run);
  const cancel = useCancelRun(detail.id);
  const showToast = useToastStore((state) => state.show);
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
  useEffect(() => {
    if (phase !== "completed" || !autoNavigate || !run.id) return;
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
  }, [phase, autoNavigate, run.id, project.id, navigate]);

  /* 제품 API 는 패널·시드 수를 주지 않아, 이 과업의 페르소나 수와 서버의 예상 세션 수로 보여 줍니다 */
  const panelSize = new Set(taskSessions.map((session) => session.code)).size;
  const condition = [
    /* 세션이 시작돼야 과업을 알 수 있어 준비 중에는 뺍니다 */
    ...(tasks.length > 0 ? [`과업 ${tasks.length}개`] : []),
    /* Figma P10 은 기기 조건을 빼고 보여줍니다 */
    ...(phase === "analyzing" ? [] : [DEVICE]),
    `세션 ${detail.progress.started_sessions} / ${detail.progress.expected_sessions}`,
  ].join(" · ");
  const ended = phase === "failed" || phase === "cancelled";
  const badge = phase === "idle" || phase === "stopped" ? null : PHASE_BADGE[phase];
  const active = phase === "preparing" || phase === "running" || phase === "analyzing";
  /* 분석 중(finalizing)에는 리포트를 만들고 있어 중지를 보여 주지 않습니다 */
  const cancellable = phase === "preparing" || phase === "running";
  const waiting = Math.max(0, detail.progress.expected_sessions - detail.progress.started_sessions);

  const requestCancel = () => {
    if (!window.confirm("진행 중인 테스트를 중지할까요? 끝난 세션까지만 기록돼요")) return;
    cancel.mutate(undefined, {
      onError: (error) => {
        /* 이미 끝났으면(409) 상태만 다시 받아 맞춥니다 */
        if (error.code === "RUN_NOT_ACTIVE") return;
        showToast(
          error.status === 403
            ? "이 실행을 중지할 권한이 없어요"
            : "중지하지 못했어요. 다시 시도해 주세요",
          "status-error",
        );
      },
    });
  };

  return (
    <div className="flex flex-col gap-12">
      <ProjectPageHeader
        projectId={project.id}
        breadcrumb={`${project.name} / 사전 테스트 · 테스트`}
        /* E05·E12 는 "과업 · n차" 순서이고 실행 조건 줄이 없습니다 */
        title={ended ? `${summary} · ${order}차` : title}
        description={ended ? undefined : condition}
        activeTab="tests"
        actions={
          <>
            {badge && (
              <StatusBadge
                {...(active && detail.cancel_requested
                  ? ({ icon: "status-wait", label: "중지하는 중", tone: "muted" } as const)
                  : badge)}
              />
            )}
            {/* 임시: 중지 버튼은 Figma 에 없어 최소 형태로 둡니다 */}
            {cancellable && !detail.cancel_requested && (
              <Button variant="secondary" disabled={cancel.isPending} onClick={requestCancel}>
                {cancel.isPending ? "중지하는 중…" : "중지"}
              </Button>
            )}
          </>
        }
      />

      {missingSession && (
        <p role="status" className="rounded-lg bg-gray-50 p-3 text-caption text-subtle">
          고른 세션을 이 실행에서 찾지 못해 실행 화면을 보여드려요
        </p>
      )}

      {phase === "failed" ? (
        <RunFailed run={run} projectId={project.id} message={detail.error?.message} />
      ) : phase === "cancelled" ? (
        <RunCancelled projectId={project.id} reportRunId={detail.report ? detail.id : null} />
      ) : (
        <>
          {phase === "completed" && (
            <RunCompleted
              run={run}
              projectId={project.id}
              partial={detail.status === "partially_completed"}
            />
          )}
          {totalSessions > run.sessions.length && (
            <p role="status" className="rounded-lg bg-gray-50 p-3 text-caption text-subtle">
              세션 {totalSessions}개 중 {run.sessions.length}개만 보여드려요
            </p>
          )}
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
                ? `다음: 세션 ${detail.progress.expected_sessions}개와 Think-aloud (자동 전환)`
                : phase === "analyzing"
                  ? "다음: 리포트 (자동 이동)"
                  : phase === "running" && waiting > 0
                    ? `대기 ${waiting}`
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

/* 없는 실행 (404) */
function RunNotFound({ project }: { project: CurrentProject }) {
  return (
    <div className="flex flex-col gap-12">
      <ProjectPageHeader
        projectId={project.id}
        breadcrumb={`${project.name} / 사전 테스트 · 테스트`}
        title="사전 테스트 실행"
        activeTab="tests"
      />
      <section className="flex flex-col items-start gap-4 rounded-xl bg-gray-50 p-6">
        <h2 className="text-lg font-bold text-ink">이 실행을 찾을 수 없어요</h2>
        <p className="text-sm text-subtle">삭제됐거나 주소가 잘못됐을 수 있어요.</p>
        <Link
          to={buildPath("testList", { projectId: project.id })}
          className={buttonVariants({ variant: "secondary" })}
        >
          사전 테스트 목록
        </Link>
      </section>
    </div>
  );
}
