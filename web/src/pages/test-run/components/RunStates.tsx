import { Link } from "react-router-dom";

import characterCry from "@/assets/characters/character-cry.svg";
import { buttonVariants } from "@/components/Button/buttonVariants";
import Icon from "@/components/Icon/Icon";
import { buildPath } from "@/constants/routes";
import type { PersonaRun } from "@/types/persona.type";

import { countSessions } from "../utils/runView";

/*
  P08 실행 준비 중 — Figma 의 3단계 체크리스트.
  BE 에 준비 단계 정보가 따로 없어 세션 상태로 계산합니다:
  프로필 불러오기(실행 생성 시 완료) → 브라우저 준비(대기에서 벗어난 세션 수) → 첫 세션 시작
*/
export function PreparingChecklist({ run }: { run: PersonaRun }) {
  const total = run.sessions.length;
  const ready = run.sessions.filter((session) => session.status !== "queued").length;
  const profileCount = new Set(run.sessions.map((session) => session.profile_id)).size;

  const steps = [
    { label: `페르소나 ${profileCount}개 불러오기`, state: "완료", done: true },
    { label: "브라우저 준비", state: `${ready} / ${total}`, done: ready === total && total > 0 },
    { label: "첫 세션 시작", state: "다음", done: false },
  ];

  return (
    <ol
      aria-label="실행 준비"
      className="grid grid-cols-1 gap-4 border-y border-line py-4 sm:grid-cols-3"
    >
      {steps.map((step) => (
        <li key={step.label} className="flex items-start gap-2">
          <Icon
            name={step.done ? "status-done" : "status-running"}
            className={step.done ? "size-5 text-ink" : "size-5 animate-spin text-subtle"}
          />
          <span className="flex flex-col gap-1">
            <span className="text-sm font-bold text-ink">{step.label}</span>
            <span className="text-xs text-muted">{step.state}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/*
  P10 자리 — BE 는 리포트를 요청할 때 계산해 "분석 중" 단계가 없어, 실행이 끝나면 결과를 요약하고
  리포트로 연결합니다. (리포트 화면 P12 는 다른 작업)
*/
export function RunCompleted({ run, projectId }: { run: PersonaRun; projectId: string }) {
  const counts = countSessions(run.sessions);
  return (
    <section
      aria-labelledby="run-completed-title"
      className="flex items-center justify-between gap-6 rounded-xl bg-gray-50 p-6"
    >
      <div className="flex flex-col gap-2">
        <h2 id="run-completed-title" className="text-lg font-bold text-ink">
          실행이 끝났어요
        </h2>
        <p className="text-sm text-subtle">
          세션 {counts.all}개 · 완료 {counts.success} · 이탈 {counts.dropout} · 오류 {counts.error}
          {counts.error > 0 && " (오류는 이탈률에 넣지 않아요)"}
        </p>
      </div>
      {run.id && (
        <Link to={buildPath("report", { projectId, runId: run.id })} className={buttonVariants()}>
          리포트 보기
        </Link>
      )}
    </section>
  );
}

/* E05 실행 실패 — 모든 세션이 기술 실패로 끝남 */
export function RunFailed({ run, projectId }: { run: PersonaRun; projectId: string }) {
  const reasons = [...new Set(run.sessions.map((session) => session.reason).filter(Boolean))];
  return (
    <section
      aria-labelledby="run-failed-title"
      className="flex flex-col items-center gap-4 py-16 text-center"
    >
      <img src={characterCry} alt="" className="h-36 w-auto" />
      <h2 id="run-failed-title" className="text-lg font-bold text-ink">
        실행을 끝내지 못했어요
      </h2>
      <p className="text-caption text-subtle">
        {reasons.slice(0, 2).join(" · ") || "브라우저를 실행하지 못했어요"} · 끝난 세션 0 /{" "}
        {run.sessions.length}
      </p>
      <Link
        to={buildPath("newTest", { projectId })}
        className={buttonVariants({ variant: "secondary" })}
      >
        <Icon name="retry" />
        다시 시도
      </Link>
    </section>
  );
}
