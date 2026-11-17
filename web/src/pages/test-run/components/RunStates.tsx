import { Link } from "react-router-dom";

import characterCry from "@/assets/characters/character-cry.svg";
import { buttonVariants } from "@/components/Button/buttonVariants";
import Icon from "@/components/Icon/Icon";
import type { IconName } from "@/components/Icon/iconNames";
import { buildPath } from "@/constants/routes";
import type { PersonaRun } from "@/types/persona.type";
import { cn } from "@/utils/cn";

import { countSessions, failureSummary } from "../utils/runView";

type CheckState = "done" | "running" | "next";

const CHECK_ICON: Record<CheckState, IconName> = {
  done: "status-done",
  running: "status-running",
  next: "status-wait",
};

/* Figma P08·P10 3단계 체크리스트 — 세 칸을 세로 선으로 나눕니다 */
function PhaseChecklist({
  label,
  steps,
}: {
  label: string;
  steps: { label: string; state: string; status: CheckState }[];
}) {
  return (
    <ol aria-label={label} className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-0">
      {steps.map((step, index) => (
        <li
          key={step.label}
          className={cn("flex flex-col gap-2", index > 0 && "sm:border-l sm:border-line sm:pl-6")}
        >
          <span className="flex items-center gap-2 text-caption font-bold text-ink">
            <Icon
              name={CHECK_ICON[step.status]}
              className={cn("size-5", step.status === "running" && "animate-spin text-subtle")}
            />
            {step.label}
          </span>
          <span className="pl-7 text-xs text-muted">{step.state}</span>
        </li>
      ))}
    </ol>
  );
}

/*
  P08 실행 준비 중 — 페르소나·시드 불러오기 → 브라우저 준비(n / N) → 첫 세션 시작.
  임시 prepare 필드(mock)가 없으면(BE) 대기에서 벗어난 세션 수로 셉니다.
*/
export function PreparingChecklist({ run, panelSize }: { run: PersonaRun; panelSize: number }) {
  const total = run.prepare?.browsers_total ?? run.sessions.length;
  const ready =
    run.prepare?.browsers_ready ??
    run.sessions.filter((session) => session.status !== "queued").length;
  return (
    <PhaseChecklist
      label="실행 준비"
      steps={[
        {
          /* 제품 API 는 시드 수를 주지 않아 있을 때만 붙입니다 */
          label: run.seeds
            ? `페르소나 ${panelSize}명 · 시드 ${run.seeds.total}개 불러오기`
            : panelSize > 0
              ? `페르소나 ${panelSize}명 불러오기`
              : "페르소나 불러오기",
          state: "완료",
          status: "done",
        },
        {
          label: `브라우저 ${total}개 준비`,
          state: `${ready} / ${total}`,
          status: ready >= total && total > 0 ? "done" : "running",
        },
        { label: "첫 세션 시작", state: "다음", status: "next" },
      ]}
    />
  );
}

/* P10 분석 중 — 세션 종료 → 이탈 원인 분류 → 리포트 생성·범위 계산 (끝나면 리포트로 자동 이동) */
export function AnalyzingChecklist({ run }: { run: PersonaRun }) {
  const step = run.analysis?.step ?? 1;
  const seeds = run.seeds?.total ?? 1;
  const causes = new Set(
    run.sessions.flatMap((session) => (session.issue ? [session.issue.category] : [])),
  ).size;
  const stateOf = (index: number): CheckState =>
    index < step - 1 ? "done" : index === step - 1 ? "running" : "next";
  const label = (status: CheckState) =>
    status === "done" ? "완료" : status === "running" ? "진행 중" : "다음";

  const steps = [
    /* 제품 API 세션 목록에는 모든 시드의 세션이 들어 있고 원인 분류 값이 없습니다 */
    run.seeds
      ? `세션 ${run.sessions.length * seeds}개 종료 (시드 ${seeds}회)`
      : `세션 ${run.sessions.length}개 종료`,
    causes > 0 ? `이탈 원인 ${causes}종 분류` : "이탈 원인 분류",
    "리포트 생성 · 범위 계산",
  ].map((text, index) => ({ label: text, state: label(stateOf(index)), status: stateOf(index) }));

  return <PhaseChecklist label="결과 분석" steps={steps} />;
}

