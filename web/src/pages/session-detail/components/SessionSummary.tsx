import Icon from "@/components/Icon/Icon";
import { STAGE_LABELS } from "@/constants/persona";
import type { PersonaSession } from "@/types/persona.type";
import { cn } from "@/utils/cn";

import { evidenceQuote, sessionKpis, stageFlow, type StepRow } from "../utils/sessionView";

import FrustrationChart from "./FrustrationChart";
import StageFlow from "./StageFlow";

const RECENT = 3;

/*
  Figma P15(이탈) · P16(완료) 요약 탭.
  위: KPI 4칸 / 왼쪽: 근거 발화 · 단계 흐름 · 좌절 점수 변화 / 오른쪽: 최근 스텝
  질문하기는 BE 세션 질문 API(POST /api/v1/sessions/{id}/questions)가 아직 없어 숨깁니다.
*/
export default function SessionSummary({
  session,
  steps,
  onShowTimeline,
}: {
  session: PersonaSession;
  steps: StepRow[];
  onShowTimeline: () => void;
}) {
  const kpis = sessionKpis(session);
  const quote = evidenceQuote(session);
  const dropout = session.status === "simulated_dropout";
  const recent = steps.slice(-RECENT);

  return (
    <div className="flex flex-col gap-8">
      <dl className="grid grid-cols-4">
        {kpis.map((kpi, index) => (
          <div
            key={kpi.label}
            className={cn(
              "flex flex-col gap-2 px-6",
              index === 0 ? "pl-0" : "border-l border-line",
            )}
          >
            <dt className="text-xs text-subtle">{kpi.label}</dt>
            <dd className={cn("font-bold text-ink", kpi.emphasis ? "text-2xl" : "pt-3 text-lg")}>
              {kpi.value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 flex flex-col gap-8">
          {quote && (
            <figure className="flex flex-col gap-1">
              <figcaption className="text-xs text-subtle">근거 발화</figcaption>
              <blockquote className="text-sm font-bold text-ink">“{quote}”</blockquote>
            </figure>
          )}
          {session.status === "success" &&
            session.trace.some((point) => point.stage === "checkout") && (
              <p className="text-xs text-subtle">결제 정보는 도달까지만 기록해요 (실결제 금지)</p>
            )}
          <StageFlow
            title={dropout ? "어디서 흐름이 끊겼나요?" : "지나온 단계"}
            stages={stageFlow(session)}
          />
          {steps.length > 0 && <FrustrationChart steps={steps} />}
        </div>

        <aside className="flex flex-col gap-10">
          <section aria-labelledby="recent-steps-title" className="flex flex-col gap-2">
            <h2 id="recent-steps-title" className="text-lg font-bold text-ink">
              최근 스텝
            </h2>
            <ol className="flex flex-col">
              {recent.map((row) => (
                <li
                  key={row.step}
                  className="flex flex-col gap-1 border-b border-line py-3 text-caption"
                >
                  <p className="flex items-center gap-2">
                    <span className="flex-1 font-bold text-ink">
                      스텝 {row.step} · {STAGE_LABELS[row.stage]}
                    </span>
                    {row.exit && (
                      <Icon name="status-exit" className="size-4 text-danger" label="이탈" />
                    )}
                    <span className={cn("text-ink", row.exit && "font-bold")}>
                      좌절 {row.score}
                    </span>
                  </p>
                  {row.action && <p className="text-xs text-subtle">{row.action}</p>}
                  {row.utterance && <p className="text-xs text-ink">“{row.utterance}”</p>}
                </li>
              ))}
            </ol>
            <button
              type="button"
              onClick={onShowTimeline}
              className="self-start text-caption font-bold text-ink underline underline-offset-4"
            >
              스텝 {steps.length}개 전체 보기
            </button>
          </section>
        </aside>
      </div>
    </div>
  );
}
