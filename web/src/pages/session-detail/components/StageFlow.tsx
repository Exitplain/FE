import Icon from "@/components/Icon/Icon";
import { cn } from "@/utils/cn";

import type { FlowStage } from "../utils/sessionView";

/*
  Figma P15 "어디서 흐름이 끊겼나요?" · P16 "지나온 단계".
  지나온 단계는 진한 막대, 마지막 단계는 노란 막대에 이탈(빨간 아이콘) 또는 완료(체크) 표시.
*/
export default function StageFlow({ title, stages }: { title: string; stages: FlowStage[] }) {
  return (
    <section aria-labelledby="stage-flow-title" className="flex flex-col gap-4">
      <h2 id="stage-flow-title" className="text-lg font-bold text-ink">
        {title}
      </h2>
      <ol className="flex gap-2">
        {stages.map((stage) => {
          const last = stage.state !== "passed";
          return (
            <li key={stage.stage} className="flex flex-1 flex-col gap-2">
              <span
                aria-hidden
                className={cn(
                  "h-1.5 rounded-full",
                  last ? "border border-ink bg-highlight" : "bg-gray-700",
                )}
              />
              <span className="flex items-center justify-between gap-1">
                <span className="text-caption font-bold text-ink">{stage.label}</span>
                {stage.state === "exit" && (
                  <Icon name="status-exit" className="size-4 text-danger" label="이탈" />
                )}
                {stage.state === "done" && (
                  <Icon name="status-done" className="size-4" label="완료" />
                )}
              </span>
              {stage.note && <span className="text-xs text-muted">{stage.note}</span>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
