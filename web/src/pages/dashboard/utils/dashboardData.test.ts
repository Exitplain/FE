import { describe, expect, it } from "vitest";

import type { RunDetail, RunItem } from "@/types/run.type";

import { activeItemOf, recentIssues, runningCard, weekCounts } from "./dashboardData";

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

  it("최근 리포트에 원인이 없으면 그 프로젝트의 옛 원인을 보여 주지 않는다", () => {
    const issues = recentIssues([
      {
        project: banchan,
        item: item("old", "2026-11-01T00:00:00Z", {
          report: {
            id: "r",
            status: "final",
            revision: 1,
            goal_rates: [],
            top_causes: [{ key: "cost", name: "비용 충격", dropouts: 3 }],
          },
        }),
      },
      {
        project: banchan,
        item: item("new", "2026-11-05T00:00:00Z", {
          report: { id: "r2", status: "final", revision: 1, goal_rates: [], top_causes: [] },
        }),
      },
    ]);
    expect(issues).toEqual([]);
  });

  it("프로젝트마다 최근 리포트의 원인을 모아 이탈 수 순서로 3개", () => {
    const report = (causes: [string, number][]) => ({
      id: "r",
      status: "final" as const,
      revision: 1,
      goal_rates: [],
      top_causes: causes.map(([name, dropouts]) => ({ key: name, name, dropouts })),
    });
    const issues = recentIssues([
      {
        project: banchan,
        item: item("b1", "2026-11-01T00:00:00Z", { report: report([["옛 원인", 9]]) }),
      },
      {
        project: banchan,
        item: item("b2", "2026-11-05T00:00:00Z", {
          report: report([
            ["입력 부담", 5],
            ["비용 충격", 2],
          ]),
        }),
      },
      {
        project: studio,
        item: item("s1", "2026-11-03T00:00:00Z", { report: report([["탐색 실패", 4]]) }),
      },
    ]);
    expect(issues.map((issue) => [issue.cause, issue.projectName, issue.dropouts])).toEqual([
      ["입력 부담", "반찬로드", 5],
      ["탐색 실패", "스튜디오", 4],
      ["비용 충격", "반찬로드", 2],
    ]);
  });
});
