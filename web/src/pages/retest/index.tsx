import type { ReactNode } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";

import ChoiceChip from "@/components/ChoiceChip/ChoiceChip";
import { buttonVariants } from "@/components/Button/buttonVariants";
import ProjectPageHeader from "@/components/ProjectPageHeader/ProjectPageHeader";
import WorkspaceState, { WorkspaceRetry } from "@/components/Workspace/WorkspaceState";
import { useCurrentProject, type CurrentProject } from "@/components/Projects/currentProject";
import { buildPath } from "@/constants/routes";
import { usePersonaReports } from "@/hooks/usePersonaReports";
import { usePersonaReport } from "@/pages/report/hooks/usePersonaReport";
import {
  completion,
  dropLabel,
  formatRange,
  runOrder,
  taskFindings,
  worstDrop,
} from "@/pages/report/utils/reportView";
import { ApiError } from "@/types/api.type";
import type { PersonaReport, PersonaReportSummary } from "@/types/persona.type";

import CauseCompare from "./components/CauseCompare";
import RunPicker from "./components/RunPicker";
import StageCompare from "./components/StageCompare";
import {
  canCompareCauses,
  commonTasks,
  compareCauses,
  compareStages,
  formatDiff,
  pickDefaultB,
  rangeDiff,
} from "./utils/compareView";

/*
  P18 재테스트 전후 비교 (+ E15 비교할 테스트 부족).
  - A 는 주소의 실행(재테스트 전), B 는 ?b= (없으면 A 다음 실행), 과업은 ?task=
  - 두 실행 모두 예측 범위라 차이는 범위 가운데값 기준입니다.
*/
export default function RetestPage() {
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
  return <Retest project={project} runId={runId} />;
}

function Retest({ project, runId }: { project: CurrentProject; runId: string }) {
  const reports = usePersonaReports();
  const [params] = useSearchParams();
  /* 실패·비용 상한으로 멈춘 실행은 결과가 온전하지 않아 비교하지 않습니다 */
  const list = (reports.data ?? []).filter(
    (report) => (report.outcome ?? "completed") === "completed",
  );
  const requestedB = params.get("b");
  const aKnown = list.some((report) => report.run_id === runId);
  /*
    재테스트가 막 끝나 자동으로 들어오면 목록을 다시 받는 중이라 B 가 아직 없을 수 있습니다.
    그동안은 다른 실행과 비교하거나 E15 를 잠깐 띄우지 않고 기다립니다.
  */
  const waitingForB =
    requestedB != null &&
    !list.some((report) => report.run_id === requestedB) &&
    reports.isFetching;
  const bId =
    requestedB && requestedB !== runId && list.some((report) => report.run_id === requestedB)
      ? requestedB
      : pickDefaultB(list, runId);

  if (reports.isPending || waitingForB) {
    return (
      <Layout project={project} title="비교" description={project.url}>
        <WorkspaceState kind="loading" title="비교할 실행을 불러오고 있어요" />
      </Layout>
    );
  }
  if (reports.isError) {
    return (
      <Layout project={project} title="비교" description={project.url}>
        <WorkspaceState
          kind="error"
          title="실행 목록을 불러오지 못했어요"
          description="잠시 뒤 다시 시도해 주세요."
          action={<WorkspaceRetry onClick={() => void reports.refetch()} />}
        />
      </Layout>
    );
  }
  /* A 를 모르면 "찾을 수 없어요", A 는 있는데 비교할 실행이 없으면 E15 */
  if (!aKnown || !bId) {
    return <NeedAnother project={project} runId={runId} known={aKnown} />;
  }
  return <Compare project={project} aId={runId} bId={bId} list={list} />;
}

function Layout({
  project,
  title,
  description,
  actions,
  children,
}: {
  project: CurrentProject;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-8">
      <ProjectPageHeader
        projectId={project.id}
        breadcrumb={`${project.name} / 사전 테스트 · 테스트`}
        title={title}
        description={description}
        actions={actions}
        activeTab="tests"
      />
      {children}
    </div>
  );
}

