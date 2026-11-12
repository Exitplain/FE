import { describe, expect, it } from "vitest";

import type { PersonaReportSummary, PersonaRun } from "@/types/persona.type";

import { formatRunDate, toTestRows } from "./testRows";

const NOW = new Date("2026-11-13T15:00:00+09:00");

const reports: PersonaReportSummary[] = [
  { run_id: "r2", created_at: "2026-11-07T05:00:00Z", variant: "problem", sessions: 6 },
  { run_id: "r1", created_at: "2026-11-03T05:00:00Z", variant: "fixed", sessions: 3 },
];

function run(overrides: Partial<PersonaRun>): PersonaRun {
  return {
    status: "running",
    id: "r3",
    policy: "scripted_fixture",
    model_calls: 0,
    target: "반찬로드 모의 쇼핑몰",
    profiles: [],
    tasks: [],
    sessions: [],
    created_at: "2026-11-13T05:40:00Z",
    variant: "problem",
    ...overrides,
  };
}

describe("formatRunDate", () => {
  it("오늘이면 시:분, 아니면 월·일로 보여준다", () => {
    expect(formatRunDate("2026-11-13T05:40:00Z", NOW)).toBe("14:40");
    expect(formatRunDate("2026-11-07T05:00:00Z", NOW)).toBe("11월 7일");
    expect(formatRunDate(null, NOW)).toBe("—");
  });
});

describe("toTestRows", () => {
  it("완료된 실행을 최신순 차수로 이름 붙인다", () => {
    const rows = toTestRows({ reports, currentRun: undefined, now: NOW });

    expect(rows.map((row) => [row.name, row.status])).toEqual([
      ["2차 · 문제 버전 · 세션 6개", "done"],
      ["1차 · 개선 버전 · 세션 3개", "done"],
    ]);
    expect(rows[0].date).toBe("11월 7일");
  });

  it("진행 중인 실행을 맨 위에 다음 차수로 넣는다 (모두 대기면 준비 중)", () => {
    const preparing = run({
      sessions: [{ status: "queued" }, { status: "queued" }] as PersonaRun["sessions"],
    });
    const running = run({
      sessions: [{ status: "running" }, { status: "queued" }] as PersonaRun["sessions"],
    });

    expect(toTestRows({ reports, currentRun: preparing, now: NOW })[0]).toMatchObject({
      key: "r3",
      name: "3차 · 문제 버전 · 세션 2개",
      status: "preparing",
      date: "14:40",
    });
    expect(toTestRows({ reports, currentRun: running, now: NOW })[0].status).toBe("running");
  });

  it("현재 실행이 이미 완료돼 목록에 있으면 한 번만 보여준다", () => {
    const completed = run({ id: "r2", status: "completed" });

    expect(toTestRows({ reports, currentRun: completed, now: NOW })).toHaveLength(2);
  });

  it("방금 끝나 목록에 아직 없는 현재 실행은 완료 행으로 보여준다", () => {
    const justCompleted = run({ id: "r3", status: "completed", sessions: [] });

    expect(toTestRows({ reports, currentRun: justCompleted, now: NOW })[0]).toMatchObject({
      key: "r3",
      name: "3차 · 문제 버전 · 세션 0개",
      status: "done",
    });
  });

  it("날짜를 읽을 수 없으면 — 로 보여준다", () => {
    expect(formatRunDate("not-a-date", NOW)).toBe("—");
  });

  it("idle 은 목록에 넣지 않는다", () => {
    const idle = run({ id: null, status: "idle" });

    expect(toTestRows({ reports: [], currentRun: idle, now: NOW })).toEqual([]);
  });
});
