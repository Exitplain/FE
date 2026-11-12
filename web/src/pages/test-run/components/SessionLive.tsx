import { Link } from "react-router-dom";

import { buttonVariants } from "@/components/Button/buttonVariants";
import Icon from "@/components/Icon/Icon";
import ProjectPageHeader from "@/components/ProjectPageHeader/ProjectPageHeader";
import StatusBadge from "@/components/StatusBadge/StatusBadge";
import type { SampleProject } from "@/constants/projects";
import type { PersonaSession } from "@/types/persona.type";

import { MAX_STEPS, sessionBadge, STAGE_LABELS } from "../utils/runView";

/*
  P11 세션 라이브 (?session=세션ID)
  - 라이브 화면: 실행 중이고 viewer_url 이 있으면(개발 환경 원격 브라우저) 그대로 보여주고,
    아니면 마지막 스크린샷(GET /api/artifacts/{id}), 둘 다 없으면 안내만 둡니다.
  - 현재 상태·행동 로그는 세션 응답(steps, trace, events, reason)으로 채웁니다. 토큰·비용은 BE 에 없습니다.
*/
export default function SessionLive({
  project,
  session,
}: {
  project: SampleProject;
  session: PersonaSession;
}) {
  const badge = sessionBadge(session.status);
  const last = session.trace.at(-1);
  const threshold = last?.threshold ?? session.max_required_fields * 16;
  const isRunning = session.status === "running";

  return (
    <div className="flex flex-col gap-12">
      <ProjectPageHeader
        projectId={project.id}
        breadcrumb={`${project.name} / 사전 테스트 · ${session.task_name} · 테스트`}
        title={`${session.name} · 라이브`}
        description={`${session.task_name} · ${session.goal || "목표 없음"} · 화면 너비 ${session.width}px`}
        activeTab="tests"
        actions={
          <>
            <StatusBadge {...badge} />
            <Link to={{ search: "" }} className={buttonVariants()}>
              실행 화면으로
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <section aria-labelledby="live-screen-title" className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 id="live-screen-title" className="text-base font-bold text-ink">
              라이브 화면
            </h2>
            <span className="text-xs text-muted">
              {isRunning && session.viewer_url ? "실시간" : "마지막 화면"}
            </span>
          </div>
          <div className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded-xl border border-dashed border-gray-300 bg-gray-50">
            {isRunning && session.viewer_url ? (
              <iframe
                title={`${session.name} 실시간 브라우저`}
                src={session.viewer_url}
                sandbox="allow-scripts allow-same-origin"
                className="size-full"
              />
            ) : session.artifact_id ? (
              <img
                src={`/api/artifacts/${encodeURIComponent(session.artifact_id)}`}
                alt={`${session.name} 세션의 마지막 화면`}
                className="size-full object-contain"
              />
            ) : (
              <p className="flex flex-col items-center gap-2 p-6 text-center text-caption text-muted">
                <Icon name="image" className="size-6" />
                화면이 아직 없어요 · 실시간 화면은 개발 서버의 원격 브라우저가 켜져 있을 때 보여요
              </p>
            )}
          </div>
        </section>

        <div className="flex flex-col gap-8">
          <section aria-labelledby="live-status-title" className="flex flex-col gap-3">
            <h2 id="live-status-title" className="text-lg font-bold text-ink">
              현재 상태
            </h2>
            <dl className="flex flex-col text-sm">
              {[
                [
                  "현재 단계",
                  session.terminal_stage ? STAGE_LABELS[session.terminal_stage] : "시작 전",
                ],
                ["스텝", `${session.steps} / ${MAX_STEPS}`],
                [
                  "좌절 점수",
                  last
                    ? `${last.score} · 이탈 임계치 ${threshold}`
                    : `— · 이탈 임계치 ${threshold}`,
                ],
                [isRunning ? "지금 하는 일" : "결과", session.reason || "—"],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-6 border-b border-line py-3">
                  <dt className="text-subtle">{label}</dt>
                  <dd className="text-right font-bold text-ink">{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section aria-labelledby="live-log-title" className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <h2 id="live-log-title" className="text-lg font-bold text-ink">
                행동 로그
              </h2>
              <span className="text-xs text-muted">최신순</span>
            </div>
            {session.events.length === 0 ? (
              <p className="text-caption text-muted">아직 행동이 없어요</p>
            ) : (
              <ol className="flex flex-col">
                {[...session.events].reverse().map((event) => (
                  <li key={event.step} className="flex gap-6 border-b border-line py-3 text-sm">
                    <span className="w-8 shrink-0 text-muted">{event.step}</span>
                    <span className="w-12 shrink-0 font-bold text-ink">{event.action}</span>
                    <span className="text-gray-800">{event.description}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
