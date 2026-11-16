import { useId } from "react";
import { Link, useParams } from "react-router-dom";

import Button from "@/components/Button/Button";
import { buttonVariants } from "@/components/Button/buttonVariants";
import smile from "@/assets/characters/character-smile.svg";
import Icon from "@/components/Icon/Icon";
import ProjectPageHeader from "@/components/ProjectPageHeader/ProjectPageHeader";
import { findSampleProject, type SampleProject } from "@/constants/projects";
import { buildPath } from "@/constants/routes";
import { useRunList } from "@/hooks/useRunList";
import { useV1ProjectId } from "@/hooks/useV1ProjectId";

import TestListTable from "./components/TestListTable";
import { toTestRows } from "./utils/testRows";

/*
  P01 사전 테스트 목록 (+ E02 빈 상태)
  - 실행 목록: GET /api/v1/projects/{id}/runs (진행 중인 실행 포함, 진행 중이면 polling)
  - 화면 프로젝트 id → 제품 API id: GET /api/v1/sample/projects (hooks/useV1ProjectId)
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
  const v1Project = useV1ProjectId(project);
  const runs = useRunList(v1Project.v1Id);
  /* 제품 API 에 없는 프로젝트는 실행 목록을 묻지 않고 빈 상태로 둡니다 */
  const isUnsupported = !v1Project.isPending && !v1Project.isError && v1Project.v1Id === undefined;

  const newTestPath = buildPath("newTest", { projectId: project.id });
  const isLoading = v1Project.isPending || (v1Project.v1Id !== undefined && runs.isPending);
  /* 받아 둔 데이터가 있으면 polling 이 한 번 실패해도 목록을 그대로 둡니다 */
  const isError = v1Project.isError || (runs.isError && runs.data === undefined);
  const isRetrying = v1Project.isFetching || runs.isFetching;
  /*
    더 보기 사이에 새 실행이 생겨 페이지 경계가 밀리면 같은 실행이 두 페이지에 올 수 있어 한 번만 둡니다.
    주의: 이 화면만 제품 API 이고 실행·리포트 화면은 아직 개발 API 라, mock 이 아닌 BE 연결에서는
    여기 링크의 실행 id 를 그 화면들이 모를 수 있습니다. (리포트 화면 v1 전환 PR 에서 맞춥니다)
  */
  const items = (runs.data?.pages.flatMap((page) => page.items) ?? []).filter(
    (item, index, all) => all.findIndex((other) => other.id === item.id) === index,
  );
  const rows = toTestRows(items);
  /* Figma E02: 빈 상태는 머리말 버튼·"사전 테스트" 제목 없이 가운데 캐릭터와 버튼 하나만 둡니다 */
  const isEmpty = !isLoading && !isError && rows.length === 0;

  return (
    <div className="flex flex-col gap-12">
      <ProjectPageHeader
        projectId={project.id}
        breadcrumb={`${project.name} · 테스트`}
        title={project.name}
        description={project.url}
        activeTab="tests"
        actions={
          !isEmpty && (
            <Link to={newTestPath} className={buttonVariants()}>
              <Icon name="plus" />새 테스트 시작하기
            </Link>
          )
        }
      />

      {isEmpty ? (
        <section
          aria-labelledby={titleId}
          className="flex min-h-120 flex-col items-center justify-center gap-12 text-center"
        >
          <img src={smile} alt="" className="max-w-full" />
          {isUnsupported && (
            <p className="text-caption text-subtle">
              지금 개발 서버는 반찬로드 모의 쇼핑몰만 실행해요.
            </p>
          )}
          <div className="flex flex-col items-center gap-8">
            <div className="flex flex-col gap-4">
              <h2 id={titleId} className="text-lg font-bold text-ink">
                아직 진행 중인 테스트가 없어요
              </h2>
              <p className="text-caption text-subtle">AI 고객 20명이 어디서 왜 떠나는지 알려줘요</p>
            </div>
            <Link to={newTestPath} className={buttonVariants({ variant: "outline" })}>
              <Icon name="plus" />새 테스트 시작하기
            </Link>
          </div>
        </section>
      ) : (
        <section className="flex flex-col gap-4">
          <h2 id={titleId} className="text-lg font-bold text-ink">
            사전 테스트
          </h2>
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
                  if (v1Project.isError) void v1Project.refetch();
                  else void runs.refetch();
                }}
              >
                다시 시도
              </Button>
            </div>
          )}

          {!isLoading && !isError && rows.length > 0 && (
            <TestListTable projectId={project.id} rows={rows} labelledBy={titleId} />
          )}

          {!isLoading && !isError && runs.isFetchNextPageError && (
            <p role="alert" className="text-center text-caption text-subtle">
              다음 기록을 불러오지 못했어요. 다시 눌러 주세요.
            </p>
          )}

          {!isLoading && !isError && runs.hasNextPage && (
            <Button
              variant="secondary"
              className="self-center"
              disabled={runs.isFetchingNextPage}
              onClick={() => void runs.fetchNextPage()}
            >
              {runs.isFetchingNextPage ? "불러오는 중…" : "더 보기"}
            </Button>
          )}
        </section>
      )}
    </div>
  );
}
