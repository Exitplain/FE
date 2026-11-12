import { describe, expect, it } from "vitest";

import { DISCOVER_TASKS, FEATURES } from "@/mocks/fixtures/personas";
import type { DiscoverResponse } from "@/types/persona.type";

import {
  buildConfirmRequest,
  findDuplicateUsernames,
  isPlanExpired,
  parseAccountsText,
  parseStep,
  PLAN_TTL_MS,
  toggleAge,
  validateSiteUrl,
} from "./newTest";

const plan: DiscoverResponse = {
  project: "반찬로드",
  plan_id: "plan-1",
  variant: "problem",
  features: FEATURES,
  tasks: DISCOVER_TASKS,
  age_options: {},
  note: "",
};

describe("validateSiteUrl (E07)", () => {
  it.each(["https://banchanroad.example", "http://localhost:4173/"])("%s 는 통과", (url) => {
    expect(validateSiteUrl(url)).toBeNull();
  });

  it.each([
    ["", "제품 URL 을 입력해 주세요"],
    ["banchanroad", "https:// 로 시작하는 주소를 입력해 주세요"],
    ["ftp://example.com", "https:// 로 시작하는 주소를 입력해 주세요"],
    ["https://", "https:// 로 시작하는 주소를 입력해 주세요"],
  ])("%j → %s", (url, message) => {
    expect(validateSiteUrl(url)).toBe(message);
  });
});

describe("toggleAge — 전체 연령은 다른 연령과 함께 고를 수 없다", () => {
  it("연령을 켜고 끈다", () => {
    expect(toggleAge(["30s"], "40s")).toEqual(["30s", "40s"]);
    expect(toggleAge(["30s", "40s"], "30s")).toEqual(["40s"]);
  });

  it("전체를 고르면 나머지를 지우고, 특정 연령을 고르면 전체를 지운다", () => {
    expect(toggleAge(["30s", "40s"], "any")).toEqual(["any"]);
    expect(toggleAge(["any"], "20s")).toEqual(["20s"]);
  });

  it("마지막 연령을 끄면 전체로 돌아간다 (BE 는 빈 목록을 받지 않음)", () => {
    expect(toggleAge(["30s"], "30s")).toEqual(["any"]);
    expect(toggleAge(["any"], "any")).toEqual(["any"]);
  });
});

describe("buildConfirmRequest — BE confirm 여섯 필드", () => {
  it("고른 과업에서 기능을 계산하고, 화면 순서대로 정렬한다", () => {
    const body = buildConfirmRequest(plan, {
      taskIds: ["coupon", "order"],
      ages: ["30s"],
      targetDescription: "  퇴근 후 첫 주문  ",
      memo: "쿠폰 적용 후 총액",
    });

    expect(body).toEqual({
      plan_id: "plan-1",
      feature_ids: ["shopping", "coupon"],
      task_ids: ["order", "coupon"],
      ages: ["30s"],
      context: "퇴근 후 첫 주문",
      additional_request: "쿠폰 적용 후 총액",
    });
  });

  it("탐색 결과에 없는 과업은 보내지 않는다", () => {
    const body = buildConfirmRequest(plan, {
      taskIds: ["order", "직접 추가한 과업"],
      ages: ["any"],
      targetDescription: "",
      memo: "",
    });

    expect(body.task_ids).toEqual(["order"]);
  });
});

describe("parseAccountsText (P04d 붙여넣기)", () => {
  it("쉼표·탭으로 나뉜 줄을 계정으로 읽고 머리글·빈 줄은 건너뛴다", () => {
    const result = parseAccountsText(
      "아이디,비밀번호\ntest01@banchan.example,pw1\n\ntest02@banchan.example\tpw2\n",
    );

    expect(result.accounts).toEqual([
      { username: "test01@banchan.example", password: "pw1" },
      { username: "test02@banchan.example", password: "pw2" },
    ]);
    expect(result.invalidLines).toEqual([]);
  });

  it("비밀번호가 없는 줄은 몇 번째 줄인지 알려준다", () => {
    expect(parseAccountsText("a@x.example\nb@x.example,pw").invalidLines).toEqual([1]);
  });
});

describe("findDuplicateUsernames (P04c 중복)", () => {
  it("같은 아이디가 두 번 이상 나온 행 번호를 돌려준다", () => {
    const rows = [
      { username: "a@x.example", password: "1" },
      { username: "b@x.example", password: "2" },
      { username: " A@x.example ", password: "3" },
    ];

    expect(findDuplicateUsernames(rows)).toEqual(new Set([0, 2]));
  });
});

describe("isPlanExpired — 탐색 계획은 15분", () => {
  it("15분이 지나면 만료", () => {
    expect(isPlanExpired(1_000, 1_000 + PLAN_TTL_MS - 1)).toBe(false);
    expect(isPlanExpired(1_000, 1_000 + PLAN_TTL_MS)).toBe(true);
  });
});

describe("parseStep — ?step= 쿼리", () => {
  it("알 수 없는 값은 첫 단계", () => {
    expect(parseStep("task")).toBe("task");
    expect(parseStep(null)).toBe("site");
    expect(parseStep("unknown")).toBe("site");
  });
});
