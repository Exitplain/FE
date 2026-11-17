import { formatRunDate } from "@/pages/test-list/utils/testRows";
import { ApiError } from "@/types/api.type";
import type { ProjectInput, ProjectOverview, ProjectRecord } from "@/types/project.type";
import type { RunStatus } from "@/types/run.type";
import type { V1ProjectDetail, V1ProjectSummary } from "@/types/project.v1.type";
import type { WorkspaceRunStatus } from "@/types/workspace.type";
import { validateProjectInput } from "@/utils/projectInput";

import { createProjectV1, getMyProjects, getSampleProjects } from "./project.v1.api";

/*
  화면용 프로젝트 (C02~C05, 사이드바). 제품 API 응답을 화면 타입(ProjectRecord)으로 바꿉니다.
  - 목록: 내 프로젝트(로그인했을 때) + 샘플 프로젝트
  - 실측(R)·보정(K)은 서버에 아직 없어 "실측 미연결"·"보정 전"으로 둡니다
*/

const RUN_STATUS: Record<RunStatus, WorkspaceRunStatus> = {
  queued: "queued",
  running: "running",
  finalizing: "running",
  completed: "completed",
  partially_completed: "completed",
  failed: "failed",
  cancelled: "failed",
};

const STAGE_DETAIL: Record<WorkspaceRunStatus, string> = {
  queued: "테스트 대기",
  running: "테스트 중",
  completed: "테스트 완료",
  failed: "테스트 실패",
};

/* 서버가 아직 모르는 상태를 보내도 화면이 비지 않게 null(테스트 전)로 둡니다 */
export function runStatusOf(status: RunStatus | undefined): WorkspaceRunStatus | null {
  return (status && RUN_STATUS[status]) ?? null;
}

/* BE 는 주소를 정규화해 빈 경로에 "/" 를 붙입니다. 화면에는 예전처럼 "https://shop.example" 로 보여 줍니다 */
export function displayUrl(entryUrl: string): string {
  return entryUrl.replace(/^(https?:\/\/[^/?#]+)\/$/, "$1");
}

export function toProjectRecord(project: V1ProjectSummary | V1ProjectDetail): ProjectRecord {
  const status = runStatusOf(project.last_pretest?.status);
  return {
    id: String(project.id),
    name: project.name,
    url: displayUrl(project.entry_url),
    journey: "journey_note" in project ? project.journey_note : "",
    stage: status ? 1 : 0,
    stageLabel: "사전 테스트",
    stageDetail: status ? STAGE_DETAIL[status] : "테스트 전",
    analytics: "실측 미연결",
    calibration: "보정 전",
    action: status ? "테스트 기록 보기" : "첫 테스트 시작",
    actionTarget: "testList",
    lastTestStatus: status,
    updatedLabel: formatRunDate(project.updated_at),
    isSample: project.is_sample,
  };
}

/* 로그인하지 않았으면(401) 샘플만 보여 줍니다 */
async function getMyProjectItems(): Promise<V1ProjectSummary[]> {
  try {
    return (await getMyProjects()).items;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return [];
    throw error;
  }
}

/*
  내 프로젝트 → 샘플 순서. 한쪽만 실패하면 받은 쪽만 보여 주고, 둘 다 실패해야 오류로 봅니다.
  (샘플 목록 하나 때문에 사이드바·대시보드 전체가 오류가 되지 않게)
*/
export async function getProjects(): Promise<ProjectRecord[]> {
  const [mine, samples] = await Promise.allSettled([getMyProjectItems(), getSampleProjects()]);
  if (mine.status === "rejected" && samples.status === "rejected") throw mine.reason;
  const own = mine.status === "fulfilled" ? mine.value : [];
  const seen = new Set(own.map((project) => project.id));
  const sampleItems = samples.status === "fulfilled" ? samples.value.items : [];
  return [...own, ...sampleItems.filter((project) => !seen.has(project.id))].map(toProjectRecord);
}

/* C05 개요. 서버에 있는 건 마지막 사전 테스트뿐이라 나머지 단계는 시작 전 상태로 둡니다 */
export function toProjectOverview(project: V1ProjectDetail): ProjectOverview {
  const last = project.runs.last_pretest;
  return {
    phase: 1,
    connection: null,
    test: {
      status: runStatusOf(last?.status),
      title: last ? `${last.sequence_no}차` : null,
      prediction: null,
      maxDropOff: null,
      dateLabel: last ? formatRunDate(last.created_at) : null,
    },
    analytics: {
      status: "unconnected",
      landingSessions: null,
      completedSessions: null,
      completionRate: null,
      maxDropOff: null,
    },
    calibration: {
      status: "before",
      meanErrorPp: null,
      segments: null,
      values: null,
      appliedLabel: null,
    },
  };
}

/* 서버 검증 오류를 입력칸별 문구로 나눈 오류. 그 밖의 오류는 message 만 씁니다 */
export class ProjectInputError extends Error {
  readonly fields: Partial<Record<keyof ProjectInput, string>>;
  constructor(message: string, fields: Partial<Record<keyof ProjectInput, string>>) {
    super(message);
    this.name = "ProjectInputError";
    this.fields = fields;
  }
}

const SERVER_FIELD: Record<string, keyof ProjectInput> = {
  name: "name",
  entry_url: "url",
  journey_note: "journey",
};

function firstMessage(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return undefined;
}

export async function createProject(input: ProjectInput): Promise<ProjectRecord> {
  const result = validateProjectInput(input);
  if (!result.valid)
    throw new ProjectInputError(Object.values(result.errors)[0] ?? "", result.errors);
  try {
    const created = await createProjectV1({
      name: result.value.name,
      entry_url: result.value.url,
      ...(result.value.journey ? { journey_note: result.value.journey } : {}),
    });
    return toProjectRecord(created);
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    if (error.status === 401)
      throw new Error("로그인한 뒤 프로젝트를 만들 수 있어요", { cause: error });
    if (error.code === "DUPLICATE_PROJECT")
      throw new ProjectInputError("이미 등록된 사이트예요. 기존 프로젝트를 확인해 주세요", {
        url: "이미 등록된 사이트예요. 기존 프로젝트를 확인해 주세요",
      });
    const fields: Partial<Record<keyof ProjectInput, string>> = {};
    for (const [key, value] of Object.entries(error.fields ?? {})) {
      const field = SERVER_FIELD[key];
      const message = firstMessage(value);
      if (field && message) fields[field] = message;
    }
    if (Object.keys(fields).length) throw new ProjectInputError(error.message, fields);
    throw error;
  }
}
