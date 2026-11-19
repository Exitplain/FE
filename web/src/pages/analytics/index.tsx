import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import Button from "@/components/Button/Button";
import ProjectPageHeader from "@/components/ProjectPageHeader/ProjectPageHeader";
import StatusBadge from "@/components/StatusBadge/StatusBadge";
import { useCurrentProject, type CurrentProject } from "@/components/Projects/currentProject";
import { createRun } from "@/apis/plan.api";
import { queryKeys } from "@/apis/queryKeys";
import { buildPath } from "@/constants/routes";
import type { FunnelDays, FunnelDevice, FunnelStageCompare } from "@/types/measurement.type";

import CompareView from "./components/CompareView";
import ParticipantLinks from "@/pages/calibration/components/ParticipantLinks";

import ConnectView, { NotConnected, NotDeployed } from "./components/ConnectView";
import FunnelView from "./components/FunnelView";
import MappingStep from "./components/MappingStep";
import { ReproduceResult, ReproduceRunning, ReproduceSetup } from "./components/ReproduceViews";
import { useMeasurement, useMeasurementFunnel } from "./hooks/useMeasurement";
import { ALL_TASKS, formatError, reportLabel } from "./utils/funnel";

/* 화면 안 단계 (?view=). 주소에 두어 새로고침·뒤로가기로 돌아올 수 있게 합니다 */
const VIEWS = [
  "connect",
  "mapping",
  "funnel",
  "compare",
  "reproduce",
  "reproducing",
  "result",
] as const;
type View = (typeof VIEWS)[number];

const dayFormat = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "long",
  day: "numeric",
});
const timeFormat = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/*
  R01~R11 실측 분석 (/projects/:projectId/analytics?view=)
  설치(R01~R04)·단계 매핑(R05)·실측 퍼널(R06·R07)·예측 비교(R08)는 실제 API(BE measurements)를 씁니다.
  원인 재현(R09~R11)은 아직 하드코딩 목데이터(data/analyticsMock.ts)입니다.
  - 배포 주소 없음: 실측 불가 안내 (코드만 받은 프로젝트 등)
  - 미연결(매핑 저장 전): E03 → 연결(R01~R04) → 단계 매핑(R05)
  - 연결됨: 실측 퍼널(R06·R07) → 예측 vs 실측(R08) → 원인 재현(R09~R11) → 보정(K01)
*/
export default function AnalyticsPage() {
  const project = useCurrentProject();
  return <Analytics key={project.id} project={project} />;
}

