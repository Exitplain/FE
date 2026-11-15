import { Link } from "react-router-dom";

import characterCry from "@/assets/characters/character-cry.svg";
import { buttonVariants } from "@/components/Button/buttonVariants";
import Icon from "@/components/Icon/Icon";
import type { IconName } from "@/components/Icon/iconNames";
import { buildPath } from "@/constants/routes";
import type { PersonaRun } from "@/types/persona.type";
import { cn } from "@/utils/cn";

import { countSessions, failureSummary, formatTokens } from "../utils/runView";

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
  const seeds = run.seeds?.total ?? 1;

  return (
    <PhaseChecklist
      label="실행 준비"
      steps={[
        {
          label: `페르소나 ${panelSize}명 · 시드 ${seeds}개 불러오기`,
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
    `세션 ${run.sessions.length * seeds}개 종료 (시드 ${seeds}회)`,
    `이탈 원인 ${Math.max(causes, 1)}종 분류`,
    "리포트 생성 · 범위 계산",
  ].map((text, index) => ({ label: text, state: label(stateOf(index)), status: stateOf(index) }));

  return <PhaseChecklist label="결과 분석" steps={steps} />;
}

/* 이미 끝난 실행을 열었을 때 — 결과를 요약하고 리포트로 연결 (분석 화면을 보던 중이면 자동 이동) */
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

/* E05 실행 실패 — 모든 세션이 기술 실패로 끝남 (다시 시도 · 설정 수정은 새 테스트에서) */
export function RunFailed({ run, projectId }: { run: PersonaRun; projectId: string }) {
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
        {summary.reason} · 끝난 세션 {summary.finishedNormally} / {summary.total}
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

/* E12 비용 상한 도달 — 멈춘 시점과 부분 결과 */
export function RunStopped({ run, projectId }: { run: PersonaRun; projectId: string }) {
  const stopped = run.stopped!;
  const seeds = run.seeds?.total ?? 3;
  const rows = [
    [
      "끝난 세션",
      `${stopped.finished} / ${stopped.total} (${
        stopped.seed > 1 ? `시드 ${stopped.seed - 1} 전체 + ` : ""
      }시드 ${stopped.seed} 일부)`,
    ],
    [
      "쓴 비용",
      `상한 ${Math.round(stopped.cost_ratio * 100)}% · 토큰 ${formatTokens(stopped.tokens)}`,
    ],
    ["결과", `범위 계산에 시드 ${seeds}회가 필요해 부분 결과만 볼 수 있어요`],
  ];
  return (
    <div className="flex flex-col gap-12">
      <p
        role="alert"
        className="flex items-center gap-2 rounded-lg bg-gray-50 p-3 text-caption font-bold text-ink"
      >
        <Icon name="status-error" className="size-5 text-danger" />
        실행당 LLM 비용 상한에 닿아 시드 {stopped.seed} / {seeds}에서 멈췄어요
      </p>
      <section aria-labelledby="run-stopped-title" className="flex flex-col gap-4">
        <h2 id="run-stopped-title" className="text-lg font-bold text-ink">
          멈춘 시점
        </h2>
        <dl className="flex flex-col">
          {rows.map(([label, value]) => (
            <div
              key={label}
              className="flex justify-between gap-6 border-b border-line py-3 text-caption last:border-b-0"
            >
              <dt className="text-subtle">{label}</dt>
              <dd className="text-right text-ink">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="flex justify-end gap-2">
          <Link to={buildPath("settings")} className={buttonVariants({ variant: "secondary" })}>
            상한 확인
          </Link>
          {run.id && (
            <Link
              to={buildPath("report", { projectId, runId: run.id })}
              className={buttonVariants()}
            >
              부분 리포트 보기
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}
