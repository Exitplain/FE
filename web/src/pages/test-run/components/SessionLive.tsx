import { Link } from "react-router-dom";

import { buttonVariants } from "@/components/Button/buttonVariants";
import Icon from "@/components/Icon/Icon";
import ProjectPageHeader from "@/components/ProjectPageHeader/ProjectPageHeader";
import StatusBadge from "@/components/StatusBadge/StatusBadge";
import type { CurrentProject } from "@/components/Projects/currentProject";
import { RUN_CONDITIONS } from "@/pages/new-test/utils/newTest";
import type { PersonaRun, PersonaSession } from "@/types/persona.type";

import { runTitle } from "../hooks/useRunTitle";
import {
  actionLabel,
  formatClock,
  formatElapsed,
  formatTokens,
  lastUtterance,
  MAX_STEPS,
  safeViewerUrl,
  SESSION_TIME_LIMIT_MIN,
  sessionBadge,
  sessionCode,
  sessionSegment,
  STAGE_LABELS,
} from "../utils/runView";

const LOG_LIMIT = 5;

/*
  P11 세션 라이브 (?session=세션ID)
  - 라이브 화면: 실행 중이고 viewer_url 이 있으면(개발 환경 원격 브라우저) 그대로 보여주고,
    아니면 최근 관찰 스크린샷(GET /api/v1/observations/{id}/screenshot), 둘 다 없으면 자리 표시만 둡니다.
  - 현재 상태(단계·스텝·경과·좌절 점수·토큰·비용)·행동 로그 최근 5개·마지막 Think-aloud 발화.
    경과·토큰·비용·발화는 임시 필드라 mock 에만 있고, 없으면 — 로 둡니다.
*/
export default function SessionLive({
  project,
  run,
  session,
  backSearch,
}: {
  project: CurrentProject;
  run: PersonaRun;
  session: PersonaSession;
  /* 실행 화면으로 돌아갈 때 유지할 과업·필터 쿼리 */
  backSearch: string;
}) {
  const { title } = runTitle(run);
  const badge = sessionBadge(session.status);
  const last = session.trace.at(-1);
  const threshold = last?.threshold ?? session.max_required_fields * 16;
  const isRunning = session.status === "running";
  /* 앱과 다른 출처의 http(s) 주소만 iframe 으로 띄웁니다 (같은 출처면 sandbox 가 풀릴 수 있음) */
  const viewerUrl = isRunning ? safeViewerUrl(session.viewer_url, window.location.origin) : null;
  const said = lastUtterance(session);
  const code = sessionCode(session);

  const status: [string, string, boolean?][] = [
    ["현재 단계", session.terminal_stage ? STAGE_LABELS[session.terminal_stage] : "시작 전", true],
    ["스텝", `${session.steps} / ${MAX_STEPS}`],
    [
      "경과",
      session.elapsed_ms != null
        ? `${formatElapsed(session.elapsed_ms)} / ${SESSION_TIME_LIMIT_MIN}분`
        : "—",
    ],
    ["좌절 점수", `${last ? last.score : "—"} · 이탈 임계치 ${threshold}`, true],
    /* 토큰·비용은 제품 API 세션에 없어 값이 있을 때만 보여 줍니다 */
    ...(session.tokens != null
      ? [
          [
            "토큰 · 비용",
            `${formatTokens(session.tokens)} 토큰 · ${(session.cost_usd ?? 0).toFixed(2)}`,
          ] as [string, string],
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-12">
      <ProjectPageHeader
        projectId={project.id}
        breadcrumb={`${project.name} / 사전 테스트 / ${title.split(" · ").reverse().join(" · ")} · 테스트`}
        title={`${code} · 라이브`}
        description={[
          sessionSegment(session),
          `목표: ${session.task_name}`,
          ...(session.seed != null
            ? [run.seeds ? `시드 ${session.seed} / ${run.seeds.total}` : `시드 ${session.seed}`]
            : []),
        ].join(" · ")}
        activeTab="tests"
        actions={
          <>
            <StatusBadge {...badge} />
            <Link to={{ search: backSearch }} className={buttonVariants()}>
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
              {RUN_CONDITIONS.split(" · ")[0]} · {viewerUrl ? "실시간" : "마지막 화면"}
            </span>
          </div>
          <div className="flex aspect-3/4 items-center justify-center overflow-hidden rounded-xl border border-dashed border-gray-300 bg-gray-50">
            {viewerUrl ? (
              <iframe
                title={`${code} 실시간 브라우저`}
                src={viewerUrl}
                sandbox="allow-scripts allow-same-origin"
                referrerPolicy="no-referrer"
                className="size-full"
              />
            ) : session.screenshot_url ? (
              /* 제품 API 최근 관찰 화면 (같은 출처 쿠키로 받음) */
              <img
                src={session.screenshot_url}
                alt={`${code} 세션의 마지막 화면`}
                className="size-full object-contain"
              />
            ) : (
              <p className="flex flex-col items-center gap-2 p-6 text-center text-caption text-muted">
                <Icon name="image" className="size-6" />
                실제 브라우저 화면 (마우스 · 입력 위치 표시) · 원격 브라우저가 켜져 있을 때 보여요
              </p>
            )}
          </div>
        </section>

        <div className="flex flex-col gap-8">
          <section aria-labelledby="live-status-title" className="flex flex-col gap-3">
            <h2 id="live-status-title" className="text-lg font-bold text-ink">
              현재 상태
            </h2>
            <dl className="flex flex-col text-caption">
              {status.map(([label, value, strong]) => (
                <div key={label} className="flex justify-between gap-6 border-b border-line py-3">
                  <dt className="text-subtle">{label}</dt>
                  <dd className={strong ? "text-right font-bold text-ink" : "text-right text-ink"}>
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
            {!isRunning && session.reason && (
              <p className="text-xs text-muted">결과 · {session.reason}</p>
            )}
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
                {[...session.events]
                  .reverse()
                  .slice(0, LOG_LIMIT)
                  .map((event, index) => (
                    <li
                      key={`${event.step}-${index}`}
                      className="flex gap-6 border-b border-line py-3 text-caption last:border-b-0"
                    >
                      <span className="w-8 shrink-0 text-muted">{event.step}</span>
                      <span className="w-12 shrink-0 font-bold text-ink">
                        {actionLabel(event.action)}
                      </span>
                      <span className="text-gray-800">{event.description}</span>
                    </li>
                  ))}
              </ol>
            )}
          </section>

          <section aria-labelledby="live-think-title" className="flex flex-col gap-2">
            <h2 id="live-think-title" className="text-lg font-bold text-ink">
              Think-aloud
            </h2>
            {said ? (
              <>
                <p className="text-sm text-gray-800">“{said.text}”</p>
                <p className="text-xs text-muted">
                  {formatClock(said.at)} · {STAGE_LABELS[said.stage]}
                </p>
              </>
            ) : (
              <p className="text-caption text-muted">아직 발화가 없어요</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