function Analytics({ project }: { project: CurrentProject }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  /* 설치 상태로 배포 주소 유무·연결(매핑 저장) 여부를 봅니다. 샘플 프로젝트는 내 것이 아니라 부르지 않습니다 */
  const measurement = useMeasurement(project.v1Id, { enabled: !project.isSample });
  const connected = Boolean(measurement.data?.mapping_saved_at);
  const status = connected ? "connected" : "unconnected";
  const requested = searchParams.get("view");
  const parsed = (VIEWS as readonly string[]).includes(requested ?? "")
    ? (requested as View)
    : null;
  /* 미연결 프로젝트는 연결·매핑 말고는 데이터가 없어 E03 으로 보냅니다 */
  const view: View | null =
    status === "unconnected"
      ? parsed === "connect" || parsed === "mapping"
        ? parsed
        : null
      : (parsed ?? "funnel");

  const [period, setPeriod] = useState<FunnelDays>("7");
  const [device, setDevice] = useState<FunnelDevice>("all");
  const [taskId, setTaskId] = useState("");
  const [gap, setGap] = useState<FunnelStageCompare | null>(null);
  const funnel = useMeasurementFunnel(project.v1Id, period, "all", connected);
  /* 과업 "전체"는 실제 고객 데이터 화면(R06)에서만 씁니다. 비교(R08)·재현은 과업 하나가 필요해 첫 과업을 씁니다 */
  const allTasks = taskId === ALL_TASKS && (funnel.data?.tasks.length ?? 0) > 1;
  const task = funnel.data?.tasks.find((item) => item.task_id === taskId) ?? funnel.data?.tasks[0];
  /* 원인 재현 실행·과업·구간은 주소에 둡니다 (새로고침해도 진행·결과로 돌아오게) */
  const repro = {
    run: searchParams.get("run") ?? "",
    task: searchParams.get("task") ?? "",
    stage: searchParams.get("stage") ?? "",
    name: searchParams.get("name") ?? "",
  };
  const gapStage = gap?.name ?? repro.name;
  const segmentsAll = funnel.data?.report?.segments ?? [];
  const [segments, setSegments] = useState<string[] | null>(null);
  const selected = segments ?? segmentsAll.map((segment) => segment.id);

  const goTo = (next: View | null, extra: Record<string, string> = {}) => {
    setSearchParams(next ? { view: next, ...extra } : {});
    window.scrollTo({ top: 0 });
  };

  const base = funnel.data?.report;
  const start = useMutation({
    mutationFn: () => {
      if (!base?.run_id || !gap || !task) throw new Error("재현할 기준 실행이 없어요.");
      return createRun(
        {
          plan_revision_id: base.plan_revision_id,
          base_run_id: base.run_id,
          change_note: `원인 재현 · ${gap.name}`,
          reproduce: {
            task_id: task.task_id,
            segment_ids: selected,
            stage_id: gap.id,
            stage_name: gap.name,
          },
        },
        crypto.randomUUID(),
      );
    },
    onSuccess: (created) => {
      if (!gap || !task) return;
      goTo("reproducing", {
        run: created.run_id,
        task: task.task_id,
        stage: gap.id,
        name: gap.name,
      });
    },
  });
  const showResult = useCallback(
    () => setSearchParams({ ...repro, view: "result" }, { replace: true }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 같은 실행 동안 주소 값은 바뀌지 않습니다
    [repro.run, setSearchParams],
  );

  const gapText =
    gap?.actual?.rate != null && gap.predicted.low != null && gap.predicted.high != null
      ? `${gap.name} · 실제 고객 데이터 ${gap.actual.rate.toFixed(1)}% · 예측 ${Math.round(gap.predicted.low)}~${Math.round(gap.predicted.high)}%${gap.error == null ? "" : ` (${formatError(gap.error)})`}`
      : gapStage;

  const unlinkBadge = <StatusBadge icon="unlink" label="미연결" tone="strong" />;
  const crumb = `${project.name} / 실제 고객 데이터 분석 · 테스트`;
  const reproduceCrumb = `${project.name} / 실제 고객 데이터 분석 / 예측 vs 실제 고객 데이터 · 테스트`;

  if (project.isSample) {
    return (
      <div className="flex flex-col gap-12">
        <ProjectPageHeader
          projectId={project.id}
          breadcrumb={`${project.name} · 테스트`}
          title={project.name}
          description={project.url}
          activeTab="analytics"
        />
        <NotDeployed message="샘플 프로젝트는 실제 고객 데이터를 연결할 수 없어요. 내 프로젝트에서 배포 주소로 연결해 주세요." />
      </div>
    );
  }

  if (measurement.isPending || measurement.isError) {
    return (
      <div className="flex flex-col gap-12">
        <ProjectPageHeader
          projectId={project.id}
          breadcrumb={`${project.name} · 테스트`}
          title={project.name}
          description={project.url}
          activeTab="analytics"
        />
        {measurement.isError ? (
          <div className="flex flex-col items-start gap-4 rounded-xl bg-gray-50 p-6">
            <p role="alert" className="text-sm text-subtle">
              {measurement.error.message}
            </p>
            <Button variant="secondary" onClick={() => void measurement.refetch()}>
              다시 불러오기
            </Button>
          </div>
        ) : (
          <p className="text-sm text-subtle">불러오는 중이에요…</p>
        )}
      </div>
    );
  }

  if (view === null) {
    return (
      <div className="flex flex-col gap-12">
        <ProjectPageHeader
          projectId={project.id}
          breadcrumb={`${project.name} · 테스트`}
          title={project.name}
          description={project.url}
          actions={unlinkBadge}
          activeTab="analytics"
        />
        {measurement.data && !measurement.data.available ? (
          <NotDeployed
            message={measurement.data.message}
            onCsv={() => goTo("connect", { method: "csv" })}
          />
        ) : (
          <NotConnected
            onConnect={() => goTo("connect")}
            onCsv={() => goTo("connect", { method: "csv" })}
          />
        )}
        {/* 코드를 못 넣는 프로젝트도 참여자 응답으로 사람 관측을 모을 수 있어요 */}
        <ParticipantLinks projectId={project.id} />
      </div>
    );
  }

  if (view === "connect") {
    return (
      <div className="flex flex-col gap-12">
        <ProjectPageHeader
          projectId={project.id}
          breadcrumb={crumb}
          title="실제 고객 데이터 연결"
          description="실제 사용자 단계별 이동으로 예측이 맞았는지 확인해요"
          actions={unlinkBadge}
          activeTab="analytics"
        />
        <ConnectView
          projectId={project.v1Id}
          siteUrl={/^https?:\/\//.test(project.url) ? project.url : undefined}
          onMapping={() => goTo("mapping")}
          initialMethod={searchParams.get("method") === "csv" ? "csv" : "script"}
        />
      </div>
    );
  }

  if (view === "mapping") {
    return (
      <MappingStep
        projectId={project.v1Id}
        breadcrumb={crumb}
        onCancel={() => goTo(status === "unconnected" ? "connect" : "funnel")}
        onSaved={() => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.measurement(project.v1Id) });
          goTo("funnel");
        }}
      />
    );
  }

  if (view === "funnel" || view === "compare") {
    const lastReceived = measurement.data.last_received_at;
    return (
      <div className="flex flex-col gap-12">
        <ProjectPageHeader
          projectId={project.id}
          breadcrumb={crumb}
          title={view === "funnel" ? "실제 고객 데이터 단계별 이동" : "예측 vs 실제 고객 데이터"}
          description={
            view === "compare"
              ? "오차 = 실제 고객 데이터 − 예측 범위 중앙값"
              : `실제 사용자 · AI 고객 제외${lastReceived ? ` · 마지막 수신 ${timeFormat.format(new Date(lastReceived))}` : ""}`
          }
          actions={
            view === "funnel" ? (
              <>
                {(
                  allTasks ? funnel.data?.tasks.every((item) => item.collecting) : task?.collecting
                ) ? (
                  <StatusBadge icon="more" label="수집 중" tone="muted" />
                ) : task ? (
                  <StatusBadge icon="activity" label="비교 가능" tone="muted" />
                ) : null}
                <Button variant="secondary" onClick={() => goTo("mapping")}>
                  단계 매핑
                </Button>
                <Button disabled={!task} onClick={() => goTo("compare")}>
                  예측과 비교하기
                </Button>
              </>
            ) : (
              <Button variant="secondary" onClick={() => goTo("funnel")}>
                실제 고객 데이터 단계별 이동
              </Button>
            )
          }
          activeTab="analytics"
        />
        {funnel.isError ? (
          <div className="flex flex-col items-start gap-4 rounded-xl bg-gray-50 p-6">
            <p role="alert" className="text-sm text-subtle">
              {funnel.error.message}
            </p>
            <Button variant="secondary" onClick={() => void funnel.refetch()}>
              다시 불러오기
            </Button>
          </div>
        ) : !funnel.data ? (
          <p className="text-sm text-subtle">불러오는 중이에요…</p>
        ) : !task ? (
          <p className="rounded-xl bg-gray-50 p-6 text-sm text-subtle">
            {funnel.data.message ?? "비교할 과업이 없어요."}
          </p>
        ) : view === "funnel" ? (
          <FunnelView
            projectId={project.v1Id}
            funnel={funnel.data}
            task={task}
            period={period}
            device={device}
            allTasks={allTasks}
            onTaskChange={setTaskId}
            onPeriodChange={setPeriod}
            onDeviceChange={setDevice}
          />
        ) : (
          <CompareView
            funnel={funnel.data}
            task={task}
            period={period}
            onPeriodChange={setPeriod}
            onTaskChange={setTaskId}
            onReproduce={(stage) => {
              setGap(stage);
              goTo("reproduce");
            }}
          />
        )}
      </div>
    );
  }

  if (view === "reproduce") {
    const blocked = !gap
      ? "비교 화면에서 차이 구간을 다시 골라 주세요."
      : !base?.run_id
        ? "비교한 사전 테스트에 실행 기록이 없어 재현할 수 없어요."
        : null;
    return (
      <div className="flex flex-col gap-12">
        <ProjectPageHeader
          projectId={project.id}
          breadcrumb={reproduceCrumb}
          title={`원인 재현 · ${gapStage}`}
          actions={
            <>
              {start.isError && (
                <span role="alert" className="text-caption text-danger">
                  {start.error.message}
                </span>
              )}
              <Button variant="secondary" onClick={() => goTo("compare")}>
                취소
              </Button>
              <Button
                disabled={Boolean(blocked) || selected.length === 0 || start.isPending}
                onClick={() => start.mutate()}
              >
                {start.isPending ? "시작하는 중…" : "재현 시작"}
              </Button>
            </>
          }
          activeTab="analytics"
        />
        <ReproduceSetup
          gapText={gapText}
          taskName={task?.name ?? ""}
          baseLabel={funnel.data ? reportLabel(funnel.data) : "—"}
          segments={segmentsAll}
          selected={selected}
          onToggle={(id) =>
            setSegments(
              selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id],
            )
          }
          blocked={blocked}
        />
      </div>
    );
  }

  if (view === "reproducing") {
    return (
      <div className="flex flex-col gap-12">
        <ProjectPageHeader
          projectId={project.id}
          breadcrumb={reproduceCrumb}
          title={`원인 재현 · ${gapStage}`}
          description="그 과업을 고른 세그먼트로 처음부터 실제로 다시 돌려요 · 반복 1회"
          actions={<StatusBadge icon="play" label="실행 중" tone="strong" />}
          activeTab="analytics"
        />
        {repro.run ? (
          <ReproduceRunning runId={repro.run} onDone={showResult} />
        ) : (
          <div className="flex flex-col items-start gap-4 rounded-xl bg-gray-50 p-6">
            <p className="text-sm text-subtle">
              재현 실행을 찾을 수 없어요. 설정에서 다시 시작해 주세요.
            </p>
            <Button variant="secondary" onClick={() => goTo("compare")}>
              예측 vs 실제 고객 데이터
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-12">
      <ProjectPageHeader
        projectId={project.id}
        breadcrumb={reproduceCrumb}
        title={`원인 재현 · ${gapStage}`}
        description={`${dayFormat.format(new Date())} · ${gapStage} 구간 재현 결과`}
        actions={
          <>
            <Button variant="secondary" onClick={() => goTo("compare")}>
              다시 재현
            </Button>
            <Button onClick={() => navigate(buildPath("calibration", { projectId: project.id }))}>
              조정안 확인
            </Button>
          </>
        }
        activeTab="analytics"
      />
      {repro.run ? (
        <ReproduceResult
          projectId={project.id}
          runId={repro.run}
          taskId={repro.task}
          stageId={repro.stage}
          stageName={gapStage}
        />
      ) : (
        <p className="rounded-xl bg-gray-50 p-6 text-sm text-subtle">재현 실행을 찾을 수 없어요.</p>
      )}
    </div>
  );
}
