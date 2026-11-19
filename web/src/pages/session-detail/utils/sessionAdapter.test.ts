import { describe, expect, it } from "vitest";

import { sessionFixture } from "../sessionFixture";
import { toPersonaSession } from "./sessionAdapter";

describe("toPersonaSession — 제품 API 방문 상세 → 방문 화면 값", () => {
  it("스텝은 1부터 순서대로 매기고 단계·점수·행동을 옮긴다", () => {
    const session = toPersonaSession(sessionFixture());

    expect(session.trace.map((point) => [point.step, point.stage, point.score])).toEqual([
      [1, "landing", 20],
      [2, "browse", 50],
      [3, "signup", 80],
    ]);
    expect(session.trace[2].crossed).toBe(true);
    expect(session.events).toEqual([
      { step: 1, action: "click", description: "상품 보기" },
      { step: 2, action: "click", description: "상품 보기" },
    ]);
    expect(session.cause_name).toBe("입력 부담");
    expect(session.elapsed_ms).toBe(185_000);
  });

  it("캡처가 없는 마지막 스텝은 방문 마지막 화면으로 채운다", () => {
    const session = toPersonaSession(sessionFixture());

    expect(session.trace[0].screenshot_url).toBe("/api/v1/observations/1/screenshot");
    expect(session.trace[2].screenshot_url).toBe("/api/v1/sessions/7/final-screenshot");
  });

  it("모르는 단계는 기타로, 끝나지 않은 방문은 진행 중으로 본다", () => {
    const detail = sessionFixture({ status: "incomplete", terminal_stage: "weird" });
    detail.timeline[1].stage = null;
    const session = toPersonaSession(detail);

    expect(session.status).toBe("running");
    expect(session.terminal_stage).toBe("other");
    expect(session.trace[1].stage).toBe("other");
  });
});
