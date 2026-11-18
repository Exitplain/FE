import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";

import Button from "@/components/Button/Button";
import ProjectPageHeader from "@/components/ProjectPageHeader/ProjectPageHeader";
import { useCurrentProject, type CurrentProject } from "@/components/Projects/currentProject";
import RangeBarChart from "@/components/RangeBarChart/RangeBarChart";
import WorkspaceState from "@/components/Workspace/WorkspaceState";
import { useRunList } from "@/hooks/useRunList";
import { useDemoSessionStore } from "@/stores/useDemoSessionStore";
import { ApiError } from "@/types/api.type";
import type { RunReport, ReportTaskV1 } from "@/types/report.type";
import { ACTIVE_RUN_STATUSES } from "@/types/run.type";
import { cn } from "@/utils/cn";

import ExportMenu from "./components/ExportMenu";
import KpiRow from "./components/KpiRow";
import ReportSection from "./components/ReportSection";
import {
  ReportError,
  ReportForbidden,
  ReportGenerating,
  ReportLoading,
  ReportLoginRequired,
  ReportNotFound,
  ReportPending,
  ReportUnavailable,
} from "./components/ReportStates";
import ReportToolbar from "./components/ReportToolbar";
import RetestModal from "./components/RetestModal";
import SegmentHeatmap from "./components/SegmentHeatmap";
import ShareModal from "./components/ShareModal";
import TaskOverview from "./components/TaskOverview";
import TechnicalFailures from "./components/TechnicalFailures";
import { FrictionCauses, ProblemScreens, ScreenWalkthrough } from "./components/ScreenSections";
import { useReportScreens, useRunDetail, useRunReport } from "./hooks/useRunReport";
import {
  ALL_TASKS,
  causeRowsV1,
  describeReport,
  funnelMax,
  funnelRowsV1,
  heatmapV1,
} from "./utils/reportData";

/*
  섹션 이동 (Figma SectionNav 순서).
  개선 Top 3·실측 비교는 제품 API 리포트에 아직 데이터(findings·실측)가 없어 숨깁니다.
*/
const SECTIONS = [
  { id: "summary", label: "요약" },
  { id: "screens", label: "화면 둘러보기" },
  { id: "problems", label: "문제 화면" },
  { id: "funnel", label: "예측 퍼널" },
  { id: "heatmap", label: "히트맵" },
  { id: "causes", label: "원인 분포" },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];

/* 원인 분포는 상위 3개만 먼저 보여주고 나머지는 펼칩니다 */
const CAUSE_PREVIEW = 3;

/*
  P12 리포트 (+ P12c 실행 선택, E04 로딩, E18 기록 없음, E20 불러오기 실패)
  - 리포트: GET /api/v1/runs/{id}/reports (로그인 + 프로젝트 소유자만. 샘플 프로젝트도 같음)
  - 실행: GET /api/v1/runs/{id} — 차수와, 리포트가 아직 없을 때(404) 진행 중인지 판단
  - 과업은 주소 ?task= 로 둡니다 (새로 고침·공유해도 같은 과업)
  - 수정 후 재테스트(P17): 끝난 실행만, 같은 확정 계획으로 새 실행을 만듭니다
*/
export default function ReportPage() {
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

  /* 실행을 바꾸면 펼친 원인·섹션 선택을 처음으로 돌립니다 */
  return <Report key={runId} project={project} runId={runId} />;
}

