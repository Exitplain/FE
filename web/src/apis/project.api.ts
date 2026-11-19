import { formatRunDate } from "@/pages/test-list/utils/testRows";
import { ApiError } from "@/types/api.type";
import type { ProjectInput, ProjectOverview, ProjectRecord } from "@/types/project.type";
import type { RunItem, RunStatus } from "@/types/run.type";
import type { V1ProjectDetail, V1ProjectSummary } from "@/types/project.v1.type";
import type { WorkspaceRunStatus } from "@/types/workspace.type";
import { validateProjectInput } from "@/utils/projectInput";

import { createProjectV1, getMyProjects, getSampleProjects } from "./project.v1.api";

/*
  화면용 프로젝트 (C02~C05, 사이드바). 제품 API 응답을 화면 타입(ProjectRecord)으로 바꿉니다.
  - 목록: 내 프로젝트(로그인했을 때) + 샘플 프로젝트
  - 실측·보정 열은 목록 항목의 measurement·calibration 으로 만듭니다 (주지 않으면 "실제 고객 데이터 미연결"·"예측 맞추기 전")
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

const ANALYTICS_LABEL: Record<ProjectRecord["measurementStatus"], string> = {
  unconnected: "실제 고객 데이터 미연결",
  waiting: "실제 고객 데이터 수집 대기",
  connected: "실제 고객 데이터 연결됨",
};

export function toProjectRecord(project: V1ProjectSummary | V1ProjectDetail): ProjectRecord {
  const status = runStatusOf(project.last_pretest?.status);
  /* 모르는 상태가 와도 화면이 비지 않게 미연결로 둡니다 */
  const reported = project.measurement?.status;
  const measurementStatus =
    reported && Object.prototype.hasOwnProperty.call(ANALYTICS_LABEL, reported)
      ? reported
      : "unconnected";
  const calibrationRevision =
    project.calibration?.status === "applied" ? (project.calibration.revision ?? null) : null;
  return {
    id: String(project.id),
    name: project.name,
    url: displayUrl(project.entry_url),
    journey: "journey_note" in project ? project.journey_note : "",
    stage: status ? 1 : 0,
    stageLabel: "사전 테스트",
    stageDetail: status ? STAGE_DETAIL[status] : "테스트 전",
    analytics: ANALYTICS_LABEL[measurementStatus],
    calibration: calibrationRevision == null ? "예측 맞추기 전" : `r${calibrationRevision} 적용`,
    action: status ? "테스트 기록 보기" : "첫 테스트 시작",
    actionTarget: "testList",
    lastTestStatus: status,
    measurementStatus,
    calibrationRevision,
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

/*
  C05 개요 — 진단 루프 단계와 최근 사전 테스트 요약.
  - 마지막 사전 테스트는 실행 목록(latest, 리포트 요약 포함)을 먼저 쓰고, 없으면 프로젝트 상세의 last_pretest 를 씁니다.
    실행 목록은 들어올 때마다·실행 중에는 주기적으로 다시 받아 단계가 바로 바뀝니다.
  - 끝난(완료·일부 완료) 사전 테스트가 하나라도 있으면 실측 분석을 지금 단계로 넘깁니다 (Figma C05).
    마지막 실행이 실패·취소여도 앞서 끝낸 테스트가 있으면 단계는 그대로입니다.
    단, 사전 테스트(재테스트 포함)가 진행 중이면 사전 테스트 단계로 두고 그 실행으로 보냅니다.
    실측·보정은 BE 에 아직 없어 그 뒤로는 넘어가지 않습니다.
  - 최대 이탈 구간은 리포트 전체를 받아야 해서 비워 둡니다 (BE 요약에 들어오면 채움)
*/
/* 프로젝트 상세의 실측 상태 → 개요 카드. 스크립트 수집이나 CSV 기록이 있으면 연결됨 */
function analyticsOf(measurement: V1ProjectDetail["measurement"], reproduced = false) {
  const status = measurement?.status ?? "unconnected";
  const received = measurement?.last_received_at ?? null;
  const imported = measurement?.last_imported_at ?? null;
  const latest = [received, imported]
    .filter((value): value is string => !!value)
    .sort()
    .pop();
  return {
    status:
      status === "connected"
        ? ("connected" as const)
        : status === "waiting"
          ? ("waiting" as const)
          : ("unconnected" as const),
    lastDataLabel: latest ? formatRunDate(latest) : null,
    source: received ? ("script" as const) : imported ? ("csv" as const) : null,
    steps: [status === "connected", !!measurement?.mapping_saved_at, reproduced] as [
      boolean,
      boolean,
      boolean,
    ],
  };
}

export function toProjectOverview(project: V1ProjectDetail, runs?: RunItem[]): ProjectOverview {
  const last = project.runs.last_pretest;
  /* 목록은 차수 최신순입니다. 원인 재현은 사전 테스트가 아니라 뺍니다 */
  const pretests = (runs ?? []).filter((item) => item.kind !== "cause_repro");
  const latest = pretests[0];
  const status = runStatusOf(latest?.status ?? last?.status);
  const finishedBefore =
    pretests.some((item) => runStatusOf(item.status) === "completed") ||
    runStatusOf(last?.status) === "completed";
  const active = status === "running" || status === "queued";
  const rate = latest?.report?.achievement_rate;
  const percent = rate == null ? null : Math.round(rate * 100);
  const sequence = latest?.sequence_no ?? last?.sequence_no;
  const createdAt = latest?.created_at ?? last?.created_at;
  /*
    진단 루프 한 바퀴 = 가장 최근 사전 테스트 → 실제 고객 데이터 분석 → 예측 맞추기.
    그 테스트 뒤에 예측 맞추기를 적용했으면 한 바퀴 완료(4), 그 뒤 새 사전 테스트를 시작하면 다시 1단계부터.
  */
  const appliedAt =
    project.calibration?.status === "applied" ? (project.calibration.applied_at ?? null) : null;
  const cycleDone =
    !active &&
    finishedBefore &&
    !!appliedAt &&
    (!createdAt || Date.parse(appliedAt) > Date.parse(createdAt));
  /* 원인 재현 칸은 이번 바퀴(가장 최근 사전 테스트 뒤)에 돌린 재현만 셉니다 */
  const reproduced = (runs ?? []).some(
    (item) =>
      item.kind === "cause_repro" &&
      (!createdAt || Date.parse(item.created_at) >= Date.parse(createdAt)),
  );
  return {
    phase: cycleDone ? 4 : finishedBefore && !active ? 2 : 1,
    connection: null,
    test: {
      status,
      runId: latest?.id ?? last?.run_id ?? null,
      title: latest?.name || (sequence ? `${sequence}차` : null),
      prediction: percent == null ? null : [percent, percent],
      maxDropOff: null,
      dateLabel: createdAt ? formatRunDate(createdAt) : null,
    },
    analytics: {
      ...analyticsOf(project.measurement, reproduced),
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
      ...(result.value.journey ? { journey_note: result.value.journey } : {}),
    });
    return toProjectRecord(created);
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    if (error.status === 401)
      throw new Error("로그인한 뒤 프로젝트를 만들 수 있어요", { cause: error });
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
