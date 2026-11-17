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
import SegmentHeatmap from "./components/SegmentHeatmap";
import ShareModal from "./components/ShareModal";
import TechnicalFailures from "./components/TechnicalFailures";
import { useRunDetail, useRunReport } from "./hooks/useRunReport";
import {
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
  재테스트(P17)는 제품 API 로 옮기는 PR 에서 다시 붙입니다.
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
  const openLogin = useDemoSessionStore((state) => state.openLogin);
  const [params, setParams] = useSearchParams();
  const [shareOpen, setShareOpen] = useState(false);

  const data = report.data?.data;
  const tasks = data?.tasks ?? [];
  const task = tasks.find((item) => item.task_id === params.get("task")) ?? tasks[0];
  const order = run.data?.sequence_no;
  const title = task
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
              taskId={task?.task_id}
              onTaskChange={(taskId) =>
                setParams(
                  (previous) => {
                    const next = new URLSearchParams(previous);
                    next.set("task", taskId);
                    return next;
                  },
                  { replace: true },
                )
              }
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
      {report.data &&
        (task ? (
          /* 과업을 바꾸면 원인 펼침을 그 과업 기준으로 처음부터 */
          <ReportBody key={task.task_id} task={task} />
        ) : (
          <ReportNoTasks />
        ))}
      {report.data && <ReportFooter report={report.data} />}
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
function ReportFooter({ report }: { report: RunReport }) {
  const { technical_failures: failures, tasks, notes } = report.data;
  return (
    <>
      <TechnicalFailures failures={failures} tasks={tasks} />
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

function ReportBody({ task }: { task: ReportTaskV1 }) {
  const [allCauses, setAllCauses] = useState(false);
  const causes = causeRowsV1(task);
  const shownCauses = allCauses ? causes : causes.slice(0, CAUSE_PREVIEW);
  const funnel = funnelRowsV1(task);
  const hasHeatmap = heatmapV1(task).rows.length > 0;

  return (
    <div className="flex flex-col gap-8">
      <SectionNav hidden={hasHeatmap ? [] : ["heatmap"]} />

      <section id="summary" aria-labelledby="report-summary" className="scroll-mt-8">
        <h2 id="report-summary" className="sr-only">
          요약
        </h2>
        <KpiRow task={task} />
      </section>

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
          title="이탈 원인 분포"
          info="가상 이탈 세션의 주 원인 비율이에요. 기술 실패는 넣지 않아요."
        >
          {causes.length > 0 ? (
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
