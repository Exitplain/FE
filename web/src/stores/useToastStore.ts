import { create } from "zustand";

import type { IconName } from "@/components/Icon/iconNames";

/* 자동으로 사라질 때까지의 시간 */
export const TOAST_DURATION_MS = 3000;

export type Toast = { id: number; message: string; icon: IconName };

type ToastState = {
  toasts: Toast[];
  /* 알림을 띄우고 id 를 돌려줍니다. 아이콘 기본값은 check (완료 알림) */
  show: (message: string, icon?: IconName) => number;
  dismiss: (id: number) => void;
};

let nextId = 0;
/* 직접 닫은 알림의 자동 닫기 타이머가 남지 않도록 id 별로 둡니다 */
const timers = new Map<number, ReturnType<typeof setTimeout>>();

/*
  화면 위쪽 가운데 짧은 알림 (Figma Toast/Copied·Applied·PdfGenerating·Registered).
  어느 화면에서든 useToastStore.getState().show("링크를 복사했어요") 처럼 부릅니다.
  표시는 App 의 <ToastViewport /> 한 곳에서 합니다.
*/
export const useToastStore = create<ToastState>()((set, get) => ({
  toasts: [],
  show: (message, icon = "check") => {
    nextId += 1;
    const id = nextId;
    set({ toasts: [...get().toasts, { id, message, icon }] });
    timers.set(
      id,
      setTimeout(() => get().dismiss(id), TOAST_DURATION_MS),
    );
    return id;
  },
  dismiss: (id) => {
    clearTimeout(timers.get(id));
    timers.delete(id);
    set({ toasts: get().toasts.filter((toast) => toast.id !== id) });
  },
}));
