import type { WorkspaceProject, WorkspaceRunStatus } from "./workspace.type";

export type ProjectInput = { name: string; url: string; journey: string };
export type CreatedProject = ProjectInput & { id: string; createdAt: string };
export type ProjectRecord = WorkspaceProject & {
  journey: string;
  lastTestStatus: WorkspaceRunStatus | null;
  updatedLabel: string;
  isSample: boolean;
};

export type ProjectOverview = {
  phase: 1 | 2 | 3;
  connection: { startPath: string; expiresLabel: string } | null;
  test: {
    status: WorkspaceRunStatus | null;
    title: string | null;
    prediction: [number, number] | null;
    maxDropOff: string | null;
    dateLabel: string | null;
  };
  analytics: {
    status: "unconnected" | "collecting" | "comparable";
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
