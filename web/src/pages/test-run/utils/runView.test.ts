import { describe, expect, it } from "vitest";

import type { PersonaRun, PersonaSession, SessionStatus } from "@/types/persona.type";

import {
  busiestStage,
  countSessions,
  failureSummary,
  filterSessions,
  formatElapsed,
  runPhase,
  safeViewerUrl,
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

describe("safeViewerUrl — 라이브 화면 iframe 주소 검증", () => {
  const APP = "http://localhost:5173";

  it("다른 출처의 http(s) 주소만 허용한다", () => {
    expect(safeViewerUrl("http://localhost:8080/browser-session/s1", APP)).toBe(
      "http://localhost:8080/browser-session/s1",
    );
    expect(safeViewerUrl("https://viewer.example/s1", APP)).toBe("https://viewer.example/s1");
  });

  it("앱과 같은 출처·상대 경로·http 가 아닌 주소·빈 값은 막는다", () => {
    expect(safeViewerUrl("/mock/live/s1", APP)).toBeNull();
    expect(safeViewerUrl("http://localhost:5173/other", APP)).toBeNull();
    expect(safeViewerUrl("javascript:alert(1)", APP)).toBeNull();
    expect(safeViewerUrl("data:text/html,hi", APP)).toBeNull();
    expect(safeViewerUrl(null, APP)).toBeNull();
    expect(safeViewerUrl("::not a url", APP)).toBeNull();
    // 앱 출처를 알 수 없는 환경(file: 등)에서도 화면이 깨지지 않습니다
    expect(safeViewerUrl("https://viewer.example/s1", "null")).toBeNull();
  });
});

describe("failureSummary — E05 문구", () => {
  it("한도 도달만 있으면 한도 문구, 정상 종료 세션 수를 센다", () => {
    expect(
      failureSummary([
        session("a_order", "budget_exceeded"),
        session("b_order", "budget_exceeded"),
      ]),
    ).toEqual({ reason: "모든 세션이 행동·시간 한도에 닿았어요", finishedNormally: 0, total: 2 });
    expect(
      failureSummary([session("a_order", "agent_failure", { reason: "브라우저 실행 오류 (X)" })]),
    ).toEqual({ reason: "브라우저 실행 오류 (X)", finishedNormally: 0, total: 1 });
  });
});
