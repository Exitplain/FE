import { create } from "zustand";

import { type ConnectionStatus, PROJECT_CONNECTION } from "./analyticsMock";

/*
  임시: 실측 분석 화면 상태. 설치(R01~R04)는 실제 API(measurement)를 쓰고,
  단계 매핑(R05)을 저장한 프로젝트만 여기서 기억해 퍼널·비교(mock) 화면을 보여줍니다. 새로고침하면 처음 상태로 돌아갑니다.
*/
type AnalyticsMockState = {
  connected: Record<string, ConnectionStatus>;
  connect: (projectId: string) => void;
};

export const useAnalyticsMockStore = create<AnalyticsMockState>()((set) => ({
  connected: {},
  connect: (projectId) =>
    set((state) => ({ connected: { ...state.connected, [projectId]: "collecting" } })),
}));

export function useConnectionStatus(projectId: string): ConnectionStatus {
  const connected = useAnalyticsMockStore((state) => state.connected[projectId]);
  return PROJECT_CONNECTION[projectId] ?? connected ?? "unconnected";
}
