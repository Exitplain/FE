import { beforeEach, describe, expect, it } from "vitest";

import { useNewTestStore } from "./useNewTestStore";

const accounts = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ username: `u${i}@x.example`, password: "pw" }));

describe("useNewTestStore — 세그먼트 인원 (P05b·P05h)", () => {
  beforeEach(() => useNewTestStore.getState().reset("banchan", "https://banchanroad.example"));

  it("패널 인원이 그대로면 사용자가 조정한 비율을 지키고, 바뀌면 다시 나눈다", () => {
    const store = useNewTestStore.getState();
    store.setSegmentCount(0, 8);
    store.setSegmentCount(1, 4);
    store.setSegmentCount(2, 4);
    store.setSegmentCount(3, 4);

    /* 같은 모드 다시 고르기 · 계정 0개로 계정 모드(패널 20 그대로) */
    store.setLoginMode("none");
    store.setLoginMode("account");
    expect(useNewTestStore.getState().segmentCounts).toEqual([8, 4, 4, 4]);

    /* 계정 8개 → 패널 8명으로 바뀜 */
    store.setAccounts(accounts(8));
    expect(useNewTestStore.getState().segmentCounts).toEqual([2, 2, 2, 2]);

    /* 같은 수의 계정을 다시 저장해도 유지 */
    store.setSegmentCount(0, 3);
    store.setSegmentCount(3, 1);
    store.setAccounts(accounts(8));
    expect(useNewTestStore.getState().segmentCounts).toEqual([3, 2, 2, 1]);
  });
});
