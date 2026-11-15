import { describe, expect, it } from "vitest";

import type { PersonaSession, Stage, TracePoint } from "@/types/persona.type";

import {
  describeSession,
  formatDurationPadded,
  mergeSteps,
  parseTab,
  sessionKpis,
  stageFlow,
} from "./sessionView";

const point = (step: number, stage: Stage, score: number): TracePoint => ({
  step,
  stage,
  score,
  previous_score: 0,
  threshold: 48,
  required_fields: 1,
  crossed: score > 48,
  url: "",
  artifact_id: null,
});

function session(extra: Partial<PersonaSession> = {}): PersonaSession {
  return {
    id: "P-017_order",
    profile_id: "cautious",
    name: "신중한 첫 방문형",
    context: "",
    max_required_fields: 3,
    width: 390,
    search_sensitivity: 1,
    cost_sensitivity: 1,
    task_id: "order",
    task_name: "첫 주문 완료",
    goal: "",
    status: "simulated_dropout",
    reason: "",
    steps: 3,
    events: [
      { step: 1, action: "click", description: "‘상품’ 화면으로 이동" },
      { step: 3, action: "scroll", description: "가입 양식 아래로" },
    ],
    trace: [point(1, "landing", 5), point(2, "cart", 30), point(3, "signup", 56)],
    terminal_stage: "signup",
    issue: {
      category: "input_burden",
      observed_fields: 4,
      configured_limit: 3,
      model_version: "frustration-v2",
    },
    artifact_id: null,
    viewer_url: null,
    code: "P-017",
    segment_name: "신중한 첫 방문형",
    seed: 1,
    utterances: [
      { step: 2, stage: "cart", text: "이제 주문하면 되겠네요.", at: "" },
      { step: 3, stage: "signup", text: "여기서 그만할게요.", at: "" },
    ],
    elapsed_ms: 185_000,
    tokens: 18_200,
    cost_usd: 0.04,
    ...extra,
  };
}

describe("세션 상세 표시 도우미", () => {
  it("시간은 초를 두 자리로, 1분 미만은 초만", () => {
    expect(formatDurationPadded(185_000)).toBe("3분 05초");
    expect(formatDurationPadded(260_000)).toBe("4분 20초");
    expect(formatDurationPadded(120_000)).toBe("2분 00초");
    expect(formatDurationPadded(45_400)).toBe("45초");
  });

  it("제목 아래 설명 — 이탈·완료는 과업과 시간, 오류는 멈춘 스텝", () => {
    expect(describeSession(session())).toBe(
      "신중한 첫 방문형 · 첫 주문 완료 · 시드 1 · 3스텝 · 3분 05초 · 18.2k 토큰 · $0.04",
    );
    expect(describeSession(session({ status: "agent_failure" }))).toBe(
      "신중한 첫 방문형 · 시드 1 · 3스텝에서 멈춤 · 18.2k 토큰 · $0.04",
    );
  });

  it("스텝마다 행동·발화를 붙이고 이탈한 마지막 스텝을 표시한다", () => {
    const rows = mergeSteps(session());
    expect(rows.map((row) => [row.step, row.action, row.utterance, row.exit])).toEqual([
      [1, "클릭 · ‘상품’ 화면으로 이동", null, false],
      [2, null, "이제 주문하면 되겠네요.", false],
      [3, "스크롤 · 가입 양식 아래로", "여기서 그만할게요.", true],
    ]);
    expect(mergeSteps(session({ status: "success" })).at(-1)?.exit).toBe(false);
  });

  it("단계 흐름 — 처음 나온 순서, 마지막은 이탈이면 여기서 중단", () => {
    expect(stageFlow(session()).map((stage) => [stage.label, stage.note, stage.state])).toEqual([
      ["첫 화면", "클릭", "passed"],
      ["장바구니", "", "passed"],
      ["가입", "여기서 중단", "exit"],
    ]);
    expect(stageFlow(session({ status: "success" })).at(-1)?.state).toBe("done");
  });

  it("KPI — 이탈은 단계·원인·마지막 점수, 완료는 직전 단계 → 완료와 최고 점수", () => {
    expect(sessionKpis(session()).map((kpi) => kpi.value)).toEqual([
      "가입",
      "입력 부담",
      "56 / 임계치 48",
      "임계치 초과 → 이탈",
    ]);
    const done = session({
      status: "success",
      terminal_stage: "complete",
      trace: [point(1, "checkout", 40), point(2, "complete", 32)],
    });
    expect(sessionKpis(done).map((kpi) => kpi.value)).toEqual([
      "결제 정보 → 완료",
      "3분 05초",
      "40 / 임계치 48",
      "목표 달성",
    ]);
  });

  it("탭 주소 — 모르는 값은 요약", () => {
    expect(parseTab("timeline")).toBe("timeline");
    expect(parseTab(null)).toBe("summary");
    expect(parseTab("x")).toBe("summary");
  });
});
