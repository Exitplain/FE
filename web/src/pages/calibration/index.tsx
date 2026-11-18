import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";

import {
  applyCalibration,
  getCalibrationCompare,
  getCalibrationProposal,
  resetCalibration,
  restoreCalibration,
} from "@/apis/calibration.api";
import { queryKeys } from "@/apis/queryKeys";
import { buttonVariants } from "@/components/Button/buttonVariants";
import Button from "@/components/Button/Button";
import Icon from "@/components/Icon/Icon";
import ProjectPageHeader from "@/components/ProjectPageHeader/ProjectPageHeader";
import StatusBadge from "@/components/StatusBadge/StatusBadge";
import { useCurrentProject, type CurrentProject } from "@/components/Projects/currentProject";
import { buildPath } from "@/constants/routes";
import { useCalibrations } from "@/hooks/useCalibrations";
import { useToastStore } from "@/stores/useToastStore";
import SegmentedTabs from "@/components/SegmentedTabs/SegmentedTabs";
import type { CalibrationRecord, ProposalStrength } from "@/types/calibration.type";

import {
  ApplyModal,
  HistoryTable,
  NoProposal,
  ProposalView,
  CompareSection,
  ErrorTrend,
} from "./components/CalibrationViews";
import ObservationView from "./components/ObservationView";
import ParticipantLinks from "./components/ParticipantLinks";
import { formatApplied } from "./utils/format";

/*
  K01~K04 보정 (/projects/:projectId/calibration?view=history|observe)
  조정안·적용·이력·되돌리기는 실제 API(BE calibrations)를 씁니다. 사람 관측(K04)은 아직 목데이터입니다.
  - 조정안 있음: K01 → 적용 확인(K02) → 적용됨(K03, 다음 테스트 대기)
  - 그 밖: 차이 없음(E11) · 실측 미연결/매핑 전/표본 부족/사전 테스트 없음 안내
*/
export default function CalibrationPage() {
  const project = useCurrentProject();
  return <Calibration key={project.id} project={project} />;
}

const NOT_READY_TITLE: Record<string, string> = {
  NOT_CONNECTED: "실측 데이터를 먼저 연결해요",
  NOT_MAPPED: "단계 매핑을 먼저 저장해요",
  NO_PREDICTION: "비교할 사전 테스트가 없어요",
  INSUFFICIENT_SAMPLE: "실측 표본이 아직 모자라요",
};