/* 이미 끝난 실행을 열었을 때 — 결과를 요약하고 리포트로 연결 (분석 화면을 보던 중이면 자동 이동) */
export function RunCompleted({
  run,
  projectId,
  partial = false,
}: {
  run: PersonaRun;
  projectId: string;
  /* 제품 API partially_completed — 일부 세션만 끝난 부분 결과 (임시 문구) */
  partial?: boolean;
}) {
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
        {partial && <p className="text-caption text-subtle">일부 세션만 끝난 부분 결과예요</p>}
      </div>
      {run.id && (
        <Link to={buildPath("report", { projectId, runId: run.id })} className={buttonVariants()}>
          리포트 보기
        </Link>
      )}
    </section>
  );
}

/* E05 실행 실패 — 모든 세션이 기술 실패로 끝남 (다시 시도 · 설정 수정은 새 테스트에서) */
export function RunFailed({
  run,
  projectId,
  message,
}: {
  run: PersonaRun;
  projectId: string;
  /* 제품 API 실행 오류(run.error.message). 있으면 세션 사유 대신 보여 줍니다 */
  message?: string | null;
}) {
  const summary = failureSummary(run.sessions);
  return (
    <section
      aria-labelledby="run-failed-title"
      className="flex flex-col items-center gap-2 py-16 text-center"
    >
      <img src={characterCry} alt="" className="mb-10 h-40 w-auto" />
      <h2 id="run-failed-title" className="text-lg font-bold text-ink">
        실행을 끝내지 못했어요
      </h2>
      <p className="text-sm text-subtle">
        {message || summary.reason} · 끝난 세션 {summary.finishedNormally} / {summary.total}
      </p>
      <Link
        to={buildPath("newTest", { projectId })}
        className={cn(buttonVariants({ variant: "secondary" }), "mt-4")}
      >
        <Icon name="retry" />
        다시 시도
      </Link>
      {/*
        임시: 지난 실행의 입력을 되살리는 API 가 없어 "설정 수정"도 새 테스트 첫 단계로 갑니다.
        (위저드는 들어올 때 입력을 비워 ?step=confirm 으로 보내도 사이트 단계가 됩니다)
      */}
      <Link
        to={buildPath("newTest", { projectId })}
        className={buttonVariants({ variant: "link" })}
      >
        설정 수정
      </Link>
    </section>
  );
}

/* 제품 API: 중지한 실행 (임시 문구 — Figma 확인 필요). 끝난 세션까지의 리포트가 있으면 연결합니다 */
export function RunCancelled({
  projectId,
  reportRunId,
}: {
  projectId: string;
  reportRunId: string | null;
}) {
  return (
    <section
      aria-labelledby="run-cancelled-title"
      className="flex items-center justify-between gap-6 rounded-xl bg-gray-50 p-6"
    >
      <div className="flex flex-col gap-2">
        <h2 id="run-cancelled-title" className="text-lg font-bold text-ink">
          테스트를 중지했어요
        </h2>
        <p className="text-sm text-subtle">끝난 세션까지만 기록돼요</p>
      </div>
      <div className="flex gap-2">
        {reportRunId && (
          <Link
            to={buildPath("report", { projectId, runId: reportRunId })}
            className={buttonVariants()}
          >
            리포트 보기
          </Link>
        )}
        <Link
          to={buildPath("newTest", { projectId })}
          className={buttonVariants({ variant: "secondary" })}
        >
          새 테스트 시작하기
        </Link>
      </div>
    </section>
  );
}
