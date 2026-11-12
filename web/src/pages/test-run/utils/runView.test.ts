import { describe, expect, it } from "vitest";

import type { PersonaRun, PersonaSession, SessionStatus } from "@/types/persona.type";

import {
  busiestStage,
  countSessions,
  filterSessions,
  formatElapsed,
  runPhase,
  sessionGroup,
  taskOptions,
} from "./runView";

function session(
  id: string,
  status: SessionStatus,
  extra: Partial<PersonaSession> = {},
): PersonaSession {
  return {
    id,
    profile_id: id.split("_")[0],
    name: "빠른 구매",
    context: "",
    max_required_fields: 2,
    width: 390,
    search_sensitivity: 1,
    cost_sensitivity: 1,
    task_id: id.split("_")[1] ?? "order",
    task_name: id.endsWith("coupon") ? "쿠폰으로 주문" : "첫 주문",
    goal: "",
    status,
    reason: "",
    steps: 0,
    events: [],
    trace: [],
    terminal_stage: null,
    issue: null,
    artifact_id: null,
    viewer_url: null,
    ...extra,
  };
}

function run(status: PersonaRun["status"], sessions: PersonaSession[]): PersonaRun {
  return {
    status,
    id: "r1",
    policy: "",
    model_calls: 0,
    target: "",
    profiles: [],
    tasks: [],
    sessions,
  };
}

describe("runPhase — 화면 단계", () => {
  it("실행 중인데 아직 아무 세션도 행동하지 않았으면 준비 중(P08)", () => {
    expect(runPhase(run("running", [session("quick_order", "queued")]))).toBe("preparing");
    expect(runPhase(run("running", [session("quick_order", "running")]))).toBe("preparing");
  });

  it("한 세션이라도 행동을 시작했거나 끝났으면 실행 중(P09)", () => {
    expect(runPhase(run("running", [session("quick_order", "running", { steps: 2 })]))).toBe(
      "running",
    );
    expect(runPhase(run("running", [session("quick_order", "success")]))).toBe("running");
  });

  it("끝났는데 모든 세션이 기술 실패면 실패(E05), 아니면 완료", () => {
    expect(runPhase(run("completed", [session("quick_order", "agent_failure")]))).toBe("failed");
    expect(
      runPhase(
        run("completed", [
          session("quick_order", "agent_failure"),
          session("careful_order", "success"),
        ]),
      ),
    ).toBe("completed");
  });

  it("실행이 없으면 idle", () => {
    expect(runPhase(run("idle", []))).toBe("idle");
  });
});

describe("sessionGroup · countSessions — 필터 묶음", () => {
  it("한도 도달과 실행 오류는 오류로, 가상 이탈만 이탈로 센다", () => {
    expect(sessionGroup("budget_exceeded")).toBe("error");
    expect(sessionGroup("agent_failure")).toBe("error");
    expect(sessionGroup("simulated_dropout")).toBe("dropout");

    const counts = countSessions([
      session("a_order", "success"),
      session("b_order", "simulated_dropout"),
      session("c_order", "budget_exceeded"),
      session("d_order", "queued"),
      session("e_order", "running"),
    ]);
    expect(counts).toEqual({
      all: 5,
      running: 1,
      success: 1,
      dropout: 1,
      queued: 1,
      error: 1,
      finished: 3,
    });
  });

  it("묶음으로 세션을 고른다", () => {
    const sessions = [session("a_order", "success"), session("b_order", "agent_failure")];

    expect(filterSessions(sessions, "all")).toHaveLength(2);
    expect(filterSessions(sessions, "error").map((s) => s.id)).toEqual(["b_order"]);
  });
});

describe("taskOptions — 과업 탭", () => {
  it("세션의 과업을 처음 나온 순서대로 중복 없이", () => {
    expect(
      taskOptions([
        session("a_order", "queued"),
        session("a_coupon", "queued"),
        session("b_order", "queued"),
      ]),
    ).toEqual([
      { id: "order", name: "첫 주문" },
      { id: "coupon", name: "쿠폰으로 주문" },
    ]);
  });
});

describe("busiestStage — 지금 가장 많은 단계", () => {
  it("진행 중 세션의 현재 단계 중 가장 많은 것", () => {
    expect(
      busiestStage([
        session("a_order", "running", { terminal_stage: "cart" }),
        session("b_order", "running", { terminal_stage: "cart" }),
        session("c_order", "running", { terminal_stage: "signup" }),
        session("d_order", "success", { terminal_stage: "complete" }),
      ]),
    ).toEqual({ stage: "cart", count: 2 });
    expect(busiestStage([session("a_order", "queued")])).toBeNull();
  });
});

describe("formatElapsed", () => {
  it("분·초로 보여준다", () => {
    expect(formatElapsed(42_000)).toBe("0분 42초");
    expect(formatElapsed(372_000)).toBe("6분 12초");
    expect(formatElapsed(-5)).toBe("0분 0초");
  });
});
