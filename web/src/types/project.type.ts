import type { WorkspaceProject, WorkspaceRunStatus } from "./workspace.type";

export type ProjectInput = { name: string; journey: string };
export type ProjectRecord = WorkspaceProject & {
  journey: string;
  lastTestStatus: WorkspaceRunStatus | null;
  /* 실측 연결 상태 (BE 가 주지 않으면 unconnected) */
  measurementStatus: "unconnected" | "waiting" | "connected";
  /* 적용 중인 보정 번호. 보정 전(기본 모형으로 되돌림 포함)이면 null */
  calibrationRevision: number | null;
  updatedLabel: string;
  isSample: boolean;
};

export type ProjectOverview = {
  phase: 1 | 2 | 3;
  connection: { startPath: string; expiresLabel: string } | null;
  test: {
    status: WorkspaceRunStatus | null;
    /* 마지막 사전 테스트 실행 id (진행 중이면 실행 화면, 끝났으면 리포트로 갑니다) */
    runId: string | null;
    title: string | null;
    prediction: [number, number] | null;
    maxDropOff: string | null;
    dateLabel: string | null;
  };
  analytics: {
    /* waiting: 키만 발급·수집 대기 · connected: 스크립트 수집이나 CSV 기록이 있음 */
    status: "unconnected" | "waiting" | "connected" | "collecting" | "comparable";
    /* 마지막으로 받은(스크립트) 또는 올린(CSV) 시각 */
    lastDataLabel?: string | null;
    /* 연결 방법 */
    source?: "script" | "csv" | null;
    /* 진단 루프 2단계의 세 칸: 수집(스크립트·CSV) · 예측과 비교(매핑 저장) · 원인 재현 */
    steps?: [boolean, boolean, boolean];
    landingSessions: number | null;
    completedSessions: number | null;
    completionRate: number | null;
    maxDropOff: string | null;
  };
  calibration: {
    status: "before" | "proposal";
    meanErrorPp: number | null;
    segments: number | null;
    values: number | null;
    appliedLabel: string | null;
  };
};
