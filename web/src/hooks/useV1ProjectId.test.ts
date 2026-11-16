import { describe, expect, it } from "vitest";

import { MOCK_SAMPLE_PROJECTS } from "@/mocks/handlers/projects";
import type { RunItem } from "@/types/run.type";

import { hasActiveRun } from "./useRunList";
import { matchV1Project } from "./useV1ProjectId";

describe("matchV1Project", () => {
  it("사이트 주소 host 가 같은 샘플 프로젝트를 찾는다", () => {
    expect(matchV1Project({ url: "https://banchanroad.example" }, MOCK_SAMPLE_PROJECTS)?.id).toBe(
      1,
    );
    expect(
      matchV1Project({ url: "https://BanchanRoad.example/shop" }, MOCK_SAMPLE_PROJECTS)?.id,
    ).toBe(1);
  });

  it("맞는 프로젝트가 없거나 주소가 잘못되면 undefined", () => {
    expect(matchV1Project({ url: "https://studio.example" }, MOCK_SAMPLE_PROJECTS)).toBeUndefined();
    expect(matchV1Project({ url: "not a url" }, MOCK_SAMPLE_PROJECTS)).toBeUndefined();
  });
});

describe("hasActiveRun", () => {
  const withStatus = (status: RunItem["status"]) => ({ status }) as RunItem;

  it("대기·실행·집계 중인 실행이 있을 때만 true", () => {
    expect(hasActiveRun([withStatus("completed"), withStatus("queued")])).toBe(true);
    expect(hasActiveRun([withStatus("finalizing")])).toBe(true);
    expect(
      hasActiveRun([withStatus("completed"), withStatus("cancelled"), withStatus("failed")]),
    ).toBe(false);
    expect(hasActiveRun([])).toBe(false);
  });
});
