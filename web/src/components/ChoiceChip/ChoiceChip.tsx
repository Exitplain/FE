import { cva } from "class-variance-authority";
import type { ComponentProps } from "react";

import Icon from "@/components/Icon/Icon";
import { cn } from "@/utils/cn";

/*
  Figma `Choice/*` — 고를 수 있는 pill (P05 과업·연령, P04 직접 입력/붙여넣기, P09 과업 탭).
  선택: 노란 바탕(highlight) + 검은 테두리 + 체크 + 굵은 글자 / 미선택: 연회색 바탕.
  md(40px, 14px) 가 기본이고 모달 안 작은 선택지는 sm(13px) 입니다.
*/
const chipVariants = cva(
  [
    "inline-flex shrink-0 items-center justify-center gap-2 rounded-full border whitespace-nowrap",
    "transition-colors select-none",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
    "disabled:cursor-not-allowed disabled:opacity-50",
  ],
  {
    variants: {
      selected: {
        true: "border-ink bg-highlight font-bold text-ink",
        false: "border-transparent bg-gray-50 text-gray-800",
      },
      size: {
        md: "min-h-10 px-4 text-sm",
        sm: "min-h-8 px-3 text-caption",
      },
    },
    defaultVariants: { size: "md" },
  },
);

type ChoiceChipProps = Omit<ComponentProps<"button">, "aria-pressed"> & {
  selected: boolean;
  size?: "md" | "sm";
  /*
    toggle: 여러 개 고르기 (연령, 과업) → aria-pressed
    radio: 하나만 고르기 (직접 입력/붙여넣기, P09 과업 전환) → role="radio" + aria-checked.
           감싸는 요소에 role="radiogroup" 과 aria-label 을 붙입니다.
  */
  kind?: "toggle" | "radio";
};

/*
  사용 예
    <ChoiceChip selected={ages.includes("30s")} onClick={() => toggle("30s")}>30대</ChoiceChip>
    <div role="radiogroup" aria-label="계정 입력 방식">
      <ChoiceChip kind="radio" selected={mode === "manual"} onClick={...}>직접 입력</ChoiceChip>
    </div>
*/
export default function ChoiceChip({
  selected,
  size,
  kind = "toggle",
  className,
  type = "button",
  children,
  ...props
}: ChoiceChipProps) {
  const stateProps =
    kind === "radio"
      ? ({ role: "radio", "aria-checked": selected } as const)
      : ({ "aria-pressed": selected } as const);

  return (
    <button
      type={type}
      {...stateProps}
      className={cn(chipVariants({ selected, size }), className)}
      {...props}
    >
      {selected && <Icon name="check" className={size === "sm" ? "size-4" : "size-5"} />}
      {children}
    </button>
  );
}