function Report({ project, runId }: { project: CurrentProject; runId: string }) {
  const report = useRunReport(runId);
  const run = useRunDetail(runId);
  const runs = useRunList(project.v1Id);
  /* 재테스트가 받을 차수 — BE 처럼 프로젝트의 가장 큰 차수 + 1 (목록은 최신순) */
  const latestSequence = Math.max(
    run.data?.sequence_no ?? 0,
    ...(runs.data?.pages.flatMap((page) => page.items.map((item) => item.sequence_no)) ?? []),
  );
  const nextSequenceNo = latestSequence > 0 ? latestSequence + 1 : undefined;
  const openLogin = useDemoSessionStore((state) => state.openLogin);
  const [params, setParams] = useSearchParams();
  const [shareOpen, setShareOpen] = useState(false);
  const [retestOpen, setRetestOpen] = useState(false);

  const data = report.data?.data;
  const tasks = data?.tasks ?? [];
  /* ?task=all 이면 과업 "전체" (과업이 둘 이상일 때만) */
  const showAll = params.get("task") === ALL_TASKS && tasks.length > 1;
  const task = showAll
    ? undefined
    : (tasks.find((item) => item.task_id === params.get("task")) ?? tasks[0]);
  const order = run.data?.sequence_no;
  const title = showAll
    ? `전체 과업${order ? ` · ${order}차` : ""}`
    : task
      ? `${task.name}${order ? ` · ${order}차` : ""}`
      : order
        ? `${order}차 사전 테스트`
        : "사전 테스트 리포트";

  const status = report.error instanceof ApiError ? report.error.status : null;
  /* 받아 둔 리포트가 있으면 다시 받기에 실패해도 본문을 그대로 둡니다 (오류 화면과 겹치지 않게) */
  const failed = report.isError && report.data === undefined;
  const runActive = run.data ? ACTIVE_RUN_STATUSES.includes(run.data.status) : false;
  const runMissing = run.error instanceof ApiError && run.error.status === 404;

  /*
    이 화면에서 실행이 진행 중 → 끝남으로 바뀌면 새로 고치지 않아도 리포트를 다시 받습니다.
    (리포트가 아직 없던 경우(404)와 부분 리포트(partial)를 보던 경우 모두. 처음부터 끝난 실행이면 다시 받지 않음)
  */
  const runStatus = run.data?.status;
  const previousRunStatus = useRef(runStatus);
  const { refetch } = report;
  useEffect(() => {
    const wasActive =
      previousRunStatus.current !== undefined &&
      ACTIVE_RUN_STATUSES.includes(previousRunStatus.current);
    previousRunStatus.current = runStatus;
    if (wasActive && runStatus && !ACTIVE_RUN_STATUSES.includes(runStatus)) void refetch();
  }, [runStatus, refetch]);

  const selectTask = (taskId: string) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.set("task", taskId);
        return next;
      },
      { replace: true },
    );

  const notFoundState = () => {
    if (run.isPending) return <ReportLoading />;
    if (runActive) return <ReportPending projectId={project.id} runId={runId} />;
    if (runMissing || !run.data) return <ReportNotFound projectId={project.id} />;
    if (run.data.status === "failed" || run.data.status === "cancelled") {
      return <ReportUnavailable projectId={project.id} />;
    }
    /* 끝났는데 리포트가 아직 없으면(만드는 중·늦어짐) 다시 받을 수 있게 둡니다 */
    return <ReportGenerating onRetry={() => void report.refetch()} />;
  };

  return (
    <div className="flex flex-col gap-12">
      <ProjectPageHeader
        projectId={project.id}
        breadcrumb={`${project.name} / 사전 테스트 · 테스트`}
        title={title}
        description={report.data && describeReport(report.data.created_at, report.data.data)}
        toolbar={
          report.data && (
            <ReportToolbar
              projectId={project.id}
              runId={runId}
              run={run.data}
              createdAt={report.data.created_at}
              runs={runs.data?.pages.flatMap((page) => page.items) ?? []}
              tasks={tasks}
              taskId={showAll ? ALL_TASKS : task?.task_id}
              onTaskChange={selectTask}
            />
          )
        }
        actions={
          report.data && (
            <>
              <ExportMenu report={report.data} />
              <Button variant="secondary" icon="link" onClick={() => setShareOpen(true)}>
                공유 링크 복사
              </Button>
              {/* 진행 중인 실행은 아직 고칠 결과가 없어 재테스트하지 않습니다 */}
              {run.data && ["completed", "partially_completed"].includes(run.data.status) && (
                <Button onClick={() => setRetestOpen(true)}>수정 후 재테스트</Button>
              )}
            </>
          )
        }
        activeTab="tests"
      />

      {report.isPending && <ReportLoading />}
      {failed && status === 404 && notFoundState()}
      {failed && status === 401 && <ReportLoginRequired onLogin={openLogin} />}
      {failed && status === 403 && <ReportForbidden />}
      {failed && (status === null || ![401, 403, 404].includes(status)) && (
        <ReportError projectId={project.id} onRetry={() => void report.refetch()} />
      )}
      {report.data && showAll && (
        <TaskOverviewSection
          reportId={report.data.report_id}
          tasks={tasks}
          summary={report.data.data.summary}
          onOpen={(taskId) => {
            selectTask(taskId);
            window.scrollTo?.({ top: 0 });
          }}
        />
      )}
      {report.data &&
        !showAll &&
        (task ? (
          /* 과업을 바꾸면 원인 펼침을 그 과업 기준으로 처음부터 */
          <ReportBody key={task.task_id} task={task} reportId={report.data.report_id} />
        ) : (
          <ReportNoTasks />
        ))}
      {report.data && <ReportFooter report={report.data} projectId={project.id} runId={runId} />}
      {report.data && (
        <RetestModal
          open={retestOpen}
          onClose={() => setRetestOpen(false)}
          projectId={project.id}
          runId={runId}
          sequenceNo={run.data?.sequence_no}
          nextSequenceNo={nextSequenceNo}
          planRevisionId={report.data.plan_revision_id}
        />
      )}
      {report.data && (
        <ShareModal
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          reportId={report.data.report_id}
          taskId={task?.task_id}
        />
      )}
    </div>
  );
}

