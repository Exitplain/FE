import { useEffect, useState } from "react";

import Icon from "@/components/Icon/Icon";
import { STAGE_LABELS } from "@/constants/persona";
import { cn } from "@/utils/cn";

import { stepAnchor, type StepRow } from "../utils/sessionView";

import StepThumb from "./StepThumb";

const INITIAL = 3;

/*
  Figma P15c 스텝 타임라인 — 처음에는 최근 3스텝, "이전 스텝 더 보기"로 전부 펼칩니다.
  질문 탭의 "근거: 스텝 n" 으로 들어오면(focusStep) 전부 펼치고 그 스텝으로 스크롤합니다.
*/
export default function StepTimeline({
  steps,
  focusStep,
  onOpenScreen,
}: {
  steps: StepRow[];
  focusStep: number | null;
  onOpenScreen: (step: StepRow) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const focusHidden =
    focusStep != null && steps.findIndex((row) => row.step === focusStep) < steps.length - INITIAL;
  const showAll = expanded || focusHidden;
  const visible = showAll ? steps : steps.slice(-INITIAL);

  /* 근거 링크로 들어오면 누른 버튼이 사라지므로 그 스텝으로 포커스를 옮깁니다 (키보드·스크린 리더) */
  useEffect(() => {
    if (focusStep == null) return;
    const target = document.getElementById(stepAnchor(focusStep));
    target?.scrollIntoView?.({ block: "center" });
    target?.focus({ preventScroll: true });
  }, [focusStep]);

  return (
    <section aria-labelledby="timeline-title" className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h2 id="timeline-title" className="text-lg font-bold text-ink">
          스텝 타임라인
        </h2>
        <p className="text-xs text-muted">
          총 {steps.length}스텝{showAll ? "" : ` · 최근 ${visible.length}개 표시`}
        </p>
      </div>

      <ol aria-label="스텝" className="flex flex-col">
        {visible.map((row) => (
          <li
            key={row.step}
            id={stepAnchor(row.step)}
            aria-current={row.step === focusStep ? "step" : undefined}
            tabIndex={row.step === focusStep ? -1 : undefined}
            className={cn(
              "flex gap-4 border-b border-line py-3 last:border-b-0",
              row.step === focusStep && "bg-gray-50",
            )}
          >
            <button
              type="button"
              aria-label={`스텝 ${row.step} 화면 크게 보기`}
              onClick={() => onOpenScreen(row)}
              className="shrink-0 rounded-lg"
            >
              <StepThumb step={row} />
            </button>
            <div className="flex flex-1 flex-col gap-1 text-caption">
              <p className="flex items-center gap-2">
                <span className="font-bold text-ink">스텝 {row.step}</span>
                <span className="text-subtle">· {STAGE_LABELS[row.stage]}</span>
                {row.exit && (
                  <span className="flex items-center gap-1 font-bold text-ink">
                    <Icon name="status-exit" className="size-4 text-danger" />
                    이탈
                  </span>
                )}
              </p>
              {row.action && <p className="text-ink">{row.action}</p>}
              {row.utterance && (
                <p className={cn("text-ink", row.exit && "font-bold")}>“{row.utterance}”</p>
              )}
              {row.exit && <p className="text-xs text-muted">진한 박스 = 문제가 된 요소 위치</p>}
            </div>
            <p className="flex flex-col items-end text-xs text-muted">
              좌절
              <span className="text-base font-bold text-ink">{row.score}</span>
            </p>
          </li>
        ))}
      </ol>

      {!showAll && steps.length > INITIAL && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex items-center gap-1 self-center text-caption font-bold text-ink"
        >
          이전 스텝 더 보기
          <Icon name="chevron-right" />
        </button>
      )}
    </section>
  );
}
