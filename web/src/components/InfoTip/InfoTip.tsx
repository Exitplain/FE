import { useEffect, useId, useRef, useState } from "react";

import Icon from "@/components/Icon/Icon";
import { cn } from "@/utils/cn";

/*
  Figma `InfoTip` 컴포넌트 (233:10428) — 섹션 제목 옆 정보 아이콘.
  마우스를 올리거나 키보드로 포커스하면(모바일은 탭) 설명 말풍선이 열립니다.
  - 아이콘: info 16px, 기본 #737373 → 열림 #0a0a0a
  - 말풍선: 아이콘 아래 24px · 왼쪽 정렬 · 폭 264 · 여백 12 · 모서리 10 · 12px/18px

  열고 닫기는 CSS(hover · focus-within)로 하고, Escape 로 닫기만 상태로 처리합니다(WCAG 1.4.13).
  닫은 뒤에는 마우스가 나가거나 포커스가 빠지면 다시 열 수 있습니다.
  overflow:hidden 이나 transform 이 있는 부모 안에 두면 말풍선이 잘리거나 가려질 수 있습니다.

  사용 예: <div className="flex items-center gap-2"><h2>실측 퍼널</h2><InfoTip text="..." /></div>
  (h2 안에 넣으면 말풍선 글이 제목 텍스트에 섞여 읽힙니다)
*/
type InfoTipProps = {
  /* 말풍선 문구 (Figma `설명` 속성) */
  text: string;
  /* 화면 낭독기가 읽는 아이콘 버튼 이름 */
  label?: string;
  className?: string;
};

export default function InfoTip({ text, label = "설명 보기", className }: InfoTipProps) {
  const tooltipId = useId();
  const rootRef = useRef<HTMLSpanElement>(null);
  const [dismissed, setDismissed] = useState(false);

  /* 마우스만 올린 상태(포커스 없음)에서도 Escape 로 닫히도록 document 에서 받습니다 */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && rootRef.current?.matches(":hover, :focus-within")) {
        setDismissed(true);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <span
      ref={rootRef}
      data-dismissed={dismissed || undefined}
      /* 마우스·포커스가 모두 빠졌을 때만 닫힘을 풀어 다시 열 수 있게 합니다 */
      onMouseLeave={(event) => {
        if (!event.currentTarget.matches(":focus-within")) setDismissed(false);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.matches(":hover")) setDismissed(false);
      }}
      /* 이름 붙은 group: 바깥의 다른 .group(카드·행 등) hover 에 반응하지 않게 합니다 */
      className={cn("group/infotip relative inline-flex", className)}
    >
      <button
        type="button"
        aria-label={label}
        aria-describedby={tooltipId}
        /* Safari(iOS 포함)는 버튼을 눌러도 포커스를 주지 않아 탭으로 열리지 않으므로 직접 포커스합니다 */
        onClick={(event) => event.currentTarget.focus()}
        className="flex size-4 items-center justify-center rounded-full text-muted transition-colors group-focus-within/infotip:text-ink group-hover/infotip:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        <Icon name="info" />
      </button>

      {/*
        아이콘(16px) 바로 아래부터 pt-2(8px) 를 둬서 말풍선 시작이 아이콘 위 24px 이 됩니다.
        빈 틈 없이 이어져 있어 마우스를 말풍선으로 옮겨도 닫히지 않습니다.
      */}
      <span className="invisible absolute top-4 left-0 z-10 pt-2 opacity-0 transition-opacity group-focus-within/infotip:visible group-focus-within/infotip:opacity-100 group-hover/infotip:visible group-hover/infotip:opacity-100 group-data-dismissed/infotip:invisible group-data-dismissed/infotip:opacity-0">
        <span
          role="tooltip"
          id={tooltipId}
          className="block w-66 rounded-tooltip border border-line bg-surface p-3 text-left text-xs leading-4.5 font-normal whitespace-normal text-gray-800 shadow-tooltip"
        >
          {text}
        </span>
      </span>
    </span>
  );
}
