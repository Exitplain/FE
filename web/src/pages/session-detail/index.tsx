import { type KeyboardEvent, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { buttonVariants } from "@/components/Button/buttonVariants";
import ProjectPageHeader from "@/components/ProjectPageHeader/ProjectPageHeader";
import StatusBadge from "@/components/StatusBadge/StatusBadge";
import WorkspaceState, { WorkspaceRetry } from "@/components/Workspace/WorkspaceState";
import { useCurrentProject, type CurrentProject } from "@/components/Projects/currentProject";
import { buildPath } from "@/constants/routes";
import { useRunDetail } from "@/pages/report/hooks/useRunReport";
import { sessionCode } from "@/pages/test-run/utils/runView";
import { ApiError } from "@/types/api.type";
import type { PersonaSession } from "@/types/persona.type";
import type { ReportSessionKey } from "@/types/report.type";
import { cn } from "@/utils/cn";

import ScreenModal from "./components/ScreenModal";
import SessionError from "./components/SessionError";
import SessionSummary from "./components/SessionSummary";
import StepTimeline from "./components/StepTimeline";
import { useSessionDetail } from "./hooks/useSessionDetail";
import {
  describeSession,
  isTechnical,
  mergeSteps,
  parseTab,
  type SessionTab,
  type StepRow,
} from "./utils/sessionView";

/*
  P15 세션 상세(이탈) · P16(완료) · P15b 화면 크게 보기 · P15c 스텝 타임라인 · E06 세션 오류.
  - 주소: /runs/:runId/sessions/:taskId/:seed/:personaId (리포트 세션 목록 한 줄의 키)
  - 탭은 주소 ?tab=summary|timeline 로 둡니다 (새로 고침·공유해도 같은 탭)
  - P15d 질문은 BE 질문 API 가 없어 숨깁니다
*/
export default function SessionDetailPage() {
  const { runId, taskId, seed, personaId } = useParams();
  const project = useCurrentProject();
  const seedNo = Number(seed);

  if (!runId || !taskId || !personaId || !Number.isInteger(seedNo)) {
    return (
      <section className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold text-ink">세션을 찾을 수 없어요</h1>
        <p className="text-sm text-subtle">주소를 확인하거나 리포트에서 세션을 다시 골라 주세요.</p>
      </section>
    );
  }

  const sessionKey = { taskId, seed: seedNo, personaId };
  return (
    <SessionDetail
      key={`${runId}/${taskId}/${seedNo}/${personaId}`}
      project={project}
      runId={runId}
      sessionKey={sessionKey}
    />
  );
}

function statusBadge(session: PersonaSession) {
  if (isTechnical(session.status)) {
    return <StatusBadge icon="status-error" label="오류" tone="alert" />;
  }
  switch (session.status) {
    case "simulated_dropout":
      return <StatusBadge icon="status-exit" label="이탈" tone="alert" />;
    case "success":
      return <StatusBadge icon="check" label="완료" />;
    default:
      return <StatusBadge icon="status-running" label="미완료" tone="strong" />;
  }
}

function SessionDetail({
  project,
  runId,
  sessionKey,
}: {
  project: CurrentProject;
  runId: string;
  sessionKey: ReportSessionKey;
}) {
  const detail = useSessionDetail(runId, sessionKey);
  const run = useRunDetail(runId);
  const [params, setParams] = useSearchParams();
  const [screen, setScreen] = useState<StepRow | null>(null);

  const tab = parseTab(params.get("tab"));
  const changeTab = (next: SessionTab) => {
    setParams(
      (previous) => {
        const query = new URLSearchParams(previous);
        query.set("tab", next);
        return query;
      },
      { replace: true },
    );
  };

  const session = detail.data;
  const order = run.data?.sequence_no;
  const steps = session ? mergeSteps(session) : [];
  const technical = session ? isTechnical(session.status) : false;
  const status = detail.error instanceof ApiError ? detail.error.status : null;
  const reportPath = buildPath("report", { projectId: project.id, runId });

  return (
    <div className="flex flex-col gap-10">
      <ProjectPageHeader
        projectId={project.id}
        breadcrumb={[
          project.name,
          "사전 테스트",
          [session?.task_name, order ? `${order}차` : null, "테스트"].filter(Boolean).join(" · "),
        ].join(" / ")}
        title={session ? `${sessionCode(session)} · 세션 상세` : "세션 상세"}
        description={session && describeSession(session)}
        actions={
          <>
            {session && statusBadge(session)}
            <Link to={reportPath} className={buttonVariants()}>
              리포트로 돌아가기
            </Link>
          </>
        }
        activeTab="tests"
      />

      {detail.isPending && <WorkspaceState kind="loading" title="세션 기록을 불러오고 있어요" />}
      {detail.error && !session && (
        <WorkspaceState
          kind="error"
          title={
            status === 404
              ? "세션을 찾을 수 없어요"
              : status === 409
                ? "세션 기록이 남아 있지 않아요"
                : "세션 기록을 불러오지 못했어요"
          }
          description={
            status === 404
              ? "끝난 실행의 세션만 볼 수 있어요. 리포트에서 다시 골라 주세요."
              : status === 409
                ? "보관 기간이 지나 기록이 지워졌을 수 있어요."
                : "잠시 뒤 다시 시도해 주세요."
          }
          action={
            status === 404 || status === 409 ? (
              <Link to={reportPath} className={buttonVariants({ variant: "secondary" })}>
                리포트로 돌아가기
              </Link>
            ) : (
              <WorkspaceRetry onClick={detail.refetch} />
            )
          }
        />
      )}

      {session && technical && <SessionError session={session} steps={steps} />}

      {session && !technical && (
        <>
          <SessionTabs value={tab} onChange={changeTab} stepCount={steps.length} />
          <div
            role="tabpanel"
            tabIndex={0}
            id={`session-panel-${tab}`}
            aria-labelledby={`session-tab-${tab}`}
            className="outline-none"
          >
            {tab === "summary" && (
              <SessionSummary
                session={session}
                steps={steps}
                onShowTimeline={() => changeTab("timeline")}
              />
            )}
            {tab === "timeline" && (
              <StepTimeline steps={steps} focusStep={null} onOpenScreen={setScreen} />
            )}
          </div>
        </>
      )}

      <ScreenModal step={screen} issueFields={null} onClose={() => setScreen(null)} />
    </div>
  );
}

const TAB_LABELS: Record<SessionTab, string> = {
  summary: "요약",
  timeline: "스텝 타임라인",
};

/* Figma 밑줄 탭 (요약 · 스텝 타임라인 n). 화살표·Home·End 로 옮겨 다닙니다 */
function SessionTabs({
  value,
  onChange,
  stepCount,
}: {
  value: SessionTab;
  onChange: (tab: SessionTab) => void;
  stepCount: number;
}) {
  const tabs = Object.keys(TAB_LABELS) as SessionTab[];
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = tabs.indexOf(value);
    const target: Record<string, number> = {
      ArrowRight: (current + 1) % tabs.length,
      ArrowLeft: (current - 1 + tabs.length) % tabs.length,
      Home: 0,
      End: tabs.length - 1,
    };
    const next = target[event.key];
    if (next === undefined) return;
    event.preventDefault();
    onChange(tabs[next]);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label="세션 상세"
      onKeyDown={onKeyDown}
      className="flex gap-6 border-b border-line"
    >
      {tabs.map((tab, index) => {
        const selected = tab === value;
        return (
          <button
            key={tab}
            ref={(element) => {
              refs.current[index] = element;
            }}
            type="button"
            role="tab"
            id={`session-tab-${tab}`}
            aria-selected={selected}
            /* 패널은 선택된 탭 것만 그립니다 */
            aria-controls={selected ? `session-panel-${tab}` : undefined}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab)}
            className={cn(
              "-mb-px min-h-10 border-b-2 text-caption",
              selected ? "border-ink font-bold text-ink" : "border-transparent text-subtle",
            )}
          >
            {TAB_LABELS[tab]}
            {tab === "timeline" ? ` ${stepCount}` : ""}
          </button>
        );
      })}
    </div>
  );
}
