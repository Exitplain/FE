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

  it("계획을 받으면 서버 계획의 기본 과업(추천)과 세그먼트 인원을 미리 고른다", () => {
    const { server } = setPlan();

    expect(useNewTestStore.getState().taskIds).toEqual(server.task_ids);
    expect(useNewTestStore.getState().segmentCounts).toEqual([5, 5, 5, 5]);
  });

  it("다시 계획을 받아도 합계가 서버 총원과 같으면 조정한 세그먼트 인원을 유지한다", () => {
    setPlan();
    useNewTestStore.getState().setSegmentCount(0, 8);
    useNewTestStore.getState().setSegmentCount(1, 2);
    setPlan();
    expect(useNewTestStore.getState().segmentCounts).toEqual([8, 2, 5, 5]);

    useNewTestStore.getState().setSegmentCount(0, 9);
    setPlan();
    expect(useNewTestStore.getState().segmentCounts).toEqual([5, 5, 5, 5]);
  });

  it("세그먼트 인원은 1명 아래로 내려가지 않는다 (서버 최소 1명)", () => {
    useNewTestStore.getState().setSegmentCount(0, 0);
    expect(useNewTestStore.getState().segmentCounts[0]).toBe(1);
  });

  it("다시 탐색하면 이전에 고른 과업 중 새 결과에 있는 것은 유지한다", () => {
    setPlan();
    /* 추천(order·coupon) 중 order 를 끄고 cart 를 켭니다 */
    useNewTestStore.getState().toggleTask("cart");
    useNewTestStore.getState().toggleTask("order");
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