/* E15 — 비교할 다른 완료 실행이 없음. 재테스트는 리포트(P17 모달)에서 시작합니다 */
function NeedAnother({
  project,
  runId,
  known,
}: {
  project: CurrentProject;
  runId: string;
  known: boolean;
}) {
  return (
    <Layout project={project} title="비교" description={project.url}>
      <WorkspaceState
        kind="notice"
        title={known ? "비교할 테스트가 하나 더 필요해요" : "비교할 실행을 찾을 수 없어요"}
        description={
          known
            ? "같은 패널·시드로 재테스트하면 비교할 수 있어요"
            : "끝난 실행만 비교할 수 있어요. 테스트 목록에서 다시 골라 주세요."
        }
        action={
          known ? (
            <Link
              to={{
                pathname: buildPath("report", { projectId: project.id, runId }),
                search: "?retest=1",
              }}
              className={buttonVariants({ variant: "outline" })}
            >
              수정 후 재테스트
            </Link>
          ) : (
            <Link
              to={buildPath("testList", { projectId: project.id })}
              className={buttonVariants({ variant: "outline" })}
            >
              테스트 목록으로
            </Link>
          )
        }
      />
    </Layout>
  );
}

function Compare({
  project,
  aId,
  bId,
  list,
}: {
  project: CurrentProject;
  aId: string;
  bId: string;
  list: PersonaReportSummary[];
}) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const reportA = usePersonaReport(aId);
  const reportB = usePersonaReport(bId);
  const orderA = runOrder(list, aId);
  const orderB = runOrder(list, bId);

  const setQuery = (patch: Record<string, string>) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        for (const [key, value] of Object.entries(patch)) next.set(key, value);
        return next;
      },
      { replace: true },
    );

  const a = reportA.data;
  const b = reportB.data;
  const comparable = a && b ? canCompareCauses(a, b) : true;
  const failed = reportA.isError || reportB.isError;
  const pending = reportA.isPending || reportB.isPending;

  return (
    <Layout
      project={project}
      title={`${orderA}차 vs ${orderB}차 비교`}
      description={
        comparable
          ? "두 실행 모두 예측 · 같은 패널·시드 · 중앙값 기준"
          : "두 실행 모두 예측 · 패널·시드가 달라요 · 중앙값 기준"
      }
      actions={
        <>
          <Link
            to={buildPath("report", { projectId: project.id, runId: aId })}
            className={buttonVariants()}
          >
            리포트 A 열기
          </Link>
          <Link
            to={buildPath("report", { projectId: project.id, runId: bId })}
            className={buttonVariants()}
          >
            리포트 B 열기
          </Link>
        </>
      }
    >
      <div className="flex items-center gap-4">
        <RunPicker
          side="A"
          runId={aId}
          otherRunId={bId}
          reports={list}
          onSelect={(next) =>
            navigate({
              pathname: buildPath("retest", { projectId: project.id, runId: next }),
              search: `?b=${encodeURIComponent(bId)}`,
            })
          }
        />
        <span className="text-caption text-subtle">vs</span>
        <RunPicker
          side="B"
          runId={bId}
          otherRunId={aId}
          reports={list}
          onSelect={(next) => setQuery({ b: next })}
        />
      </div>

      {pending && <WorkspaceState kind="loading" title="두 리포트를 불러오고 있어요" />}
      {failed && !pending && (
        <WorkspaceState
          kind="error"
          title="리포트를 불러오지 못했어요"
          description={
            [reportA.error, reportB.error].some(
              (error) => error instanceof ApiError && error.status === 404,
            )
              ? "저장된 실행 기록을 찾을 수 없어요. 다른 실행을 골라 주세요."
              : "잠시 뒤 다시 시도해 주세요."
          }
          action={
            <WorkspaceRetry
              onClick={() => {
                void reportA.refetch();
                void reportB.refetch();
              }}
            />
          }
        />
      )}
      {a && b && (
        <CompareBody
          a={a}
          b={b}
          taskId={params.get("task")}
          comparable={comparable}
          onTaskChange={(task) => setQuery({ task })}
        />
      )}
    </Layout>
  );
}

