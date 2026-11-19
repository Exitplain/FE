import { describe, expect, it } from "vitest";

import type { PersonaSession, SessionStatus } from "@/types/persona.type";

import {
  actionLabel,
  busiestStage,
  countSessions,
  failureSummary,
  filterSessions,
  formatClock,
  formatElapsed,
  formatTokens,
  safeViewerUrl,
  sessionCode,
  sessionGroup,
  sessionSegment,
  taskOptions,
  taskTabs,
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

  it("묶음으로 방문을 고른다", () => {
    const sessions = [session("a_order", "success"), session("b_order", "agent_failure")];

    expect(filterSessions(sessions, "all")).toHaveLength(2);
    expect(filterSessions(sessions, "error").map((s) => s.id)).toEqual(["b_order"]);
  });
});

describe("taskOptions — 과업 탭", () => {
  it("방문의 과업을 처음 나온 순서대로 중복 없이", () => {
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

describe("taskTabs — 전체 과업 탭과 과업별 진행", () => {
  /* 과업마다 방문 2회 (페르소나 2명 × 시드 1) */
  const task = (taskId: string, n: number, status: SessionStatus) =>
    session(`p${n}_${taskId}`, status, { task_id: taskId, task_name: taskId });
  const base = {
    plannedIds: ["order", "coupon", "delivery"],
    names: { order: "첫 주문", coupon: "쿠폰 받기", delivery: "배송 확인" },
    expectedSessions: 6,
    phase: "running" as const,
  };

  it("계획한 과업을 처음부터 모두, 계획 순서대로 보여 주고 시작 전 과업은 대기", () => {
    expect(taskTabs({ ...base, sessions: [] })).toEqual([
      { id: "order", name: "첫 주문", state: "queued", started: 0, finished: 0, total: 2 },
      { id: "coupon", name: "쿠폰 받기", state: "queued", started: 0, finished: 0, total: 2 },
      { id: "delivery", name: "배송 확인", state: "queued", started: 0, finished: 0, total: 2 },
    ]);
  });

  it("서버가 준 진행 순서·상태가 있으면 그 순서(왼쪽 → 오른쪽)와 상태를 따른다", () => {
    const tabs = taskTabs({
      ...base,
      sessions: [task("delivery", 1, "success")],
      serverTasks: [
        { task_id: "delivery", name: "배송 확인", position: 1, status: "done", seeds: 1 },
        { task_id: "order", name: "첫 주문", position: 2, status: "running", seeds: 1 },
        { task_id: "coupon", name: "쿠폰 받기", position: 3, status: "queued", seeds: 1 },
      ],
    });
    expect(tabs.map((tab) => [tab.id, tab.state])).toEqual([
      ["delivery", "done"],
      ["order", "running"],
      ["coupon", "queued"],
    ]);
  });

  it("진행 중인 방문이 있으면 진행 중, 과업 방문이 모두 끝나면 완료 (실행 순서와 관계없이)", () => {
    const tabs = taskTabs({
      ...base,
      sessions: [
        task("coupon", 1, "success"),
        task("coupon", 2, "simulated_dropout"),
        task("delivery", 1, "running"),
        task("delivery", 2, "success"),
      ],
    });
    expect(tabs.map((tab) => [tab.id, tab.state, tab.finished])).toEqual([
      ["order", "queued", 0],
      ["coupon", "done", 2],
      ["delivery", "running", 1],
    ]);
  });

  it("세션 이름보다 받은 과업 이름을 쓰고, 저장 목록에 없는 과업은 뒤에 붙인다", () => {
    const tabs = taskTabs({ ...base, sessions: [task("extra", 1, "running")] });
    expect(tabs.map((tab) => tab.id)).toEqual(["order", "coupon", "delivery", "extra"]);
    expect(tabs[0].name).toBe("첫 주문");
    expect(tabs[3]).toMatchObject({ name: "extra", state: "running" });
  });

  it("실행이 끝나면 방문이 없던 과업도 완료", () => {
    const tabs = taskTabs({
      ...base,
      phase: "completed",
      sessions: [task("order", 1, "success")],
    });
    expect(tabs.map((tab) => tab.state)).toEqual(["done", "done", "done"]);
  });

  it("예상 방문 수가 과업 수로 나누어떨어지지 않으면 과업별 전체 수는 모른다", () => {
    expect(taskTabs({ ...base, expectedSessions: 7, sessions: [] })[0].total).toBeNull();
  });

  it("방문 목록이 잘렸으면 개수만으로 완료라고 하지 않는다", () => {
    const tabs = taskTabs({
      ...base,
      truncated: true,
      sessions: [task("order", 1, "success"), task("order", 2, "success")],
    });
    expect(tabs[0].state).toBe("running");
  });

  it("실행이 끝났으면 진행 중으로 남은 방문이 있어도 완료로 본다", () => {
    const tabs = taskTabs({ ...base, phase: "cancelled", sessions: [task("order", 1, "running")] });
    expect(tabs[0].state).toBe("done");
  });

  it("대기 방문만 있는 과업은 대기", () => {
    expect(taskTabs({ ...base, sessions: [task("order", 1, "queued")] })[0].state).toBe("queued");
  });

  it("과업별 예상 수는 계획한 과업 수로 나눈다 (계획에 없는 과업이 섞여도)", () => {
    const tabs = taskTabs({ ...base, sessions: [task("extra", 1, "running")] });
    expect(tabs.map((tab) => tab.total)).toEqual([2, 2, 2, 2]);
  });

  it("서버 과업 목록이 있으면 직접 추가한 과업까지 센 과업 수로 나눈다", () => {
    /* 고른 과업 2개 + 직접 추가 1개, AI 고객 10명 × 시드 1 → 전체 30, 과업마다 10 */
    const tabs = taskTabs({
      ...base,
      plannedIds: ["order", "coupon"],
      expectedSessions: 30,
      sessions: [],
      serverTasks: [
        { task_id: "order", name: "첫 주문", position: 1, status: "running", seeds: 1 },
        { task_id: "coupon", name: "쿠폰 받기", position: 2, status: "queued", seeds: 1 },
        { task_id: "custom_1", name: "배송지 바꾸기", position: 3, status: "queued", seeds: 1 },
      ],
    });
    expect(tabs.map((tab) => [tab.id, tab.total])).toEqual([
      ["order", 10],
      ["coupon", 10],
      ["custom_1", 10],
    ]);
  });

  it("저장한 과업 목록이 없으면 방문에 나온 과업만 (기존과 같음)", () => {
    const tabs = taskTabs({
      ...base,
      plannedIds: [],
      sessions: [task("coupon", 1, "running"), task("order", 1, "running")],
    });
    expect(tabs.map((tab) => [tab.id, tab.total])).toEqual([
      ["coupon", null],
      ["order", null],
    ]);
  });
});

describe("busiestStage — 지금 가장 많은 단계", () => {
  it("진행 중 방문의 현재 단계 중 가장 많은 것", () => {
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
  it("한도 도달만 있으면 한도 문구, 정상 종료 방문 수를 센다", () => {
    expect(
      failureSummary([
        session("a_order", "budget_exceeded"),
        session("b_order", "budget_exceeded"),
      ]),
    ).toEqual({ reason: "모든 방문이 행동·시간 한도에 닿았어요", finishedNormally: 0, total: 2 });
    expect(
      failureSummary([session("a_order", "agent_failure", { reason: "브라우저 실행 오류 (X)" })]),
    ).toEqual({ reason: "브라우저 실행 오류 (X)", finishedNormally: 0, total: 1 });
  });
});

describe("실행 화면 표시 도우미", () => {
  it("행동 이름·시각·토큰을 Figma 표기로 바꾼다", () => {
    expect(actionLabel("click")).toBe("클릭");
    expect(actionLabel("scroll")).toBe("스크롤");
    expect(actionLabel("custom")).toBe("custom");
    expect(formatClock("2026-11-15T05:36:00Z")).toBe("14:36");
    expect(formatClock(null)).toBe("");
    expect(formatTokens(12400)).toBe("12.4k");
    expect(formatTokens(1_100_000)).toBe("1.1M");
    expect(formatTokens(800)).toBe("800");
  });

  it("P 코드·세그먼트가 없으면(BE) 프로필 이름을 쓴다", () => {
    const plain = session("quick_order", "running");
    expect(sessionCode(plain)).toBe("빠른 구매");
    expect(sessionSegment(plain)).toBe("빠른 구매");
    const coded = { ...plain, code: "P-001", segment_name: "빠른 구매형" };
    expect(sessionCode(coded)).toBe("P-001");
    expect(sessionSegment(coded)).toBe("빠른 구매형");
  });
});
