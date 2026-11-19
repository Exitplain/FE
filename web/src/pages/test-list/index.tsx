import { useEffect, useId, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import Button from "@/components/Button/Button";
import { buttonVariants } from "@/components/Button/buttonVariants";
import smile from "@/assets/characters/character-smile.svg";
import Icon from "@/components/Icon/Icon";
import ProjectPageHeader from "@/components/ProjectPageHeader/ProjectPageHeader";
import { useCurrentProject, type CurrentProject } from "@/components/Projects/currentProject";
import { wantsResumeActiveRun } from "@/constants/navigationState";
import { buildPath } from "@/constants/routes";
import { useRunList } from "@/hooks/useRunList";
import { ACTIVE_RUN_STATUSES } from "@/types/run.type";

import TestListTable from "./components/TestListTable";
import { toTestRows } from "./utils/testRows";

/*
  P01 사전 테스트 목록 (+ E02 빈 상태)
  - 실행 목록: GET /api/v1/projects/{id}/runs (진행 중인 실행 포함, 진행 중이면 polling)
  - 프로젝트는 ProjectRoute 가 받아 둔 것을 씁니다 (주소의 :projectId = 제품 API 숫자 id)
*/
export default function TestListPage() {
  const project = useCurrentProject();

  /* 프로젝트를 확인한 뒤에만 조회하도록 안쪽 컴포넌트에서 데이터를 받습니다 */
  return <TestList project={project} />;
}

function TestList({ project }: { project: CurrentProject }) {
  const titleId = useId();
  const runs = useRunList(project.v1Id);
  const location = useLocation();
  const navigate = useNavigate();

  /*
    사이드바 "테스트"·다른 프로젝트 탭에서 왔으면(이어 보기 state) 진행 중인 실행 화면을 바로 보여 줍니다.
    - 예전에 받아 둔 캐시는 이미 끝난 실행일 수 있어, 이 화면에서 새로 받은 목록으로만 정합니다.
    - 첫 페이지가 최신순이라 처음 만나는 진행 중 실행이 가장 최신입니다.
    - 처음 정한 결과는 고정합니다. state 를 지우기 전에 polling 이 다시 받아도 결정이 바뀌지 않습니다.
    - 정한 뒤에는 state 를 지워(replace) 목록에 머무는 동안 갑자기 옮기지 않고,
      실행 화면으로 옮길 때도 목록 항목이 history 에 남지 않아 뒤로 가기가 다시 튕기지 않습니다.
  */
  const resumeRequested = wantsResumeActiveRun(location.state);
  /* undefined = 아직 못 정함 · null = 목록에 머묾 · 문자열 = 옮겨 갈 실행 화면 */
  const [resumeTarget, setResumeTarget] = useState<string | null | undefined>(undefined);
  /* 다른 화면에서 남은 오류 상태로 정하지 않도록, 이 화면에서 받은 결과(성공·실패)가 나온 뒤에만 정합니다 */
  if (resumeRequested && resumeTarget === undefined && runs.isFetchedAfterMount && !runs.isFetching) {
    const activeRun = runs.isError
      ? undefined
      : runs.data?.pages[0]?.items.find((item) => ACTIVE_RUN_STATUSES.includes(item.status));
    setResumeTarget(
      activeRun ? buildPath("testRun", { projectId: project.id, runId: activeRun.id }) : null,
    );
  }

  useEffect(() => {
    if (!resumeRequested || resumeTarget === undefined) return;
    if (resumeTarget) navigate(resumeTarget, { replace: true });
    else
      navigate(
        { pathname: location.pathname, search: location.search, hash: location.hash },
        { replace: true, state: null },
      );
  }, [resumeRequested, resumeTarget, navigate, location]);

  const newTestPath = buildPath("newTest", { projectId: project.id });
  /* 이어 보기를 정하는 동안·옮기기 직전에는 캐시 목록을 잠깐 보여 주지 않습니다 */
  const isLoading = runs.isPending || (resumeRequested && resumeTarget !== null);
  /* 받아 둔 데이터가 있으면 polling 이 한 번 실패해도 목록을 그대로 둡니다 */
  const isError = runs.isError && runs.data === undefined;
  const isRetrying = runs.isFetching;
  /*
    더 보기 사이에 새 실행이 생겨 페이지 경계가 밀리면 같은 실행이 두 페이지에 올 수 있어 한 번만 둡니다.
    주의: 실행·리포트 화면은 아직 개발 API 라, mock 이 아닌 BE 연결에서는
    여기 링크의 실행 id 를 그 화면들이 모를 수 있습니다. (리포트·실행 화면 v1 전환 PR 에서 맞춥니다)
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
                onClick={() => void runs.refetch()}
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