function CompareBody({
  a,
  b,
  taskId,
  comparable,
  onTaskChange,
}: {
  a: PersonaReport;
  b: PersonaReport;
  taskId: string | null;
  comparable: boolean;
  onTaskChange: (taskId: string) => void;
}) {
  const tasks = commonTasks(a.tasks, b.tasks);
  const taskA = tasks.find((task) => task.id === taskId) ?? tasks[0];

  if (!taskA) {
    return (
      <WorkspaceState
        kind="empty"
        title="두 실행에 같은 과업이 없어요"
        description="같은 과업으로 재테스트한 실행끼리 비교할 수 있어요."
      />
    );
  }
  const taskB = b.tasks.find((task) => task.id === taskA.id)!;

  const rateA = completion(taskA).rate;
  const rateB = completion(taskB).rate;
  const dropA = worstDrop(taskA);
  const dropB = worstDrop(taskB);
  const issuesA = taskFindings(a.findings, taskA.id).length;
  const issuesB = taskFindings(b.findings, taskB.id).length;
  /* 같은 구간이면 이탈률 변화를, 다르면 B 의 최대 이탈 구간을 붙입니다 */
  const dropMoved =
    dropA && dropB
      ? dropLabel(dropA) === dropLabel(dropB)
        ? `같은 구간 · 이탈 ${formatRange(dropA.rate, "%")} → ${formatRange(dropB.rate, "%")}`
        : `${dropLabel(dropB)}로 이동`
      : dropB
        ? `B: ${dropLabel(dropB)}`
        : "B 이탈 없음";

  const kpis = [
    {
      label: "목표 달성률 (예측)",
      value: `${formatRange(rateA, "%")} → ${formatRange(rateB, "%")}`,
      note: formatDiff(rangeDiff(rateA, rateB), "%p"),
    },
    {
      label: "최대 이탈 구간",
      value: dropA ? dropLabel(dropA) : "이탈 없음",
      note: dropMoved,
    },
    {
      label: "발견 이슈",
      value: `${issuesA}건 → ${issuesB}건`,
      note: formatDiff(issuesB - issuesA, "건"),
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-caption font-medium text-gray-800">비교할 과업</span>
        <div role="radiogroup" aria-label="비교할 과업" className="flex flex-wrap gap-2">
          {tasks.map((task) => (
            <ChoiceChip
              key={task.id}
              kind="radio"
              selected={task.id === taskA.id}
              onClick={() => onTaskChange(task.id)}
            >
              {task.name}
            </ChoiceChip>
          ))}
        </div>
        <p className="text-xs text-muted">두 실행 모두에 있는 과업만 고를 수 있어요</p>
      </div>

      <dl className="grid grid-cols-3">
        {kpis.map((kpi, index) => (
          <div
            key={kpi.label}
            className={
              index === 0
                ? "flex flex-col gap-2 pr-6"
                : "flex flex-col gap-2 border-l border-line px-6"
            }
          >
            <dt className="text-xs text-subtle">{kpi.label}</dt>
            <dd className="flex flex-col gap-1">
              <span className="text-xl font-bold text-ink">{kpi.value}</span>
              <span className="text-xs text-ink">{kpi.note}</span>
            </dd>
          </div>
        ))}
      </dl>

      <div className="grid grid-cols-3 gap-10">
        <div className="col-span-2">
          <StageCompare rows={compareStages(taskA, taskB)} />
        </div>
        <CauseCompare rows={compareCauses(a, b, taskA, taskB)} comparable={comparable} />
      </div>
    </div>
  );
}
