import type { ReactNode } from "react";

import Icon from "@/components/Icon/Icon";
import type { IconName } from "@/components/Icon/iconNames";
import { cn } from "@/utils/cn";

type EmptyStateProps = {
  icon: IconName;
  title: string;
  description?: ReactNode;
  /* 다음 행동 버튼 (예: <Button>새 테스트 시작하기</Button>) */
  action?: ReactNode;
  headingLevel?: 2 | 3;
  className?: string;
};

/*
  Figma `EmptyState` (E02 사전 테스트 없음 등) — 흰 카드 안에 48px 아이콘 원, 18px 제목, 14px 설명, 버튼.
  카드 뒤 메쉬 띠(Band/MeshEmpty)는 화면마다 달라 각 화면에서 감쌉니다.
*/
export default function EmptyState({
  icon,
  title,
  description,
  action,
  headingLevel = 2,
  className,
}: EmptyStateProps) {
  const Heading = headingLevel === 2 ? "h2" : "h3";

  return (
    <section
      className={cn(
        "flex flex-col items-start gap-6 rounded-xl bg-surface px-10 pt-10 pb-8 shadow-sm",
        className,
      )}
    >
      <div className="flex flex-col items-start gap-4">
        <span className="flex size-12 items-center justify-center rounded-full bg-gray-50">
          <Icon name={icon} className="size-5" />
        </span>
        <Heading className="text-lg font-bold text-ink">{title}</Heading>
        {description != null && <p className="text-sm text-subtle">{description}</p>}
      </div>
      {action}
    </section>
  );
}
