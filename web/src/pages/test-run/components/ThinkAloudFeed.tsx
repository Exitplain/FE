import type { PersonaSession } from "@/types/persona.type";

import { formatClock, lastUtterance, sessionCode, STAGE_LABELS } from "../utils/runView";

const FEED_LIMIT = 8;

/*
  Figma P08~P10 오른쪽 `Card/ThinkAloudStream` — 세션별 마지막 발화를 최신순으로.
  이탈로 끝난 세션은 "이탈 · 좌절 점수 n" 을 빨간 글자로 덧붙입니다.
  임시: 발화(utterances)는 mock 만 주고, BE 개발 서버는 아직 발화를 만들지 않아 행동 기록으로 대신합니다.
*/
export default function ThinkAloudFeed({ sessions }: { sessions: PersonaSession[] }) {
  const items = sessions
    .flatMap((session) => {
      const said = lastUtterance(session);
      if (said)
        return [{ session, step: said.step, stage: said.stage, text: said.text, at: said.at }];
      const event = session.events.at(-1);
      return event
        ? [
            {
              session,
              step: event.step,
              stage: session.terminal_stage,
              text: event.description,
              at: "",
            },
          ]
        : [];
    })
    .sort((a, b) => b.at.localeCompare(a.at) || b.step - a.step)
    .slice(0, FEED_LIMIT);

  return (
    <section aria-labelledby="think-aloud-title" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 id="think-aloud-title" className="text-base font-bold text-ink">
          Think-aloud
        </h2>
        <span className="text-xs text-muted">
          {items.length > 0 ? "실시간 · 최신순" : "대기 중"}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="flex flex-col items-center gap-2 rounded-xl bg-gray-50 p-6 text-center text-caption text-subtle">
          <span aria-hidden className="font-bold text-ink">
            ···
          </span>
          세션이 시작되면 페르소나의 발화가 여기에 나타나요
        </p>
      ) : (
        <ul aria-label="발화" className="flex flex-col">
          {items.map(({ session, stage, text, at }) => {
            const last = session.trace.at(-1);
            return (
              <li
                key={session.id}
                className="flex flex-col gap-1 border-b border-line py-3 last:border-b-0"
              >
                <p className="flex items-baseline justify-between gap-2 text-caption">
                  <span>
                    <span className="font-bold text-ink">{sessionCode(session)}</span>
                    {stage && <span className="text-subtle"> · {STAGE_LABELS[stage]}</span>}
                  </span>
                  <span className="text-xs text-muted">{formatClock(at)}</span>
                </p>
                <p className="text-sm text-gray-800">“{text}”</p>
                {session.status === "simulated_dropout" && last && (
                  <p className="text-xs font-bold text-danger">이탈 · 좌절 점수 {last.score}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
