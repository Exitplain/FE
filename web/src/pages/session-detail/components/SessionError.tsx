import Icon from "@/components/Icon/Icon";
import { STAGE_LABELS } from "@/constants/persona";
import type { PersonaSession } from "@/types/persona.type";

import type { StepRow } from "../utils/sessionView";

const LAST_RECORDS = 2;

/* 기술 오류 종류별 안내 (BE runs.Session 기술 상태 5종) */
const ERROR_MESSAGES: Partial<Record<PersonaSession["status"], string>> = {
  agent_failure: "브라우저가 30초 동안 응답하지 않아 방문을 끝냈어요",
  budget_exceeded: "실행당 비용 상한에 닿아 방문을 멈췄어요",
  site_failure: "사이트에 접속하지 못해 방문을 끝냈어요",
  blocked_auth: "로그인 단계에서 막혀 방문을 끝냈어요",
  cancelled: "실행을 중지해 방문이 끝났어요",
};

/*
  Figma E06 세션 오류 — 기술 오류로 끝난 세션. 탭 없이 오류 안내와 멈추기 전 기록만 보여줍니다.
  임시: 오류 문구는 Figma 예시("브라우저가 30초 동안 응답하지 않아…")이고, 서버가 준 사유는 아래에 함께 씁니다.
*/
export default function SessionError({
  session,
  steps,
}: {
  session: PersonaSession;
  steps: StepRow[];
}) {
  const records = steps.slice(-LAST_RECORDS);
  /* 응답 없이 멈춘 경우(실행 오류)만 마지막 기록에 "응답 없음" 을 붙입니다 */
  const noResponse = session.status === "agent_failure";

  return (
    <div className="flex flex-col gap-10">
      <section
        aria-labelledby="session-error-title"
        className="flex flex-col gap-4 rounded-xl bg-gray-50 p-6"
      >
        <h2 id="session-error-title" className="text-base font-bold text-ink">
          방문 오류
        </h2>
        <p className="flex items-center gap-2 pl-2 text-caption font-bold text-ink">
          <Icon name="status-error" className="size-5 text-danger" />
          {ERROR_MESSAGES[session.status] ?? ERROR_MESSAGES.agent_failure}
        </p>
        {session.reason && <p className="pl-9 text-xs text-muted">기록된 사유: {session.reason}</p>}
        <p className="text-caption text-subtle">기술 오류라 이탈률·원인 계산에서 빠져요</p>
      </section>

      {records.length > 0 && (
        <section aria-labelledby="before-stop-title" className="flex flex-col gap-2">
          <h2 id="before-stop-title" className="text-lg font-bold text-ink">
            멈추기 전 기록
          </h2>
          <ul className="flex flex-col">
            {records.map((row, index) => {
              const last = index === records.length - 1;
              return (
                <li
                  key={row.step}
                  className="flex gap-4 border-b border-line py-3 text-caption last:border-b-0"
                >
                  <span className="font-bold text-ink">스텝 {row.step}</span>
                  <span className="text-subtle">{STAGE_LABELS[row.stage]}</span>
                  <span className="text-ink">
                    {row.action ?? "기록 없음"}
                    {last && noResponse ? " → 응답 없음" : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
