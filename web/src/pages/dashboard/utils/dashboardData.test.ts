import { describe, expect, it } from "vitest";

import type { RunDetail, RunItem } from "@/types/run.type";

import { activeItemOf, projectLoop, runningCard, weekCounts } from "./dashboardData";

const item = (id: string, created_at: string, overrides: Partial<RunItem> = {}): RunItem => ({
  id,
  sequence_no: 1,
  name: id,
  kind: "pretest",
  status: "completed",
  change_note: "",
  parent_run_id: null,
  created_at,
  started_at: null,
  finished_at: null,
  report: null,
  ...overrides,
});
const banchan = { id: "1", name: "반찬로드" };
const studio = { id: "2", name: "스튜디오" };

describe("대시보드 값", () => {
  it("이번 주(7일)에 끝난 실행만 완료·실패로 센다 (중지는 빼고)", () => {
    const now = Date.parse("2026-11-17T00:00:00Z");
    const done = (id: string, status: RunItem["status"], finished_at: string | null) => ({
      project: banchan,
      item: item(id, "2026-11-01T00:00:00Z", { status, finished_at }),
    });
    expect(
      weekCounts(
        [
          done("a", "completed", "2026-11-16T00:00:00Z"),
          done("b", "partially_completed", "2026-11-15T00:00:00Z"),
          done("c", "failed", "2026-11-15T00:00:00Z"),
          done("d", "cancelled", "2026-11-15T00:00:00Z"),
          done("e", "completed", "2026-11-01T00:00:00Z"),
          done("f", "running", null),
        ],
        now,
      ),
    ).toEqual({ completed: 2, failed: 1 });
  });

  it("가장 최근에 시작한 진행 중 실행을 고르고 세션 상태를 카드 값으로 바꾼다", () => {
    const active = activeItemOf([
      { project: banchan, item: item("old", "2026-11-10T00:00:00Z", { status: "running" }) },
      { project: studio, item: item("new", "2026-11-12T00:00:00Z", { status: "queued" }) },
      { project: banchan, item: item("done", "2026-11-13T00:00:00Z") },
    ]);
    expect(active?.item.id).toBe("new");

    const card = runningCard(studio, {
      id: "new",
      sequence_no: 4,
      progress: {
        expected_sessions: 20,
        started_sessions: 18,
        sessions_by_status: {
          running: 6,
          success: 3,
          simulated_dropout: 8,
          site_failure: 1,
        },
      },
    } as unknown as RunDetail);
    expect(card).toMatchObject({
      name: "스튜디오 4차",
      total: 20,
      running: 6,
      queued: 2,
      completed: 3,
      exited: 8,
      errors: 1,
    });
  });

  it("루프 위치 — 진행 중이면 사전 테스트, 끝낸 테스트가 있으면 실측 분석, 실패만 있으면 다시 테스트", () => {
    const project = { id: "1", name: "반찬로드", lastTestStatus: null } as unknown as Parameters<
      typeof projectLoop
    >[0];
    const at = (n: number) => `2026-11-${String(n).padStart(2, "0")}T00:00:00Z`;
    const entry = (
      id: string,
      day: number,
      status: RunItem["status"],
      kind: RunItem["kind"] = "pretest",
    ) => ({
      project: banchan,
      item: item(id, at(day), { status, kind, sequence_no: day }),
    });

    expect(projectLoop(project, [])).toMatchObject({ stage: 0, action: "첫 테스트 시작" });
    expect(projectLoop(project, [entry("a", 1, "failed")])).toMatchObject({
      stage: 1,
      action: "다시 테스트",
    });
    expect(
      projectLoop(project, [entry("a", 1, "completed"), entry("b", 2, "running")]),
    ).toMatchObject({ stage: 1, actionHref: "/projects/1/runs/b" });
    expect(
      projectLoop(project, [
        entry("a", 1, "completed"),
        entry("b", 2, "failed"),
        entry("c", 3, "running", "cause_repro"),
      ]),
    ).toMatchObject({
      stage: 4,
      stageLabel: "실측 분석",
      stageDetail: "4 / 7 · 실측 연결 전",
      actionHref: "/projects/1/analytics",
    });

    /* 직접 멈춘 실행은 실패와 구분 */
    expect(projectLoop(project, [entry("a", 1, "cancelled")]).stageDetail).toBe(
      "1 / 7 · 테스트 중지",
    );
    /* 이 프로젝트의 실행 목록을 못 받았으면 프로젝트 목록의 마지막 사전 테스트로 대신 */
    expect(projectLoop({ ...project, lastTestStatus: "completed" }, [])).toMatchObject({
      stage: 4,
      action: "실측 데이터 연결하기",
    });
  });

  describe("루프 위치 — 실측·보정 상태 (끝낸 사전 테스트가 있을 때, 프로젝트 목록 값)", () => {
    const nadaum = { id: "7", name: "나다움" };
    const done = [{ project: nadaum, item: item("a", "2026-11-01T00:00:00Z") }];
    const project = (
      measurementStatus: "unconnected" | "waiting" | "connected",
      calibrationRevision: number | null = null,
    ) =>
      ({
        id: "7",
        name: "나다움",
        lastTestStatus: null,
        measurementStatus,
        calibrationRevision,
      }) as unknown as Parameters<typeof projectLoop>[0];

    it("수집 키가 없으면 4단계 · 실측 연결 전", () => {
      expect(projectLoop(project("unconnected"), done)).toMatchObject({
        stage: 4,
        stageLabel: "실측 분석",
        stageDetail: "4 / 7 · 실측 연결 전",
        action: "실측 데이터 연결하기",
        actionHref: "/projects/7/analytics",
      });
    });

    it("키는 있는데 수집이 아직 안 왔으면 5단계 · 수집 대기", () => {
      expect(projectLoop(project("waiting"), done)).toMatchObject({
        stage: 5,
        stageDetail: "5 / 7 · 수집 대기",
        action: "설치 확인하기",
        actionHref: "/projects/7/analytics",
      });
    });

    it("수집을 받았으면 6단계 · 실측 연결됨, 다음은 보정 조정안", () => {
      expect(projectLoop(project("connected"), done)).toMatchObject({
        stage: 6,
        stageDetail: "6 / 7 · 실측 연결됨",
        action: "보정 조정안 보기",
        actionHref: "/projects/7/calibration",
      });
    });

    it("보정을 적용했으면 7단계 · 보정 적용됨", () => {
      expect(projectLoop(project("connected", 2), done)).toMatchObject({
        stage: 7,
        stageLabel: "보정",
        stageDetail: "7 / 7 · 보정 적용됨",
        action: "보정 보기",
        actionHref: "/projects/7/calibration",
      });
    });

    it("진행 중인 사전 테스트가 있으면 실측·보정 상태와 관계없이 사전 테스트 단계", () => {
      const running = [
        ...done,
        {
          project: nadaum,
          item: item("b", "2026-11-02T00:00:00Z", { status: "running", sequence_no: 2 }),
        },
      ];
      expect(projectLoop(project("connected", 2), running)).toMatchObject({ stage: 1 });
    });

    it("실행 목록을 못 받아 프로젝트 목록의 마지막 사전 테스트로 대신할 때도 실측·보정 상태를 쓴다", () => {
      expect(
        projectLoop({ ...project("connected"), lastTestStatus: "completed" }, []),
      ).toMatchObject({ stage: 6, actionHref: "/projects/7/calibration" });
      expect(
        projectLoop({ ...project("unconnected", 1), lastTestStatus: "completed" }, []),
      ).toMatchObject({ stage: 7 });
    });

    it("끝낸 사전 테스트가 없으면 실측·보정 상태가 있어도 실측 단계로 넘기지 않는다", () => {
      expect(projectLoop(project("connected", 2), [])).toMatchObject({ stage: 0 });
    });
  });
});
