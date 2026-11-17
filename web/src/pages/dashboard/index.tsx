import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { queryKeys } from "@/apis/queryKeys";

import door from "@/assets/characters/character-door-peek.svg";
import Button from "@/components/Button/Button";
import WorkspacePageHeader from "@/components/Workspace/WorkspacePageHeader";
import WorkspaceState, { WorkspaceRetry } from "@/components/Workspace/WorkspaceState";
import { useIssues } from "@/hooks/useIssues";
import { useProjectRuns } from "@/hooks/useProjectRuns";
import { useRunDetail } from "@/pages/report/hooks/useRunReport";
import { ApiError } from "@/types/api.type";
import { formatClock } from "@/pages/test-run/utils/runView";

import ProjectLoops from "./components/ProjectLoops";
import { RecentGoals, RecentIssues } from "./components/RecentActivity";
import RunningTestCard from "./components/RunningTestCard";
import StartTestModal from "./components/StartTestModal";
import SummaryCards from "./components/SummaryCards";
import { activeItemOf, runningCard, waitingCard, weekCounts } from "./utils/dashboardData";

import "@/components/Workspace/workspace.css";

/*
  W01 대시보드 — 내 프로젝트(+샘플)의 실행 목록(리포트 요약 포함)으로 만듭니다.
  프로젝트 단위 GET /projects/{id}/dashboard 와 같은 값(최근 달성률·주요 원인)이 실행 목록에 이미 있어 따로 부르지 않습니다.
  보정 조정안·실측 비교는 BE 에 없어 숨깁니다.
*/
export default function DashboardPage() {
  const query = useProjectRuns();
  const issues = useIssues();
  const [startOpen, setStartOpen] = useState(false);
  const [asOf] = useState(() => new Date().toISOString());

  const projects = query.records;
  const runs = [...query.runs].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  const active = activeItemOf(query.items);
  /* 실행이 끝나 진행 중 실행이 바뀌면 새 리포트가 생겼을 수 있어 발견한 문제를 다시 받습니다 */
  const client = useQueryClient();
  const activeId = active?.item.id;
  const previousActive = useRef(activeId);
  useEffect(() => {
    if (previousActive.current && previousActive.current !== activeId) {
      void client.invalidateQueries({ queryKey: queryKeys.issues.all });
    }
    previousActive.current = activeId;
  }, [activeId, client]);
  /*
    지금 실행 중인 실행의 세션 상태별 수 (리포트 화면과 같은 조회·폴링). 끝나면 실행 목록 폴링이 카드를 내립니다.
    상태를 받기 전에는 목록 값(이름·차수)으로 카드를 먼저 그립니다
  */
  const activeDetail = useRunDetail(active?.item.id ?? "", { enabled: active != null });
  const activeCard =
    active &&
    (activeDetail.data?.id === active.item.id
      ? runningCard(active.project, activeDetail.data)
      : waitingCard(active.project, active.item));
  /* 일부 프로젝트를 못 받았으면 실행이 없다고 단정하지 않습니다 */
  const empty =
    !query.isPending && !query.isError && query.failedProjects === 0 && runs.length === 0;
  const week = weekCounts(query.items);

  return (
    <div className="space-y-8 text-ink">
      <WorkspacePageHeader
        title="대시보드"
        description={
          query.isPending
            ? "불러오는 중"
            : `프로젝트 ${projects.length}개 · ${formatClock(asOf)} 기준`
        }
        actions={
          <Button icon="plus" onClick={() => setStartOpen(true)} disabled={query.isPending}>
            새 테스트 시작하기
          </Button>
        }
      />
      {query.failedProjects > 0 && (
        <p role="status" className="text-xs text-danger">
          프로젝트 {query.failedProjects}개의 기록을 불러오지 못했어요. 받은 기록만 보여 줘요.
        </p>
      )}
      {query.isPending ? (
        <WorkspaceState kind="loading" title="대시보드를 불러오는 중이에요" />
      ) : query.isError ? (
        <WorkspaceState
          kind="error"
          title="대시보드를 불러오지 못했어요"
          description="연결을 확인하고 다시 시도해 주세요 · 테스트는 계속 실행 중"
          action={<WorkspaceRetry onClick={query.refetch} />}
        />
      ) : empty ? (
        <>
          <ProjectLoops projects={projects} beforeTest onStart={() => setStartOpen(true)} />
          <section className="flex min-h-120 flex-col items-center justify-center gap-6 text-center">
            <img src={door} alt="" />
            <h2 className="text-lg font-bold">첫 테스트를 시작해 보세요</h2>
            <p className="text-sm text-subtle">AI 고객이 사이트 어디서 왜 떠나는지 알려줘요</p>
            <Button variant="secondary" icon="plus" onClick={() => setStartOpen(true)}>
              새 테스트 시작하기
            </Button>
          </section>
        </>
      ) : (
        <>
          <SummaryCards completed={week.completed} failed={week.failed} />
          <div className="grid gap-x-14 gap-y-16 pt-6 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <ProjectLoops projects={projects} />
            </div>
            {activeCard ? <RunningTestCard run={activeCard} /> : <div />}
            <div className="xl:col-span-2">
              <RecentIssues
                issues={issues.data}
                failed={issues.isError}
                loggedOut={issues.error instanceof ApiError && issues.error.status === 401}
              />
            </div>
            <RecentGoals runs={runs} />
          </div>
        </>
      )}
      {/* 첫 프로젝트를 기본으로 고르므로 목록을 받은 뒤에 그립니다 (0개면 새 프로젝트만 고를 수 있음) */}
      {!query.isPending && (
        <StartTestModal open={startOpen} onClose={() => setStartOpen(false)} projects={projects} />
      )}
    </div>
  );
}
