import { type ReactNode, useId } from "react";

import InfoTip from "@/components/InfoTip/InfoTip";

type ReportSectionProps = {
  /* 섹션 이동 탭이 찾아갈 id */
  id: string;
  title: string;
  /* 제목 옆 정보 말풍선 (P12d) */
  info?: string;
  /* 제목 오른쪽 작은 글 (예: "랜딩 대비 도달 비율") */
  aside?: ReactNode;
  children: ReactNode;
};

/* P12 각 영역: 제목(+정보) · 오른쪽 보조 글 · 내용. scroll-mt 는 섹션 이동 시 위쪽 여유 */
export default function ReportSection({ id, title, info, aside, children }: ReportSectionProps) {
  const headingId = useId();
  return (
    <section id={id} aria-labelledby={headingId} className="flex scroll-mt-8 flex-col gap-5">
      <div className="flex items-center gap-2">
        <h2 id={headingId} className="text-lg font-bold text-ink">
          {title}
        </h2>
        {info && <InfoTip text={info} />}
        {aside != null && <div className="ml-auto text-xs text-muted">{aside}</div>}
      </div>
      {children}
    </section>
  );
}