/*
  섹션 이동 (Figma SectionNav: 가로 전체 연회색 띠 · 지금 영역은 흰 바탕 굵은 글자).
  스크롤 이동이라 고르는 탭이 아니라 같은 화면 안 링크로 두고, 마지막으로 누른 영역을 표시합니다.
*/
function SectionNav({ hidden }: { hidden: SectionId[] }) {
  const [current, setCurrent] = useState<SectionId>("summary");
  return (
    <nav aria-label="리포트 영역">
      <ul className="flex gap-2 rounded-lg bg-gray-50 p-1">
        {SECTIONS.filter((section) => !hidden.includes(section.id)).map((section) => (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              aria-current={section.id === current ? "true" : undefined}
              onClick={(event) => {
                /* 라우터 주소(?task=)를 건드리지 않고 스크롤만 합니다 */
                event.preventDefault();
                setCurrent(section.id);
                const target = document.getElementById(section.id);
                if (!target) return;
                /* 키보드·스크린 리더 사용자도 이동한 영역에서 이어 읽도록 초점을 옮깁니다 */
                if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
                target.focus({ preventScroll: true });
                const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
                target.scrollIntoView?.({ behavior: reduce ? "auto" : "smooth", block: "start" });
              }}
              className={cn(
                "flex min-h-10 items-center rounded-md px-3 text-caption whitespace-nowrap focus-visible:outline-2 focus-visible:outline-ink",
                section.id === current
                  ? "bg-surface font-bold text-ink"
                  : "text-subtle hover:text-ink",
              )}
            >
              {section.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/* 과업 "전체": 화면 둘러보기 응답에서 과업별 가장 큰 문제 화면을 함께 보여 줍니다 */
function TaskOverviewSection({
  reportId,
  tasks,
  summary,
  onOpen,
}: {
  reportId: string;
  tasks: ReportTaskV1[];
  summary: RunReport["data"]["summary"];
  onOpen: (taskId: string) => void;
}) {
  const screens = useReportScreens(reportId);
  return (
    <section aria-labelledby="report-overview" className="flex flex-col gap-4">
      <h2 id="report-overview" className="sr-only">
        과업 전체 비교
      </h2>
      <TaskOverview
        tasks={tasks}
        summary={summary}
        screenTasks={screens.data?.available ? screens.data.tasks : undefined}
        onOpen={onOpen}
      />
    </section>
  );
}

function ReportNoTasks() {
  return (
    <WorkspaceState
      kind="empty"
      title="이 실행에는 과업 결과가 없어요"
      description="모든 세션이 기술 실패로 끝났을 수 있어요. 아래 기록을 확인해 보세요"
    />
  );
}

/* 기술 실패·해석의 한계는 과업과 상관없이 실행 전체 기준이라 늘 아래에 둡니다 */
function ReportFooter({
  report,
  projectId,
  runId,
}: {
  report: RunReport;
  projectId: string;
  runId: string;
}) {
  const { technical_failures: failures, tasks, notes } = report.data;
  return (
    <>
      <TechnicalFailures failures={failures} tasks={tasks} projectId={projectId} runId={runId} />
      {notes.length > 0 && (
        <ul aria-label="결과 해석의 한계" className="flex flex-col gap-1 text-xs text-muted">
          {notes.map((text) => (
            <li key={text}>· {text}</li>
          ))}
        </ul>
      )}
    </>
  );
}

function ReportBody({ task, reportId }: { task: ReportTaskV1; reportId: string }) {
  const [allCauses, setAllCauses] = useState(false);
  const causes = causeRowsV1(task);
  const shownCauses = allCauses ? causes : causes.slice(0, CAUSE_PREVIEW);
  const funnel = funnelRowsV1(task);
  const hasHeatmap = heatmapV1(task).rows.length > 0;
  /* 화면 둘러보기 (캡처가 있는 실행 리포트만). 마찰은 이탈하지 않은 세션까지 셉니다 */
  const screens = useReportScreens(reportId);
  const screenTask = screens.data?.available
    ? screens.data.tasks.find((item) => item.task_id === task.task_id)
    : undefined;
  const [screenIndex, setScreenIndex] = useState(0);
  const [causeView, setCauseView] = useState<"friction" | "dropout">("friction");
  const showFriction = Boolean(screenTask) && causeView === "friction";
  const openScreen = (screenId: string) => {
    const index = screenTask?.screens.findIndex((s) => s.screen_id === screenId) ?? -1;
    if (index < 0) return;
    setScreenIndex(index);
    /* 섹션 이동과 같게: 동작 줄이기 설정이면 바로 이동, scrollIntoView 가 없는 환경(jsdom)에서는 건너뜀 */
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    document
      .getElementById("screens")
      ?.scrollIntoView?.({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };
  const hidden: SectionId[] = [
    ...(hasHeatmap ? [] : (["heatmap"] as const)),
    ...(screenTask ? [] : (["screens", "problems"] as const)),
  ];

  return (
    <div className="flex flex-col gap-8">
      <SectionNav hidden={hidden} />

      <section id="summary" aria-labelledby="report-summary" className="scroll-mt-8">
        <h2 id="report-summary" className="sr-only">
          요약
        </h2>
        <KpiRow task={task} />
      </section>

      {screenTask && (
        <>
          <ReportSection
            id="screens"
            title="화면 둘러보기"
            info="에이전트가 실제로 거쳐 간 화면이에요. 화면마다 도달·이탈 세션과 감지된 마찰을 같이 보여 줘요."
            aside="← → 키로도 넘길 수 있어요"
          >
            <ScreenWalkthrough task={screenTask} selected={screenIndex} onSelect={setScreenIndex} />
          </ReportSection>
          <ReportSection
            id="problems"
            title="문제가 있었던 화면"
            info="마찰이 감지된 세션이 많은 화면 순서예요. 목표에 도달한 세션이 겪은 마찰도 같이 세요."
          >
            <ProblemScreens task={screenTask} onOpen={openScreen} />
          </ReportSection>
        </>
      )}

      <div className="mt-2 flex max-w-3xl flex-col gap-12">
        <ReportSection
          id="funnel"
          title="예측 퍼널"
          info="각 단계에 도달한 AI 고객 수의 시드별 범위예요. 진한 막대는 범위의 최솟값이에요."
          aside="도달 인원 · 유효 세션 대비"
        >
          {funnel.length > 0 && funnelMax(task) > 0 ? (
            <RangeBarChart title="예측 퍼널" data={funnel} max={funnelMax(task)} valueWidth={180} />
          ) : (
            <p className="text-sm text-subtle">이 과업은 단계별 예측 기록이 없어요.</p>
          )}
        </ReportSection>

        <ReportSection
          id="causes"
          title="원인 분포"
          info="감지된 마찰은 모든 세션이 겪은 마찰, 이탈 원인은 가상 이탈 세션의 주 원인이에요. 기술 실패는 넣지 않아요."
        >
          {screenTask && (
            <div role="group" aria-label="원인 보기" className="flex gap-1.5">
              {(
                [
                  ["friction", "감지된 마찰 (모든 세션)"],
                  ["dropout", "이탈 원인 (이탈 세션만)"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={causeView === value}
                  onClick={() => setCauseView(value)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium",
                    causeView === value
                      ? "bg-ink text-white"
                      : "bg-gray-100 text-subtle hover:text-ink",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {showFriction && screenTask ? (
            <FrictionCauses task={screenTask} onOpen={openScreen} />
          ) : causes.length > 0 ? (
            <>
              <RangeBarChart
                title="이탈 원인 분포"
                max={100}
                rowHeight={40}
                valueWidth={180}
                valueTone="strong"
                data={shownCauses.map((item) => ({
                  key: item.key,
                  label: item.name,
                  value: item.percent,
                  valueLabel: `${item.percent}% · ${item.dropouts}명`,
                }))}
              />
              {causes.length > CAUSE_PREVIEW && (
                <Button
                  variant="link"
                  onClick={() => setAllCauses((value) => !value)}
                  className="-ml-2 self-start"
                >
                  {allCauses ? "접기" : `원인 ${causes.length - CAUSE_PREVIEW}종 더 보기`}
                </Button>
              )}
            </>
          ) : (
            <p className="text-sm text-subtle">이 과업에서는 가상 이탈이 없었어요.</p>
          )}
        </ReportSection>

        <SegmentHeatmap task={task} />
      </div>
    </div>
  );
}
