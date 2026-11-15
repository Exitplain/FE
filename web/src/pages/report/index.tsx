import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";

import Button from "@/components/Button/Button";
import ProjectPageHeader from "@/components/ProjectPageHeader/ProjectPageHeader";
import RangeBarChart from "@/components/RangeBarChart/RangeBarChart";
import WorkspaceState from "@/components/Workspace/WorkspaceState";
import { CAUSE_LABELS, VARIANT_LABELS } from "@/constants/persona";
import { findSampleProject, type SampleProject } from "@/constants/projects";
import { usePersonaReports } from "@/hooks/usePersonaReports";
import { usePersonaRun } from "@/hooks/usePersonaRun";
import { ApiError } from "@/types/api.type";
import type { PersonaReport, ReportTask } from "@/types/persona.type";
import { cn } from "@/utils/cn";

import AlignmentSummary from "./components/AlignmentSummary";
import ExportMenu from "./components/ExportMenu";
import KpiRow from "./components/KpiRow";
import ReportSection from "./components/ReportSection";
import RetestModal from "./components/RetestModal";
import {
  ReportError,
  ReportLoading,
  ReportNotFound,
  ReportPending,
} from "./components/ReportStates";
import ReportToolbar from "./components/ReportToolbar";
import SegmentHeatmap from "./components/SegmentHeatmap";
import ShareModal from "./components/ShareModal";
import TechnicalFailures from "./components/TechnicalFailures";
import TopIssues from "./components/TopIssues";
import { usePersonaReport } from "./hooks/usePersonaReport";
import {
  causeShares,
  formatDay,
  funnelRows,
  hasHeatmap,
  runOrder,
  taskFindings,
} from "./utils/reportView";

/* 섹션 이동 (Figma SectionNav 순서) */
const SECTIONS = [
  { id: "summary", label: "요약" },
  { id: "funnel", label: "예측 퍼널" },
  { id: "heatmap", label: "히트맵" },
  { id: "causes", label: "원인 분포" },
  { id: "issues", label: "개선 Top 3" },
  { id: "alignment", label: "실측 비교" },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];

/* 원인 분포는 상위 3개만 먼저 보여주고 나머지는 펼칩니다 */
const CAUSE_PREVIEW = 3;

/*
  P12 리포트 (+ P12c 실행 선택, P12d 설명, E04 로딩, E18 기록 없음, E20 불러오기 실패)
  - GET /api/personas/report?run_id= (완료 실행만. 진행 중이면 409 → 실행 화면 안내)
  - 과업은 주소 ?task= 로 둡니다 (새로 고침·공유해도 같은 과업)
*/
export default function ReportPage() {
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

  /* 실행을 바꾸면 펼친 문제·섹션 선택을 처음으로 돌립니다 */
  return <Report key={runId} project={project} runId={runId} />;
}

function Report({ project, runId }: { project: SampleProject; runId: string }) {
  const report = usePersonaReport(runId);
  const reports = usePersonaReports();
  const currentRun = usePersonaRun();
  const [params, setParams] = useSearchParams();
  const [shareOpen, setShareOpen] = useState(false);
  /* P17 — E15(비교할 테스트 부족)에서 ?retest=1 로 들어오면 바로 엽니다 */
  const [retestOpen, setRetestOpen] = useState(() => params.get("retest") === "1");

  const order = runOrder(reports.data ?? [], runId);
  const tasks = report.data?.tasks ?? [];
  const task = tasks.find((item) => item.id === params.get("task")) ?? tasks[0];
  const title = task
    ? `${task.name}${order ? ` · ${order}차` : ""}`
    : order
      ? `${order}차 사전 테스트`
      : "사전 테스트 리포트";

  const status = report.error instanceof ApiError ? report.error.status : null;
  /* 받아 둔 리포트가 있으면 다시 받기에 실패해도 본문을 그대로 둡니다 (오류 화면과 겹치지 않게) */
  const failed = report.isError && report.data === undefined;

  /* 409(진행 중)로 안내하던 실행이 끝나면 새로 고치지 않아도 리포트를 다시 받습니다 */
  const runFinished = currentRun.data?.id === runId && currentRun.data.status === "completed";
  const { refetch } = report;
  useEffect(() => {
    if (status === 409 && runFinished) void refetch();
  }, [status, runFinished, refetch]);

  return (
    <div className="flex flex-col gap-12">
      <ProjectPageHeader
        projectId={project.id}
        breadcrumb={`${project.name} / 사전 테스트 · 테스트`}
        title={title}
        description={report.data && reportConditions(report.data)}
        toolbar={
          report.data && (
            <ReportToolbar
              projectId={project.id}
              runId={runId}
              order={order}
              createdAt={report.data.created_at}
              reports={reports.data ?? []}
              currentRun={currentRun.data}
              tasks={tasks}
              taskId={task?.id}
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
              <Button onClick={() => setRetestOpen(true)}>수정 후 재테스트</Button>
            </>
          )
        }
        activeTab="tests"
      />

      {report.isPending && <ReportLoading />}
      {failed && status === 404 && <ReportNotFound projectId={project.id} />}
      {failed && status === 409 && <ReportPending projectId={project.id} runId={runId} />}
      {failed && status !== 404 && status !== 409 && (
        <ReportError projectId={project.id} onRetry={() => void report.refetch()} />
      )}
      {report.data &&
        (task ? (
          /* 과업을 바꾸면 펼친 문제·원인 펼침을 그 과업 기준으로 처음부터 */
          <ReportBody key={task.id} report={report.data} task={task} projectId={project.id} />
        ) : (
          <ReportNoTasks />
        ))}
      {report.data && <ReportFooter report={report.data} />}
      <ShareModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        runId={runId}
        taskId={task?.id}
      />
      {report.data && retestOpen && (
        <RetestModal
          open
          onClose={() => {
            setRetestOpen(false);
            /* 다시 열리지 않게 ?retest=1 을 지웁니다 */
            if (params.has("retest")) {
              setParams(
                (previous) => {
                  const next = new URLSearchParams(previous);
                  next.delete("retest");
                  return next;
                },
                { replace: true },
              );
            }
          }}
          projectId={project.id}
          report={report.data}
          order={order}
          nextOrder={(reports.data?.length ?? 0) + 1}
          taskName={
            tasks.length > 1
              ? `${tasks[0].name} 외 ${tasks.length - 1}개`
              : (tasks[0]?.name ?? "사전 테스트")
          }
        />
      )}
    </div>
  );
}

