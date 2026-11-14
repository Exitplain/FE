import { useState } from "react";

import door from "@/assets/characters/character-door-peek.svg";
import Button from "@/components/Button/Button";
import WorkspacePageHeader from "@/components/Workspace/WorkspacePageHeader";
import WorkspaceState, { WorkspaceRetry } from "@/components/Workspace/WorkspaceState";
import { useWorkspaceData } from "@/hooks/useWorkspaceData";

import ProjectLoops from "./components/ProjectLoops";
import { RecentGoals, RecentIssues } from "./components/RecentActivity";
import RunningTestCard from "./components/RunningTestCard";
import StartTestModal from "./components/StartTestModal";
import SummaryCards from "./components/SummaryCards";

import "@/components/Workspace/workspace.css";

export default function DashboardPage() {
  const query = useWorkspaceData();
  const [startOpen, setStartOpen] = useState(false);
  const data = query.data;
  return (
    <div className="space-y-8 text-ink">
      <WorkspacePageHeader
        title="대시보드"
        description={
          query.isLoading ? "불러오는 중" : `프로젝트 ${data?.projects.length ?? 0}개 · 샘플 데이터`
        }
        actions={
          <Button icon="plus" onClick={() => setStartOpen(true)} disabled={!data}>
            새 테스트 시작하기
          </Button>
        }
      />
      {query.isLoading ? (
        <WorkspaceState kind="loading" title="대시보드를 불러오는 중이에요" />
      ) : query.isError ? (
        <WorkspaceState
          kind="error"
          title="대시보드를 불러오지 못했어요"
          description="연결을 확인하고 다시 시도해 주세요 · 테스트는 계속 실행 중"
          action={<WorkspaceRetry onClick={query.retry} />}
        />
      ) : (
        data &&
        (query.isEmpty ? (
          <>
            <ProjectLoops
              projects={data.projects.slice(0, 1)}
              beforeTest
              onStart={() => setStartOpen(true)}
            />
            <section className="flex min-h-120 flex-col items-center justify-center gap-6 text-center">
              <img src={door} alt="" />
              <h2 className="text-lg font-bold">첫 테스트를 시작해 보세요</h2>
              <p className="text-sm text-subtle">
                반찬로드에서 AI 고객 20명이 어디서 왜 떠나는지 알려줘요
              </p>
              <Button variant="secondary" icon="plus" onClick={() => setStartOpen(true)}>
                새 테스트 시작하기
              </Button>
            </section>
          </>
        ) : (
          <>
            <SummaryCards data={data} />
            <div className="grid gap-x-14 gap-y-16 pt-6 xl:grid-cols-3">
              <div className="xl:col-span-2">
                <ProjectLoops projects={data.projects} />
              </div>
              <RunningTestCard run={data.activeRun} />
              <div className="xl:col-span-2">
                <RecentIssues issues={data.issues} />
              </div>
              <RecentGoals runs={data.recentGoals} />
            </div>
          </>
        ))
      )}
      {data && (
        <StartTestModal
          open={startOpen}
          onClose={() => setStartOpen(false)}
          projects={data.projects}
        />
      )}
    </div>
  );
}
