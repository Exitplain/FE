import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { buttonVariants } from "@/components/Button/buttonVariants";
import Button from "@/components/Button/Button";
import Icon from "@/components/Icon/Icon";
import ProjectPageHeader from "@/components/ProjectPageHeader/ProjectPageHeader";
import StatusBadge from "@/components/StatusBadge/StatusBadge";
import { findSampleProject, type SampleProject } from "@/constants/projects";
import { buildPath } from "@/constants/routes";
import { useToastStore } from "@/stores/useToastStore";

import {
  AppliedView,
  ApplyModal,
  HistoryTable,
  NoDifference,
  ProposalView,
} from "./components/CalibrationViews";
import ObservationView from "./components/ObservationView";
import {
  formatApplied,
  historyOf,
  PROPOSAL_PROJECTS,
  useCalibrationMockStore,
} from "./data/calibrationMock";

/*
  K01~K04 보정 (/projects/:projectId/calibration?view=history|observe)
  임시: 보정 API 명세가 없어 하드코딩 목데이터(data/calibrationMock.ts)로 화면만 보여줍니다.
  - 조정안이 있으면 K01 → 적용 확인(K02) → 적용됨(K03, 보정 이력 K03b)
  - 조정안이 없으면 E11, 사람 관측 입력은 ?view=observe (K04)
*/
export default function CalibrationPage() {
  const { projectId } = useParams();
  const project = findSampleProject(projectId);
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
  return <Calibration key={project.id} project={project} />;
}

function Calibration({ project }: { project: SampleProject }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get("view");
  const appliedAt = useCalibrationMockStore((state) => state.appliedAt[project.id]);
  const history = useCalibrationMockStore((state) => historyOf(state, project.id));
  const [confirming, setConfirming] = useState(false);
  const hasProposal = PROPOSAL_PROJECTS.includes(project.id);
  const crumb = `${project.name} / 보정 · 테스트`;

  const observeLink = (
    <Link
      to={{ search: "?view=observe" }}
      className="flex w-fit items-center gap-1 text-caption font-bold text-ink hover:underline"
    >
      사람 관측으로 원인까지 비교하기
      <Icon name="chevron-right" className="size-4" />
    </Link>
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
        <ObservationView projectId={project.id} />
      </div>
    );
  }

  if (appliedAt || view === "history") {
    const tab = view === "history" ? "history" : "errors";
    const newTestLink = (
      <Link to={buildPath("newTest", { projectId: project.id })} className={buttonVariants()}>
        <Icon name="plus" />새 테스트 시작하기
      </Link>
    );
    return (
      <div className="flex flex-col gap-12">
        <ProjectPageHeader
          projectId={project.id}
          breadcrumb={crumb}
          title="보정"
          description={
            appliedAt
              ? `${formatApplied(appliedAt)} 적용 · 이후 사전 테스트에 자동 적용돼요`
              : undefined
          }
          actions={
            appliedAt ? (
              <>
                <StatusBadge icon="check" label="보정 적용됨" tone="muted" />
                {newTestLink}
              </>
            ) : (
              <StatusBadge icon="circle" label="보정 전" tone="muted" />
            )
          }
          activeTab="calibration"
        />
        {appliedAt ? (
          <AppliedView
            tab={tab}
            onTabChange={(next) => setSearchParams(next === "history" ? { view: "history" } : {})}
            history={history}
          />
        ) : (
          <HistoryTable history={history} />
        )}
        {observeLink}
      </div>
    );
  }

  if (!hasProposal) {
    return (
      <div className="flex flex-col gap-12">
        <ProjectPageHeader
          projectId={project.id}
          breadcrumb={crumb}
          title="보정"
          actions={<StatusBadge icon="circle" label="보정 전" tone="muted" />}
          activeTab="calibration"
        />
        <NoDifference onHistory={() => setSearchParams({ view: "history" })} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-12">
      <ProjectPageHeader
        projectId={project.id}
        breadcrumb={crumb}
        title="보정"
        description="예측·실측 차이로 값을 제안해요 · 적용해야 반영돼요"
        actions={
          <>
            <StatusBadge icon="settings" label="조정안 있음" tone="strong" />
            <Button onClick={() => setConfirming(true)}>보정 적용</Button>
          </>
        }
        activeTab="calibration"
      />
      <ProposalView />
      {observeLink}
      <ApplyModal
        open={confirming}
        onClose={() => setConfirming(false)}
        onApply={() => {
          useCalibrationMockStore.getState().apply(project.id, new Date());
          setConfirming(false);
          useToastStore.getState().show("보정을 적용했어요. 다음 사전 테스트부터 반영돼요");
        }}
      />
    </div>
  );
}
