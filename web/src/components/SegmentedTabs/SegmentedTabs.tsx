import { type KeyboardEvent, type ReactNode, useRef } from "react";

import { cn } from "@/utils/cn";

export type SegmentedOption<T extends string> = { value: T; label: ReactNode };

type SegmentedTabsProps<T extends string> = {
  /* 무엇을 고르는지 (스크린 리더용). 예: "기간", "리포트 영역" */
  label: string;
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
};

const NEXT_KEYS: Record<string, number> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
};

/*
  Figma 회색 바탕 세그먼트 — P12 리포트 영역 이동(요약·예측 퍼널…), R06 기간(최근 7일·14일·30일)·디바이스.
  하나만 고르는 선택이라 radiogroup 으로 둡니다. 화살표·Home·End 로 고르고, Tab 은 선택된 항목에만 멈춥니다.

  사용 예
    <SegmentedTabs label="기간" value={period} onChange={setPeriod}
      options={[{ value: "7", label: "최근 7일" }, { value: "14", label: "14일" }]} />
*/
export default function SegmentedTabs<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: SegmentedTabsProps<T>) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  /* value 가 목록에 없으면 아무것도 선택 표시하지 않고, Tab 은 첫 항목에 멈춥니다 */
  const selectedIndex = options.findIndex((option) => option.value === value);
  const tabStop = Math.max(0, selectedIndex);

  const select = (index: number) => {
    const option = options[(index + options.length) % options.length];
    onChange(option.value);
    buttons.current[options.indexOf(option)]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key in NEXT_KEYS) select(tabStop + NEXT_KEYS[event.key]);
    else if (event.key === "Home") select(0);
    else if (event.key === "End") select(options.length - 1);
    else return;
    event.preventDefault();
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn("inline-flex gap-1 rounded-xl bg-gray-100 p-1", className)}
    >
      {options.map((option, index) => {
        const selected = index === selectedIndex;
        return (
          <button
            key={option.value}
            ref={(element) => {
              buttons.current[index] = element;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={index === tabStop ? 0 : -1}
            onClick={() => onChange(option.value)}
            className={cn(
              "min-h-9 rounded-lg px-4 text-caption whitespace-nowrap transition-colors",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
              selected ? "bg-surface font-bold text-ink shadow-sm" : "text-subtle hover:text-ink",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
