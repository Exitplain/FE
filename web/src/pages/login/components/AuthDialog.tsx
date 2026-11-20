import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { useDemoSessionStore } from "@/stores/useDemoSessionStore";

import LoginPanel from "./LoginPanel";
import SessionExpiredCard from "./SessionExpiredCard";

import "../login.css";

/* 네이티브 dialog가 뒤 화면 차단·Tab 초점 가두기를 담당합니다. 페이지 URL은 변경하지 않습니다. */
function DialogContent({ expired }: { expired: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const close = useDemoSessionStore((state) => state.closeDialog);
  const openLogin = useDemoSessionStore((state) => state.openLogin);

  useEffect(() => {
    const dialog = ref.current;
    const previousFocus = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
      previousFocus?.focus();
    };
  }, []);

  return createPortal(
    <dialog
      ref={ref}
      className="auth-dialog"
      aria-label={expired ? "세션 만료" : "로그인 또는 회원가입"}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        )
          close();
      }}
    >
      {expired ? (
        <SessionExpiredCard onLogin={openLogin} />
      ) : (
        <LoginPanel mode="dialog" onClose={close} />
      )}
    </dialog>,
    document.body,
  );
}

export default function AuthDialog() {
  const dialog = useDemoSessionStore((state) => state.dialog);
  return dialog ? <DialogContent key={dialog} expired={dialog === "expired"} /> : null;
}
