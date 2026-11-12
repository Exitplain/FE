import { useId } from "react";
import { Link, useParams } from "react-router-dom";

import Button from "@/components/Button/Button";
import { buttonVariants } from "@/components/Button/buttonVariants";
import EmptyState from "@/components/EmptyState/EmptyState";
import Icon from "@/components/Icon/Icon";
import ProjectPageHeader from "@/components/ProjectPageHeader/ProjectPageHeader";
import { findSampleProject, type SampleProject } from "@/constants/projects";
import { buildPath } from "@/constants/routes";
import { usePersonaReports } from "@/hooks/usePersonaReports";
import { usePersonaRun } from "@/hooks/usePersonaRun";

import TestListTable from "./components/TestListTable";
import { toTestRows } from "./utils/testRows";

/*
  P01 사전 테스트 목록 (+ E02 빈 상태)
  - 완료된 실행: GET /api/personas/reports
  - 진행 중인 실행: GET /api/personas (실행 중이면 polling, 목록 맨 위에 표시)
*/
export default function TestListPage() {
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

  /* 프로젝트를 확인한 뒤에만 조회하도록 안쪽 컴포넌트에서 데이터를 받습니다 */
  return <TestList project={project} />;
}

function TestList({ project }: { project: SampleProject }) {
  const titleId = useId();
  const reports = usePersonaReports();
  const currentRun = usePersonaRun();

  const newTestPath = buildPath("newTest", { projectId: project.id });
  const isLoading = reports.isPending || currentRun.isPending;
  /* 받아 둔 데이터가 있으면 polling 이 한 번 실패해도 목록을 그대로 둡니다 */
  const isError =
    (reports.isError && reports.data === undefined) ||
    (currentRun.isError && currentRun.data === undefined);
  const isRetrying = reports.isFetching || currentRun.isFetching;
  const rows = toTestRows({ reports: reports.data ?? [], currentRun: currentRun.data });

  return (
    <div className="flex flex-col gap-12">
      <ProjectPageHeader
        projectId={project.id}
        breadcrumb={`${project.name} · 테스트`}
        title={project.name}
        description={project.url}
        activeTab="tests"
        actions={
          <Link to={newTestPath} className={buttonVariants()}>
            <Icon name="plus" />새 테스트 시작하기
          </Link>
        }
      />

      <section className="flex flex-col gap-4">
        <h2 id={titleId} className="text-lg font-bold text-ink">
          사전 테스트
        </h2>
        {project.id !== "banchan" && (
          <p className="text-caption text-subtle">
            지금 개발 서버는 반찬로드 모의 쇼핑몰만 실행해요 · 아래 기록도 반찬로드 기준이에요
          </p>
        )}

        {isLoading && (
          <p role="status" className="py-8 text-sm text-muted">
            사전 테스트를 불러오는 중이에요…
          </p>
        )}

        {!isLoading && isError && (
          <div
            role="alert"
            className="flex items-center justify-between gap-4 rounded-lg bg-gray-50 p-4"
          >
            <p className="text-sm text-ink">
              사전 테스트를 불러오지 못했어요. 서버 연결을 확인해 주세요.
            </p>
            <Button
              variant="secondary"
              icon="retry"
              disabled={isRetrying}
              onClick={() => {
                void reports.refetch();
                void currentRun.refetch();
              }}
            >
              다시 시도
            </Button>
          </div>
        )}

        {!isLoading && !isError && rows.length === 0 && (
          /* Figma E02 — 메쉬 띠 위 흰 카드 */
          <div className="rounded-2xl bg-canvas p-6">
            <EmptyState
              icon="play"
              headingLevel={3}
              title="아직 사전 테스트가 없어요"
              description="AI 고객이 어디서 왜 떠나는지 알려줘요"
              action={
                <Link to={newTestPath} className={buttonVariants()}>
                  새 테스트 시작하기
                </Link>
              }
            />
          </div>
        )}

        {!isLoading && !isError && rows.length > 0 && (
          <TestListTable projectId={project.id} rows={rows} labelledBy={titleId} />
        )}
      </section>
    </div>
  );
}