/*
  설명 줄 — Figma "11월 7일 · 20명 × 시드 3회 · 보정 11월 5일".
  실행 조건(임시 필드)이 없으면 세션 수와 데모 버전으로 대신합니다.
*/
function reportConditions(report: PersonaReport) {
  const day = formatDay(report.created_at);
  const conditions = report.conditions;
  if (!conditions) {
    return `${day} · 세션 ${report.summary.sessions}개 · ${VARIANT_LABELS[report.variant]}`;
  }
  const calibration = conditions.calibrated_at
    ? `보정 ${formatDay(conditions.calibrated_at)}`
    : "보정 전";
  return `${day} · ${conditions.panel_size}명 × 시드 ${conditions.seeds}회 · ${calibration}`;
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
function ReportFooter({ report }: { report: PersonaReport }) {
  return (
    <>
      <TechnicalFailures failures={report.technical_failures} />
      {report.limitations.length > 0 && (
        <ul aria-label="결과 해석의 한계" className="flex flex-col gap-1 text-xs text-muted">
          {report.limitations.map((text) => (
            <li key={text}>· {text}</li>
          ))}
        </ul>
      )}
    </>
  );
}

function ReportBody({
  report,
  task,
  projectId,
}: {
  report: PersonaReport;
  task: ReportTask;
  projectId: string;
}) {
  const [allCauses, setAllCauses] = useState(false);
  const findings = taskFindings(report.findings, task.id);
  const causes = causeShares(findings, task.dropout);
  const shownCauses = allCauses ? causes : causes.slice(0, CAUSE_PREVIEW);
  const funnel = funnelRows(task);
  const funnelMax = task.funnel?.[0]?.reached[1] ?? 0;

  return (
    <div className="flex flex-col gap-8">
      <SectionNav hidden={hasHeatmap(task) ? [] : ["heatmap"]} />

      <section id="summary" aria-labelledby="report-summary" className="scroll-mt-8">
        <h2 id="report-summary" className="sr-only">
          요약
        </h2>
        <KpiRow task={task} findings={findings} />
      </section>

      <div className="mt-2 grid grid-cols-12 gap-10">
        <div className="col-span-7 flex flex-col gap-12">
          <ReportSection
            id="funnel"
            title="예측 퍼널"
            info="각 단계에 도달한 AI 고객 수의 범위예요. 진한 막대는 범위의 최솟값이에요."
            aside="랜딩 대비 도달 인원"
          >
            {funnel.length > 0 ? (
              <RangeBarChart title="예측 퍼널" data={funnel} max={funnelMax} valueWidth={180} />
            ) : (
              <p className="text-sm text-subtle">이 과업은 단계별 예측 기록이 없어요.</p>
            )}
          </ReportSection>

          <ReportSection
            id="causes"
            title="이탈 원인 분포"
            info="가상 이탈 세션의 원인 비율이에요. 기술 실패는 넣지 않아요."
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
                    key: item.cause,
                    label: CAUSE_LABELS[item.cause],
                    value: item.share,
                    valueLabel: `${item.share}%`,
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

        <div className="col-span-5 flex flex-col gap-12">
          <TopIssues findings={findings} projectId={projectId} runId={report.run_id} />
          <AlignmentSummary
            alignment={report.alignment}
            actual={task.actual}
            projectId={projectId}
          />
        </div>
      </div>
    </div>
  );
}
