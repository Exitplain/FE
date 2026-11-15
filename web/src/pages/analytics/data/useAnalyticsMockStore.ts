import { create } from "zustand";

import { type ConnectionStatus, PROJECT_CONNECTION } from "./analyticsMock";

/*
  임시: 실측 분석 화면 상태 (API 없음). 연결 흐름(R01~R05)을 끝낸 프로젝트를 기억해
  화면을 오가도 연결된 것처럼 보여줍니다. 새로고침하면 처음 상태로 돌아갑니다.
*/
type AnalyticsMockState = {
  connected: Record<string, ConnectionStatus>;
  /* 설치 확인을 한 번 실패한 프로젝트 (R04 → 다시 확인하면 성공) */
  failedOnce: Record<string, boolean>;
  connect: (projectId: string) => void;
  markFailed: (projectId: string) => void;
};

export const useAnalyticsMockStore = create<AnalyticsMockState>()((set) => ({
  connected: {},
  failedOnce: {},
  connect: (projectId) =>
    set((state) => ({ connected: { ...state.connected, [projectId]: "collecting" } })),
  markFailed: (projectId) =>
    set((state) => ({ failedOnce: { ...state.failedOnce, [projectId]: true } })),
}));

export function useConnectionStatus(projectId: string): ConnectionStatus {
  const connected = useAnalyticsMockStore((state) => state.connected[projectId]);
  return PROJECT_CONNECTION[projectId] ?? connected ?? "unconnected";
}
