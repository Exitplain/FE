import { type KeyboardEvent, type ReactNode, useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

import IconButton from "@/components/IconButton/IconButton";
import { cn } from "@/utils/cn";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  /* 오른쪽 아래 버튼 영역 */
  footer?: ReactNode;
  /* md: 720 (P04 테스트 계정) · lg: 960 (P04 원격 브라우저) */
  size?: "md" | "lg";
};

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  'input:not([disabled]):not([type="hidden"])',
  "textarea:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

/* 열릴 때 처음 초점을 줄 입력 요소. 버튼보다 입력칸이 먼저입니다 */
const FIRST_FIELD =
  'input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), select:not([disabled])';

/*
  뒤 화면 잠금은 열린 모달 수로 관리합니다.
  모달마다 따로 저장·복원하면 중첩 모달이 닫히는 순서에 따라 잠금이 남을 수 있기 때문입니다.
  - 스크롤 잠금: body overflow
  - 뒤 화면 조작 막기: 앱 루트(#root)에 inert (모달은 body 로 포털하므로 영향 없음)
*/
let openCount = 0;
let savedOverflow = "";

function lockPage() {
  if (openCount === 0) {
    savedOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.getElementById("root")?.setAttribute("inert", "");
  }
  openCount += 1;
}

function unlockPage() {
  openCount = Math.max(0, openCount - 1);
  if (openCount === 0) {
    document.body.style.overflow = savedOverflow;
    document.getElementById("root")?.removeAttribute("inert");
  }
}

/*
  Figma `Dialog/*` + `Overlay/Scrim` — 검정 40% 덮개 위 흰 카드(모서리 16, 그림자 dialog).
  - Escape · 닫기 버튼 · 덮개 클릭으로 닫습니다.
  - 열리면 첫 입력칸으로, 닫히면 열기 전 요소로 초점을 옮기고 Tab 초점은 대화상자 안에서만 돕니다.
  - 모달 안에 모달을 열면 Escape 는 위쪽 모달만 닫습니다(React 이벤트가 안쪽에서 먼저 처리되고 멈춤).
  - 알려진 한계: 모달 안 InfoTip 말풍선이 열린 채 Escape 를 누르면 말풍선과 모달이 함께 닫힙니다.

  사용 예
    <Modal open={open} onClose={() => setOpen(false)} title="테스트 계정 등록"
      description="계정 1개로 에이전트 1명이 로그인해요 · 최대 20개"
      footer={<Button onClick={save}>계정 저장</Button>}>
      ...
    </Modal>
*/
export default function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: ModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const pressedOnScrim = useRef(false);

  useEffect(() => {
    if (!open) return;

    const previous = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    /*
      안쪽 모달의 effect 가 먼저 실행돼 초점을 가져가므로,
      이미 다른 대화상자 안에 초점이 있으면 바깥 모달이 빼앗지 않습니다.
    */
    const focusInOtherDialog = previous?.closest('[aria-modal="true"]');
    if (!focusInOtherDialog) {
      (panel?.querySelector<HTMLElement>(FIRST_FIELD) ?? panel)?.focus();
    }

    lockPage();
    return () => {
      unlockPage();
      if (!focusInOtherDialog) previous?.focus();
    };
  }, [open]);

  if (!open) return null;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
      return;
    }

    if (event.key !== "Tab" || !panelRef.current) return;
    const items = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (items.length === 0) return;

    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === panelRef.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div
      data-testid="modal-scrim"
      className="fixed inset-0 z-50 flex justify-center overflow-y-auto bg-ink/40 p-6"
      /* 카드 안에서 누르고 덮개에서 뗀 경우는 닫지 않도록, 누른 곳과 뗀 곳이 모두 덮개일 때만 닫습니다 */
      onMouseDown={(event) => {
        pressedOnScrim.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        if (pressedOnScrim.current && event.target === event.currentTarget) onClose();
        pressedOnScrim.current = false;
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description != null ? descriptionId : undefined}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className={cn(
          /* my-auto: 화면보다 긴 모달도 위쪽이 잘리지 않고 스크롤되도록 (items-center 대신) */
          "relative my-auto flex w-full flex-col gap-8 rounded-2xl bg-surface pt-5 pr-8 pb-8 pl-6 shadow-dialog outline-none",
          size === "md" ? "max-w-3xl" : "max-w-5xl",
        )}
      >
        <div className="flex flex-col gap-3 pt-3 pr-12">
          <h2 id={titleId} className="text-lg font-bold text-ink">
            {title}
          </h2>
          {description != null && (
            <p id={descriptionId} className="text-caption text-subtle">
              {description}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-6">{children}</div>
        {footer != null && <div className="flex justify-end gap-2">{footer}</div>}
        {/* 화면에서는 오른쪽 위지만 Tab 순서는 내용 다음에 오도록 마지막에 둡니다 */}
        <IconButton
          icon="close"
          label="닫기"
          size="lg"
          onClick={onClose}
          className="absolute top-5 right-8"
        />
      </div>
    </div>,
    document.body,
  );
}
