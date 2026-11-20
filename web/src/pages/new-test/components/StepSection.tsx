import type { ReactNode } from "react";

/* Figma `Section/*` — 18px 굵은 제목 + 13px 보조 설명 + 내용 (위저드 단계 공통) */
export default function StepSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-bold text-ink">{title}</h2>
      {description != null && <p className="text-caption text-subtle">{description}</p>}
      {children}
    </section>
  );
}

/* Figma `Row/FormFooter` — 오른쪽 정렬 이전·다음 버튼 */
export function StepFooter({ children }: { children: ReactNode }) {
  return <div className="flex items-center justify-end gap-4">{children}</div>;
}

/* Figma `Row/Status` — 연회색 상자 안 아이콘 + 굵은 한 줄 */
export function StatusRow({ children }: { children: ReactNode }) {
  return (
    <div role="status" className="flex items-center gap-2 rounded-lg bg-gray-50 p-3 text-caption">
      {children}
    </div>
  );
}
