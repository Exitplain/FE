import type { ReactNode } from "react";

import cry from "@/assets/characters/character-cry.svg";
import exclamation from "@/assets/characters/character-exclamation.svg";
import question from "@/assets/characters/character-question.svg";
import Button from "@/components/Button/Button";

const IMAGES = { error: cry, empty: question, notice: exclamation } as const;

export default function WorkspaceState({
  kind,
  title,
  description,
  action,
}: {
  /* notice: 할 일이 남은 빈 상태 (예: E15 비교할 테스트 부족, 느낌표 캐릭터) */
  kind: "loading" | "error" | "empty" | "notice";
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  if (kind === "loading")
    return (
      <section role="status" aria-label={title} className="space-y-8 pt-6">
        <div className="grid grid-cols-3 gap-8 rounded-2xl bg-gray-50 p-6">
          {[0, 1, 2].map((n) => (
            <div key={n} className="space-y-4 motion-safe:animate-pulse">
              <div className="h-3 w-24 rounded bg-gray-200" />
              <div className="h-8 w-16 rounded bg-gray-200" />
              <div className="h-3 w-32 rounded bg-gray-200" />
            </div>
          ))}
        </div>
        {[0, 1, 2].map((n) => (
          <div
            key={n}
            className="grid grid-cols-3 gap-10 border-b border-line py-5 motion-safe:animate-pulse"
          >
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-4 rounded bg-gray-200" />
            ))}
          </div>
        ))}
        <p className="text-xs text-muted">{title}</p>
      </section>
    );
  return (
    <section className="flex min-h-140 flex-col items-center justify-center gap-6 text-center">
      <img src={IMAGES[kind]} alt="" className="max-w-full" />
      <div className="space-y-3">
        <h2 className="text-lg font-bold">{title}</h2>
        {description && <p className="text-sm text-subtle">{description}</p>}
      </div>
      {action}
    </section>
  );
}

export function WorkspaceRetry({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="secondary" icon="retry" onClick={onClick}>
      다시 시도
    </Button>
  );
}
