import { beforeEach, describe, expect, it } from "vitest";

import { createDiscovery, createPlan } from "@/mocks/planMock";
import { toWizardPlan } from "@/pages/new-test/utils/newTest";

import { useNewTestStore } from "./useNewTestStore";

/* mock 서버로 만든 탐색 결과 + 계획 (추천 과업: 첫 주문·쿠폰) */
function newPlan() {
  const discovery = createDiscovery(1, {});
  const server = createPlan(1, { discovery_id: discovery.id });
  return { plan: toWizardPlan(discovery, server, null), server };
}

function setPlan() {
  const { plan, server } = newPlan();
  useNewTestStore.getState().setPlan(plan, server);
  return { plan, server };
}

describe("useNewTestStore", () => {
  beforeEach(() => useNewTestStore.getState().reset("banchan", "https://banchanroad.example"));

  it("프로젝트를 바꾸면 입력을 처음으로 돌린다", () => {
    setPlan();
    useNewTestStore.getState().reset("studio", "https://studio.example");

    expect(useNewTestStore.getState()).toMatchObject({
      projectId: "studio",
      siteUrl: "https://studio.example",
      plan: null,
      taskIds: [],
    });
  });

  it("계획을 받으면 과업은 고르지 않은 채로 두고 세그먼트 인원은 서버 기본값으로 고른다", () => {
    const { server } = setPlan();

    /* 서버 계획에 기본 과업(추천)이 있어도 미리 고르지 않습니다 */
    expect(server.task_ids.length).toBeGreaterThan(0);
    expect(useNewTestStore.getState().taskIds).toEqual([]);
    expect(useNewTestStore.getState().segmentCounts).toEqual([3, 3, 2, 2]);
    expect(useNewTestStore.getState().seedCount).toBe(1);
  });

  it("다시 계획을 받아도 합계가 서버 범위(4~20명) 안이면 조정한 세그먼트 인원을 유지한다", () => {
    setPlan();
    useNewTestStore.getState().setSegmentCount(0, 8);
    setPlan();
    expect(useNewTestStore.getState().segmentCounts).toEqual([8, 3, 2, 2]);

    useNewTestStore.getState().setSegmentCount(0, 14);
    setPlan();
    expect(useNewTestStore.getState().segmentCounts).toEqual([3, 3, 2, 2]);
  });

  it("반복은 계획을 다시 받거나 만료로 지운 뒤 새로 받아도 고른 값을 유지하고, 서버 범위로 맞춘다", () => {
    setPlan();
    useNewTestStore.getState().setSeedCount(3);
    setPlan();
    expect(useNewTestStore.getState().seedCount).toBe(3);

    useNewTestStore.getState().clearPlan();
    setPlan();
    expect(useNewTestStore.getState().seedCount).toBe(3);

    const { plan, server } = newPlan();
    useNewTestStore.getState().setPlan({ ...plan, seedRange: { min: 1, max: 2 } }, server);
    expect(useNewTestStore.getState().seedCount).toBe(2);
  });

  it("세그먼트 인원은 1명 아래로 내려가지 않는다 (서버 최소 1명)", () => {
    useNewTestStore.getState().setSegmentCount(0, 0);
    expect(useNewTestStore.getState().segmentCounts[0]).toBe(1);
  });

  it("다시 탐색하면 이전에 고른 과업 중 새 결과에 있는 것은 유지한다", () => {
    setPlan();
    /* 새 결과에 없는 과업("gone")은 다시 탐색하면 빠집니다 */
    useNewTestStore.getState().toggleTask("coupon");
    useNewTestStore.getState().toggleTask("gone");
    useNewTestStore.getState().toggleTask("cart");
    setPlan();

    expect(useNewTestStore.getState().taskIds).toEqual(["coupon", "cart"]);
  });

  it("로그인 없이로 바꾸면 테스트 계정을 지운다", () => {
    useNewTestStore.getState().setLoginMode("account");
    useNewTestStore.getState().setAccounts([{ username: "a", password: "b" }]);
    useNewTestStore.getState().setLoginMode("none");

    expect(useNewTestStore.getState().accounts).toEqual([]);
  });

  it("주소나 데모 버전을 바꾸면 이전 탐색 결과를 버린다", () => {
    setPlan();
    useNewTestStore.getState().setSiteUrl("https://other.example");

    expect(useNewTestStore.getState().plan).toBeNull();

    setPlan();
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
