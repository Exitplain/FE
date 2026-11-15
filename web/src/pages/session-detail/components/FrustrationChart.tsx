import { useState } from "react";

import { cn } from "@/utils/cn";

import type { StepRow } from "../utils/sessionView";

/* 계산식 항목 — 초기 가설 모형(frustration-v2)의 더하고 빼는 값 */
const TERMS = [
  ["입력", "필수 입력 칸이 허용치보다 많으면 더해요"],
  ["재방문", "같은 화면으로 다시 돌아오면 더해요"],
  ["탐색", "다음 단계로 가는 길을 찾지 못하면 더해요"],
  ["비용", "예상하지 못한 비용을 보면 더해요"],
  ["진전", "다음 단계로 넘어가면 빼요"],
] as const;

/*
  Figma P15·P16 "좌절 점수 변화" — 스텝별 세로 막대 + 빨간 임계선.
  임계치를 넘은 막대만 진하게 칠합니다. 막대 높이는 점수 비율이라 style 로 둡니다.
*/
export default function FrustrationChart({ steps }: { steps: StepRow[] }) {
  const [open, setOpen] = useState(false);
  const threshold = steps.at(-1)?.threshold ?? 0;
  /* 가장 높은 막대도 위에 점수 글자가 들어가도록 여유를 둡니다 */
  const scale = Math.max(threshold * 1.15, ...steps.map((step) => step.score * 1.15), 1);
  const linePercent = (threshold / scale) * 100;

  return (
    <section aria-labelledby="frustration-title" className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h2 id="frustration-title" className="text-lg font-bold text-ink">
          좌절 점수 변화
        </h2>
        <p className="text-xs text-muted">임계치 {threshold}</p>
      </div>

      <ol aria-label="스텝별 좌절 점수" className="flex">
        {steps.map((step) => {
          const over = step.score > threshold;
          return (
            <li key={step.step} className="flex flex-1 flex-col items-center gap-2">
              <div className="relative flex h-48 w-full flex-col items-center justify-end px-1">
                <span
                  aria-hidden
                  className="absolute inset-x-0 border-t border-danger"
                  style={{ bottom: `${linePercent}%` }}
                />
                <span className="text-xs font-bold text-ink">
                  <span className="sr-only">스텝 {step.step} 좌절 점수 </span>
                  {step.score}
                  {over && <span className="sr-only"> (임계치 초과)</span>}
                </span>
                <span
                  aria-hidden
                  data-over={over || undefined}
                  className={cn("w-full max-w-10 rounded-t", over ? "bg-ink" : "bg-gray-300")}
                  style={{ height: `${(step.score / scale) * 100}%` }}
                />
              </div>
              <span aria-hidden className="text-xs text-muted">
                {step.step}
              </span>
            </li>
          );
        })}
      </ol>

      <p className="text-xs text-muted">
        점수 = 이전 점수 × 0.85 + 입력 + 재방문 + 탐색 + 비용 − 진전
      </p>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="self-start text-caption font-bold text-ink underline underline-offset-4"
      >
        {open ? "계산 근거 접기" : "계산 근거 더 보기"}
      </button>
      {open && (
        <dl className="grid grid-cols-4 gap-x-4 gap-y-2 rounded-lg bg-gray-50 p-4 text-caption">
          {TERMS.map(([term, description]) => (
            <div key={term} className="col-span-2 flex gap-2">
              <dt className="font-bold text-ink">{term}</dt>
              <dd className="text-subtle">{description}</dd>
            </div>
          ))}
          <div className="col-span-4 flex gap-2">
            <dt className="font-bold text-ink">임계치</dt>
            <dd className="text-subtle">허용 필수 입력 칸 × 16 (초기 가설 · 보정하면 바뀌어요)</dd>
          </div>
        </dl>
      )}
    </section>
  );
}
