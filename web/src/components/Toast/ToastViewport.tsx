import { createPortal } from "react-dom";

import Icon from "@/components/Icon/Icon";
import { useToastStore } from "@/stores/useToastStore";

/*
  알림 표시 자리 (App 에 한 번만 둡니다).
  - body 로 포털하고 z-60 으로 모달(z-50) 위에 띄웁니다. 모달이 열리면 #root 에 inert 가 걸리기 때문입니다.
  - 알림 영역(role="status")은 항상 두어 스크린 리더가 새 알림을 읽게 합니다.
*/
export default function ToastViewport() {
  const toasts = useToastStore((state) => state.toasts);

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-6 z-60 flex flex-col items-center gap-2"
    >
      {toasts.map((toast) => (
        <p
          key={toast.id}
          className="flex items-center gap-2 rounded-lg border border-line bg-surface px-4 py-2.5 text-caption font-medium text-ink shadow-tooltip"
        >
          <Icon name={toast.icon} />
          {toast.message}
        </p>
      ))}
    </div>,
    document.body,
  );
}
