import { beforeEach, describe, expect, it } from "vitest";

import type { DiscoverResponse } from "@/types/persona.type";

import { useNewTestStore } from "./useNewTestStore";

const plan = {
  plan_id: "plan-1",
  tasks: [
    { id: "order", suggested: true },
    { id: "cart", suggested: false },
  ],
} as DiscoverResponse;

describe("useNewTestStore", () => {
  beforeEach(() => useNewTestStore.getState().reset("banchan", "https://banchanroad.example"));

  it("프로젝트를 바꾸면 입력을 처음으로 돌린다", () => {
    useNewTestStore.getState().setPlan(plan, 1);
    useNewTestStore.getState().reset("studio", "https://studio.example");

    expect(useNewTestStore.getState()).toMatchObject({
      projectId: "studio",
      siteUrl: "https://studio.example",
      plan: null,
      taskIds: [],
    });
  });

  it("탐색 결과를 받으면 추천 과업을 미리 고른다", () => {
    useNewTestStore.getState().setPlan(plan, 1);

    expect(useNewTestStore.getState().taskIds).toEqual(["order"]);
    expect(useNewTestStore.getState().discoveredAt).toBe(1);
  });

  it("주소나 데모 버전을 바꾸면 이전 탐색 결과를 버린다", () => {
    useNewTestStore.getState().setPlan(plan, 1);
    useNewTestStore.getState().setSiteUrl("https://other.example");

    expect(useNewTestStore.getState().plan).toBeNull();

    useNewTestStore.getState().setPlan(plan, 1);
    useNewTestStore.getState().setVariant("fixed");
    expect(useNewTestStore.getState().plan).toBeNull();
  });

  it("직접 추가한 과업은 앞뒤 공백을 지우고 중복 없이 쌓는다", () => {
    const { addCustomTask } = useNewTestStore.getState();
    addCustomTask(" 배송지 바꾸기 ");
    addCustomTask("배송지 바꾸기");
    addCustomTask("  ");

    expect(useNewTestStore.getState().customTasks).toEqual(["배송지 바꾸기"]);
  });

  it("과업을 켜고 끈다", () => {
    useNewTestStore.getState().toggleTask("order");
    useNewTestStore.getState().toggleTask("cart");
    useNewTestStore.getState().toggleTask("order");

    expect(useNewTestStore.getState().taskIds).toEqual(["cart"]);
  });
});
