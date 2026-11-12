import Icon from "@/components/Icon/Icon";
import { cn } from "@/utils/cn";

type StepperProps = {
  steps: readonly string[];
  /* 현재 단계 순서 (0부터) */
  current: number;
  className?: string;
};

/*
  Figma `Stepper/Wizard` (P02~P05c) — 지난 단계는 체크, 현재 단계는 회색 점 + 굵은 글자.
  단계 이동은 각 화면의 이전·다음 버튼과 P05c "변경" 링크로 하므로 여기서는 표시만 합니다.
  단계 사이 연결선은 두 번째 단계부터 각 항목 앞에 붙여 목록 항목 수가 단계 수와 같게 둡니다.
  현재 단계 숫자: Figma 는 회색(#737373) 위 검정 글자지만 대비가 4.5:1 에 못 미쳐 흰 글자로 둡니다.

  사용 예
    <Stepper steps={["사이트", "과업 · 타겟", "페르소나", "시작 전 확인"]} current={1} />
*/
export default function Stepper({ steps, current, className }: StepperProps) {
  return (
    <ol aria-label="진행 단계" className={cn("flex items-center gap-2", className)}>
      {steps.map((label, index) => {
        const state = index < current ? "done" : index === current ? "current" : "upcoming";

        return (
          <li
            // 단계 순서가 고정된 목록이라 순서를 key 로 씁니다 (같은 이름의 단계가 있어도 충돌하지 않게)
            key={index}
            aria-current={state === "current" ? "step" : undefined}
            className={cn("flex min-h-10 items-center gap-2", index > 0 && "flex-1")}
          >
            {index > 0 && <span aria-hidden className="h-px min-w-4 flex-1 bg-line" />}
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                state === "done" && "border border-gray-800 bg-surface",
                state === "current" && "bg-muted text-surface",
                state === "upcoming" && "border border-gray-300 bg-surface text-muted",
              )}
            >
              {state === "done" ? (
                <>
                  <Icon name="check" className="size-5" />
                  <span className="sr-only">완료</span>
                </>
              ) : (
                index + 1
              )}
            </span>
            <span
              className={cn(
                "shrink-0 text-sm",
                state === "current" && "font-bold text-ink",
                state === "done" && "text-ink",
                state === "upcoming" && "text-subtle",
              )}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