function Calibration({ project }: { project: CurrentProject }) {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get("view");
  const [confirming, setConfirming] = useState(false);
  const crumb = `${project.name} / 보정 · 테스트`;
  const history = useCalibrations(project.id);
  const [strength, setStrength] = useState<ProposalStrength>("normal");
  const proposal = useQuery({
    queryKey: [...queryKeys.calibration.all, project.id, "proposal", strength] as const,
    queryFn: () => getCalibrationProposal(project.id, 7, strength),
    enabled: !project.isSample,
  });
  const records = history.data ?? [];
  const latest: CalibrationRecord | undefined = records[0];
  const revision = latest?.revision ?? 0;
  const calibrated = Boolean(latest && latest.restored_from !== 0);
  /* 조정안으로 적용한 보정이면 전·후 비교 (되돌리기 기록은 비교하지 않음) */
  const comparable = Boolean(latest && latest.restored_from == null);
  const compare = useQuery({
    queryKey: [...queryKeys.calibration.all, project.id, "compare", latest?.revision] as const,
    queryFn: () => getCalibrationCompare(project.id, latest?.revision),
    enabled: !project.isSample && comparable,
  });
  const compareSection = comparable && compare.data && compare.data.status !== "unavailable" && (
    <CompareSection compare={compare.data} />
  );

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: [...queryKeys.calibration.all, project.id] });
  const apply = useMutation({
    mutationFn: () =>
      applyCalibration(project.id, {
        expected_revision: proposal.data?.base_revision ?? revision,
        keys: (proposal.data?.items ?? []).map((item) => item.key),
        strength,
      }),
    onSuccess: async () => {
      setConfirming(false);
      useToastStore.getState().show("보정을 적용했어요. 다음 사전 테스트부터 반영돼요");
      await refresh();
    },
  });
  const restore = useMutation({
    mutationFn: (target: CalibrationRecord | null) =>
      target ? restoreCalibration(target.id, revision) : resetCalibration(project.id, revision),
    onSuccess: async () => {
      useToastStore.getState().show("되돌렸어요. 다음 사전 테스트부터 반영돼요");
      await refresh();
    },
    onError: (error) => useToastStore.getState().show(error.message, "info"),
  });

  const observeLink = (
    <Link
      to={{ search: "?view=observe" }}
      className="flex w-fit items-center gap-1 text-caption font-bold text-ink hover:underline"
    >
      사람 관측으로 원인까지 비교하기
      <Icon name="chevron-right" className="size-4" />
    </Link>
  );
  const badge = calibrated ? (
    <StatusBadge icon="check" label="보정 적용됨" tone="muted" />
  ) : (
    <StatusBadge icon="circle" label="보정 전" tone="muted" />
  );
  const header = (actions?: ReactNode, description?: string) => (
    <ProjectPageHeader
      projectId={project.id}
      breadcrumb={crumb}
      title="보정"
      description={
        description ??
        (calibrated && latest
          ? `${formatApplied(latest.applied_at)} 적용 · 이후 사전 테스트에 자동 적용돼요`
          : undefined)
      }
      actions={actions ?? badge}
      activeTab="calibration"
    />
  );

  if (view === "observe") {
    return (
      <div className="flex flex-col gap-12">
        <ProjectPageHeader
          projectId={project.id}
          breadcrumb={crumb}
          title="사람 관측"
          description="참여자 관찰 결과를 넣으면 원인까지 비교해요 (선택)"
          activeTab="calibration"
        />
        <ParticipantLinks projectId={project.id} />
        <ObservationView projectId={project.id} />
      </div>
    );
  }

  if (project.isSample) {
    return (
      <div className="flex flex-col gap-12">
        {header()}
        <NoProposal
          title="샘플 프로젝트는 보정할 수 없어요"
          message="내 프로젝트에서 실측을 연결하면 조정안을 만들어요."
        />
      </div>
    );
  }

  if (history.isError || proposal.isError) {
    return (
      <div className="flex flex-col gap-12">
        {header()}
        <div className="flex flex-col items-start gap-4 rounded-xl bg-gray-50 p-6">
          <p role="alert" className="text-sm text-subtle">
            {(history.error ?? proposal.error)?.message}
          </p>
          <Button variant="secondary" onClick={() => void refresh()}>
            다시 불러오기
          </Button>
        </div>
      </div>
    );
  }
  if (!history.data || !proposal.data) {
    return (
      <div className="flex flex-col gap-12">
        {header()}
        <p className="text-sm text-subtle">불러오는 중이에요…</p>
      </div>
    );
  }

  const historyTable = (
    <HistoryTable
      history={records}
      pending={restore.isPending}
      onRestore={(target) => restore.mutate(target)}
      onReset={() => restore.mutate(null)}
    />
  );

  if (view === "history") {
    return (
      <div className="flex flex-col gap-12">
        {header()}
        <ErrorTrend history={records} />
        {historyTable}
        {observeLink}
      </div>
    );
  }

  const data = proposal.data;

  if (data.available && data.items.length > 0) {
    const unit =
      data.basis?.evidence === "observations"
        ? "명"
        : data.basis?.evidence === "mixed"
          ? "건 (실측 세션 + 사람 관측)"
          : "세션";
    return (
      <div className="flex flex-col gap-12">
        {header(
          <>
            <StatusBadge
              icon="settings"
              label={data.provisional ? "임시 조정안" : "조정안 있음"}
              tone={data.provisional ? "muted" : "strong"}
            />
            <Button disabled={data.provisional} onClick={() => setConfirming(true)}>
              보정 적용
            </Button>
          </>,
          data.basis?.evidence === "observations"
            ? "사람 관측(가장 불편했던 화면)으로 값을 제안해요 · 적용해야 반영돼요"
            : "예측·실측 차이로 값을 제안해요 · 적용해야 반영돼요",
        )}
        {data.provisional && (
          <p
            role="status"
            className="flex flex-col gap-1 rounded-lg bg-gray-50 p-4 text-caption text-ink"
          >
            <span className="font-bold">
              임시값이에요 · {data.basis?.count ?? 0}/{data.min_evidence}
              {unit}
            </span>
            <span className="text-subtle">
              지금 모인 만큼으로 계산한 미리 보기예요. {data.min_evidence}
              {unit}부터 실제 값으로 바뀌고 보정을 적용할 수 있어요.
            </span>
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs text-subtle">조정 강도</span>
          <SegmentedTabs
            label="조정 강도"
            options={[
              { value: "normal", label: "기본" },
              { value: "gentle", label: "약하게 (절반)" },
            ]}
            value={strength}
            onChange={setStrength}
          />
        </div>
        {compareSection}
        <ProposalView proposal={data} />
        <div className="flex gap-6">
          {observeLink}
          <Link to={{ search: "?view=history" }} className="text-caption font-bold text-ink">
            보정 이력 {records.length}
          </Link>
        </div>
        <ApplyModal
          open={confirming}
          items={data.items}
          pending={apply.isPending}
          error={apply.isError ? apply.error.message : null}
          onClose={() => setConfirming(false)}
          onApply={() => apply.mutate()}
        />
      </div>
    );
  }

  if (data.reason === "WAITING_NEXT_RUN" && latest) {
    return (
      <div className="flex flex-col gap-12">
        {header(
          <>
            {badge}
            <Link to={buildPath("newTest", { projectId: project.id })} className={buttonVariants()}>
              <Icon name="plus" />새 테스트 시작하기
            </Link>
          </>,
        )}
        {compareSection}
        <ErrorTrend history={records} />
        {historyTable}
        {observeLink}
      </div>
    );
  }

  if (data.reason === "NO_GAP") {
    const mean = data.basis?.mean_error;
    return (
      <div className="flex flex-col gap-12">
        {header()}
        <NoProposal
          title="지금은 보정할 차이가 없어요"
          aside={compareSection || undefined}
          message={`모든 단계가 예측 범위 안이에요${mean == null ? "" : ` · 평균 오차 ${mean}%p`}`}
          action={
            <Button variant="secondary" onClick={() => setSearchParams({ view: "history" })}>
              보정 이력 보기
            </Button>
          }
        />
        {observeLink}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-12">
      {header()}
      <NoProposal
        title={NOT_READY_TITLE[data.reason ?? ""] ?? "아직 조정안을 만들 수 없어요"}
        message={data.message ?? ""}
        action={
          <Link
            to={buildPath("analytics", { projectId: project.id })}
            className={buttonVariants({ variant: "secondary" })}
          >
            실측 분석으로 가기
          </Link>
        }
      />
      {records.length > 0 && historyTable}
      {observeLink}
    </div>
  );
}
