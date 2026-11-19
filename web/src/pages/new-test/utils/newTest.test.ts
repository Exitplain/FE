import { describe, expect, it } from "vitest";

import {
  confirmPlan,
  createDiscovery,
  createPlan,
  patchPlan,
  revisionPersonas,
} from "@/mocks/planMock";
import { ApiError } from "@/types/api.type";

import {
  agentRange,
  ageSummary,
  clampStep,
  confirmFixStep,
  evenSplit,
  findDuplicateUsernames,
  furthestAllowedStep,
  isDiscoveryExpiredError,
  isPlanExpired,
  panelSize,
  parseAccountsText,
  parseStep,
  segmentsPatch,
  segmentTotalMessage,
  sum,
  taskTargetPatch,
  toggleAge,
  toggleAgeChip,
  toPanelSegments,
  toWizardPlan,
  loginUrlPlaceholder,
  validateLoginUrl,
  validateSiteUrl,
} from "./newTest";

/* mock 서버로 만든 탐색 결과 + 계획 */
function wizardPlan() {
  const discovery = createDiscovery(1, {});
  const server = createPlan(1, { discovery_id: discovery.id });
  return { discovery, server, plan: toWizardPlan(discovery, server, null) };
}

describe("validateSiteUrl (E07)", () => {
  it.each(["https://banchanroad.example", "http://localhost:4173/"])("%s 는 통과", (url) => {
    expect(validateSiteUrl(url)).toBeNull();
  });

  it.each([
    ["", "제품 URL 을 입력해 주세요"],
    ["banchanroad", "URL 형식이 아니에요 · https://로 시작하는 주소를 넣어주세요"],
    ["ftp://example.com", "URL 형식이 아니에요 · https://로 시작하는 주소를 넣어주세요"],
    ["https://", "URL 형식이 아니에요 · https://로 시작하는 주소를 넣어주세요"],
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

describe("toWizardPlan — 탐색 결과 + 서버 계획", () => {
  it("id·revision·만료 시각과 과업별 이동 단계 수·연령 이름을 모은다", () => {
    const { discovery, server, plan } = wizardPlan();

    expect(plan).toMatchObject({
      planId: server.id,
      revision: 1,
      discoveryId: discovery.id,
      expiresAt: Date.parse(discovery.expires_at),
      loginMode: "none",
      personaTotal: 10,
      personaMin: 4,
      personaMax: 20,
      segmentIds: ["segment_1", "segment_2", "segment_3", "segment_4"],
      seedCount: 1,
      seedRange: { min: 1, max: 3 },
    });
    expect(plan.tasks.find((task) => task.id === "order")?.funnel_stages).toBe(7);
    expect(plan.age_options["50plus"]).toBe("50대 이상");
  });
});

describe("계획 저장 본문 (PATCH /api/v1/plans/{id})", () => {
  it("과업은 탐색 결과에 있는 것만 화면 순서대로, 타겟·메모는 앞뒤 공백을 지운다", () => {
    const { plan } = wizardPlan();
    const body = taskTargetPatch(plan, {
      taskIds: ["coupon", "직접 추가한 과업", "order"],
      customTasks: ["배송지 바꾸기"],
      memo: " 쿠폰 적용 후 총액 ",
      targetDescription: "  퇴근 후 첫 주문  ",
      ages: ["30s", "50plus"],
    });

    expect(body).toEqual({
      task_ids: ["order", "coupon"],
      custom_tasks: ["배송지 바꾸기"],
      additional_request: "쿠폰 적용 후 총액",
      audience: { context: "퇴근 후 첫 주문", ages: ["30s", "50plus"] },
    });
  });

  it("세그먼트는 서버 segment_ids 순서로 4개", () => {
    const { plan } = wizardPlan();
    expect(segmentsPatch(plan, [8, 4, 4, 4])).toEqual({
      segments: [
        { id: "segment_1", count: 8 },
        { id: "segment_2", count: 4 },
        { id: "segment_3", count: 4 },
        { id: "segment_4", count: 4 },
      ],
    });
  });

  it("반복은 서버 계획 값과 다를 때만 limits 로 함께 싣는다", () => {
    const { plan } = wizardPlan();
    expect(segmentsPatch(plan, [3, 3, 2, 2], 1)).not.toHaveProperty("limits");
    expect(segmentsPatch(plan, [3, 3, 2, 2], 2)).toMatchObject({ limits: { seed_count: 2 } });
  });
});

describe("toPanelSegments — P07 세그먼트 카드", () => {
  it("확정한 페르소나에서 세그먼트 이름·인원·대표·코드 범위·행동 변수를 만든다", () => {
    const { server } = wizardPlan();
    patchPlan(server.id, '"1"', { audience: { context: "첫 방문자", ages: [] } });
    const snapshot = confirmPlan(server.id, { revision: 2 });
    const [first, second] = toPanelSegments(revisionPersonas(snapshot.plan_revision_id));

    expect(first).toEqual({
      id: "segment_1",
      name: "빠른 구매형",
      count: 3,
      codes: ["P-001", "P-003"],
      representative: "P-001",
      traits: { patience: 22, digital: 80, price: 40, trust: 30 },
    });
    expect(second.codes).toEqual(["P-004", "P-006"]);
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

describe("isPlanExpired — 탐색 결과의 expires_at", () => {
  it("만료 시각이 되면 만료", () => {
    expect(isPlanExpired(10_000, 9_999)).toBe(false);
    expect(isPlanExpired(10_000, 10_000)).toBe(true);
  });
});

describe("furthestAllowedStep · clampStep — 앞 단계를 건너뛰지 않게", () => {
  it("탐색 결과가 없으면 사이트, 과업·타겟이 비면 과업, 다 있으면 확인까지", () => {
    expect(furthestAllowedStep({ hasPlan: false, taskCount: 2, targetDescription: "x" })).toBe(
      "site",
    );
    expect(furthestAllowedStep({ hasPlan: true, taskCount: 0, targetDescription: "x" })).toBe(
      "task",
    );
    expect(furthestAllowedStep({ hasPlan: true, taskCount: 1, targetDescription: "  " })).toBe(
      "task",
    );
    expect(furthestAllowedStep({ hasPlan: true, taskCount: 1, targetDescription: "x" })).toBe(
      "confirm",
    );
  });

  it("요청한 단계가 갈 수 있는 단계보다 뒤면 갈 수 있는 단계로", () => {
    expect(clampStep("confirm", "task")).toBe("task");
    expect(clampStep("task", "confirm")).toBe("task");
  });
});

describe("isDiscoveryExpiredError", () => {
  it("DISCOVERY_EXPIRED 코드나 blocking 목록의 만료만 만료로 본다", () => {
    const expired = new ApiError({ status: 409, message: "", code: "DISCOVERY_EXPIRED" });
    const blocked = new ApiError({
      status: 409,
      message: "",
      code: "NO_AUDIENCE",
      fields: { blocking: ["NO_AUDIENCE", "DISCOVERY_EXPIRED"] },
    });
    const other = new ApiError({ status: 409, message: "", code: "NO_AUDIENCE" });

    expect(isDiscoveryExpiredError(expired)).toBe(true);
    expect(isDiscoveryExpiredError(blocked)).toBe(true);
    expect(isDiscoveryExpiredError(other)).toBe(false);
    expect(isDiscoveryExpiredError(new Error("x"))).toBe(false);
  });
});

describe("confirmFixStep — 확정 409 를 고칠 단계", () => {
  it("계정 부족·계정 수 변경은 1단계, 과업·타겟은 2단계, 세그먼트 합계는 3단계, 그 밖은 다시 시도(null)", () => {
    const conflict = (code: string, blocking?: string[]) =>
      new ApiError({ status: 409, message: "", code, fields: blocking ? { blocking } : {} });

    expect(confirmFixStep(conflict("TEST_ACCOUNT_COUNT_MISMATCH"))).toBe("site");
    expect(confirmFixStep(conflict("SEGMENT_TOTAL", ["SEGMENT_TOTAL"]))).toBe("persona");
    /* 여러 이유면 앞 단계부터 */
    expect(confirmFixStep(conflict("NO_TASKS", ["NO_TASKS", "SEGMENT_TOTAL"]))).toBe("task");
    expect(
      confirmFixStep(conflict("SEGMENT_TOTAL", ["SEGMENT_TOTAL", "TEST_ACCOUNTS_REQUIRED"])),
    ).toBe("site");
    expect(confirmFixStep(conflict("ALREADY_CONFIRMED"))).toBeNull();
    expect(
      confirmFixStep(
        new ApiError({ status: 503, message: "", code: "TEST_ACCOUNT_COUNT_MISMATCH" }),
      ),
    ).toBeNull();
  });
});

describe("parseStep — ?step= 쿼리", () => {
  it("알 수 없는 값은 첫 단계", () => {
    expect(parseStep("task")).toBe("task");
    expect(parseStep(null)).toBe("site");
    expect(parseStep("unknown")).toBe("site");
  });
});

describe("패널 (P05b·P05h)", () => {
  it("계획 전에는 로그인 테스트면 계정 수만큼(최대 20), 아니면 10명으로 짐작한다", () => {
    expect(panelSize("none", 8)).toBe(10);
    expect(panelSize("account", 8)).toBe(8);
    expect(panelSize("account", 0)).toBe(10);
    expect(panelSize("account", 30)).toBe(20);
  });

  it("확정할 수 있는 인원 — 계획이 있으면 서버 범위, 없으면 로그인 없이 4~20명 · 계정 수 하나", () => {
    const { plan } = wizardPlan();
    expect(agentRange(plan, "none", 0)).toEqual({ min: 4, max: 20, total: 10 });
    expect(agentRange(null, "none", 0)).toEqual({ min: 4, max: 20, total: 10 });
    expect(agentRange(null, "account", 8)).toEqual({ min: 8, max: 8, total: 8 });
  });

  it("합계 안내는 BE 422 문구와 같다", () => {
    expect(segmentTotalMessage(21, { min: 4, max: 20 })).toBe(
      "합계를 4~20명 사이로 맞춰주세요 · 지금 21명",
    );
    expect(segmentTotalMessage(9, { min: 8, max: 8 })).toBe(
      "합계가 8명이 되도록 맞춰주세요 · 지금 9명",
    );
  });

  it("인원을 세그먼트 4개에 고르게 나눈다", () => {
    expect(evenSplit(20)).toEqual([5, 5, 5, 5]);
    expect(evenSplit(7)).toEqual([2, 2, 2, 1]);
    expect(sum(evenSplit(19))).toBe(19);
  });

  it("세그먼트 합계가 틀리면 시작 전 확인으로 가지 못한다", () => {
    expect(
      furthestAllowedStep({
        hasPlan: true,
        taskCount: 1,
        targetDescription: "첫 방문",
        segmentsValid: false,
      }),
    ).toBe("persona");
  });

  it("연령은 서버 연령 이름으로 요약한다 (없거나 전체면 전체)", () => {
    expect(ageSummary(["any"], {})).toBe("전체");
    expect(ageSummary([], {})).toBe("전체");
    expect(ageSummary(["30s", "50plus"], { "30s": "30대", "50plus": "50대 이상" })).toBe(
      "30대, 50대 이상",
    );
  });
});

describe("toggleAgeChip (Figma 연령 칩)", () => {
  it("50대 이상(50plus) 칩을 켜고 끈다", () => {
    expect(toggleAgeChip(["any"], ["50plus"])).toEqual(["50plus"]);
    expect(toggleAgeChip(["20s", "50plus"], ["50plus"])).toEqual(["20s"]);
    expect(toggleAgeChip(["50plus"], ["50plus"])).toEqual(["any"]);
  });

  it("전체는 단독으로만 고른다", () => {
    expect(toggleAgeChip(["30s"], ["any"])).toEqual(["any"]);
  });
});

describe("validateLoginUrl", () => {
  it("로그인 화면 주소는 비울 수 없고 http(s) 주소여야 한다", () => {
    expect(validateLoginUrl("")).toBe("로그인 화면 주소를 입력해 주세요");
    expect(validateLoginUrl("lecq.co.kr/login")).not.toBeNull();
    expect(validateLoginUrl(" https://lecq.co.kr/login ")).toBeNull();
    expect(loginUrlPlaceholder("https://lecq.co.kr/home?x=1")).toBe("https://lecq.co.kr/login");
    expect(loginUrlPlaceholder("")).toBe("https://example.com/login");
  });
});
