import type { PersonaSession } from "@/types/persona.type";

import { STAGE_LABELS } from "../utils/runView";

const FEED_LIMIT = 8;

/*
  Figma P09 오른쪽 `Think-aloud` 자리.
  BE 는 발화(think-aloud)를 만들지 않아, 세션마다 마지막 행동 기록(규칙이 만든 짧은 설명)을 보여줍니다.
*/
export default function ActionFeed({ sessions }: { sessions: PersonaSession[] }) {
  const items = sessions
    .flatMap((session) => {
      const last = session.events.at(-1);
      return last ? [{ session, event: last }] : [];
    })
    .sort((a, b) => b.event.step - a.event.step)
    .slice(0, FEED_LIMIT);

  return (
    <section aria-labelledby="action-feed-title" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 id="action-feed-title" className="text-base font-bold text-ink">
          행동 기록
        </h2>
        <span className="text-xs text-muted">세션별 마지막 행동</span>
      </div>
      {items.length === 0 ? (
        <p className="rounded-xl bg-gray-50 p-6 text-center text-caption text-subtle">
          세션이 시작되면 페르소나의 행동이 여기에 나타나요
        </p>
      ) : (
        <ul className="flex flex-col">
          {items.map(({ session, event }) => (
            <li key={session.id} className="flex flex-col gap-1 border-b border-line py-3">
              <p className="flex items-baseline justify-between gap-2 text-caption">
                <span className="font-bold text-ink">
                  {session.name} · {session.task_name}
                </span>
                <span className="text-xs text-muted">스텝 {event.step}</span>
              </p>
              <p className="text-sm text-gray-800">{event.description}</p>
              {session.terminal_stage && (
                <p className="text-xs text-muted">{STAGE_LABELS[session.terminal_stage]}</p>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted">Think-aloud 발화는 서버가 지원하면 이 자리에 보여줘요</p>
    </section>
  );
}
