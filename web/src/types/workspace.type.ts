export type WorkspaceProject = {
  id: string;
  name: string;
  url: string;
  stage: number;
  stageLabel: string;
  stageDetail: string;
  analytics: string;
  calibration: string;
  action: string;
  actionTarget: "calibration" | "testList" | "analytics";
};

export type WorkspaceRunStatus = "queued" | "running" | "completed" | "failed";
export type WorkspaceRun = {
  id: string;
  projectId: string;
  projectName: string;
  title: string;
  type: "사전 테스트" | "원인 재현";
  status: WorkspaceRunStatus;
  predictions: [number, number][];
  date: string;
  dateLabel: string;
};

export type WorkspaceIssue = {
  id: string;
  cause: string;
  stage: string;
  projectId: string;
  projectName: string;
  task: string;
  impact: [number, number];
  firstSeen: string;
  verdict: "계속 발생" | "새로 발견" | "재테스트 전";
  runId: string;
  evidence: string;
};

export type WorkspaceSnapshot = {
  asOf: string;
  projects: WorkspaceProject[];
  runs: WorkspaceRun[];
  recentGoals: WorkspaceRun[];
  issues: WorkspaceIssue[];
  summary: {
    completedThisWeek: number;
    failedThisWeek: number;
    comparableProjects: number;
    pendingCalibration: number;
  };
  activeRun: {
    id: string;
    projectId: string;
    name: string;
    seed: string;
    total: number;
    running: number;
    queued: number;
    completed: number;
    exited: number;
    errors: number;
  };
};

export type WorkspaceSettings = {
  workspaceName: string;
  displayName: string;
  notificationEmail: string;
};
