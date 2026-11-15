import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { confirmPersonaRun, discoverPersonaPlan } from "@/apis/persona.api";
import { buildPath, ROUTES } from "@/constants/routes";
import { finishPersonaMock } from "@/mocks/personaMock";
import { useRetestStore } from "@/stores/useRetestStore";
import { renderWithProviders } from "@/test/renderWithProviders";
import type { Variant } from "@/types/persona.type";

import RetestPage from "./index";

async function completeRun(variant: Variant, tasks = ["order", "coupon"]) {
  const plan = await discoverPersonaPlan({ variant });
  await confirmPersonaRun({
    plan_id: plan.plan_id,
    feature_ids: ["shopping", "coupon"],
    task_ids: tasks,
    ages: ["any"],
    context: "",
    additional_request: "",
  });
  return finishPersonaMock().id!;
}

function renderRetest(runId: string, search = "") {
  return renderWithProviders(<RetestPage />, {
    route: `${buildPath("retest", { projectId: "banchan", runId })}${search}`,
    path: ROUTES.retest.path,
  });
}

beforeEach(() => {
  useRetestStore.setState({ byRunId: {} });
});

describe("P18 재테스트 전후 비교", () => {
  it("A(문제 버전)와 B(재테스트)의 달성률·단계·원인 변화를 비교한다", async () => {
    const a = await completeRun("problem");
    const b = await completeRun("fixed");
    useRetestStore
      .getState()
      .register(b, { baseRunId: a, name: "재테스트", note: "", autoCompare: false });
    renderRetest(a);

    expect(
      await screen.findByRole("heading", { level: 1, name: "1차 vs 2차 비교" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /A\s*1차/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /B\s*2차 · 재테스트/ })).toBeInTheDocument();

    /* 고친 사이트(mock fixed)라 목표 달성률이 오릅니다 */
    const goal = (await screen.findByText("목표 달성률 (예측)")).nextElementSibling!;
    expect(goal).toHaveTextContent(/\d+~\d+% → \d+~\d+%\+\d+%p/);

    const stages = screen.getByRole("table", { name: "단계별 도달 (A → B)" });
    expect(
      within(stages).getByRole("rowheader", { name: "첫 화면" }).parentElement,
    ).toHaveTextContent("100%100%0%p");
    expect(screen.getByRole("table", { name: "원인 분포 변화" })).toBeInTheDocument();
    expect(
      screen.getByText("같은 패널·시드로 재테스트한 결과만 원인 비교에 써요"),
    ).toBeInTheDocument();

    expect(screen.getByRole("link", { name: "리포트 A 열기" })).toHaveAttribute(
      "href",
      buildPath("report", { projectId: "banchan", runId: a }),
    );
    expect(screen.getByRole("link", { name: "리포트 B 열기" })).toHaveAttribute(
      "href",
      buildPath("report", { projectId: "banchan", runId: b }),
    );
  });

  it("두 실행에 모두 있는 과업만 고르고, 과업을 바꾸면 그 과업으로 비교한다", async () => {
    const user = userEvent.setup();
    const a = await completeRun("problem", ["order", "coupon"]);
    await completeRun("fixed", ["coupon"]);
    renderRetest(a);

    const chips = await screen.findByRole("radiogroup", { name: "비교할 과업" });
    expect(
      within(chips)
        .getAllByRole("radio")
        .map((chip) => chip.textContent?.trim()),
    ).toEqual(["쿠폰으로 주문"]);
    await user.click(within(chips).getByRole("radio", { name: "쿠폰으로 주문" }));
    expect(within(chips).getByRole("radio", { name: "쿠폰으로 주문" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("B 를 다른 실행으로 바꾸면 그 실행과 비교한다", async () => {
    const user = userEvent.setup();
    const a = await completeRun("problem");
    await completeRun("fixed");
    await completeRun("fixed");
    renderRetest(a);

    expect(await screen.findByRole("heading", { name: "1차 vs 2차 비교" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /B\s*2차/ }));
    /* A 로 고른 실행은 B 목록에 없습니다 */
    expect(screen.queryByRole("menuitemradio", { name: /1차/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("menuitemradio", { name: /3차/ }));

    expect(await screen.findByRole("heading", { name: "1차 vs 3차 비교" })).toBeInTheDocument();
  });

  it("E15 — 비교할 다른 실행이 없으면 재테스트를 안내한다", async () => {
    const a = await completeRun("problem");
    renderRetest(a);

    expect(
      await screen.findByRole("heading", { name: "비교할 테스트가 하나 더 필요해요" }),
    ).toBeInTheDocument();
    expect(screen.getByText("같은 패널·시드로 재테스트하면 비교할 수 있어요")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "수정 후 재테스트" })).toHaveAttribute(
      "href",
      `${buildPath("report", { projectId: "banchan", runId: a })}?retest=1`,
    );
  });
});

describe("P18 — 목록에 없는 실행", () => {
  it("A 를 모르면 다른 실행이 있어도 E15 대신 찾을 수 없다고 안내한다", async () => {
    await completeRun("problem");
    await completeRun("fixed");
    renderRetest("unknown-run");

    expect(
      await screen.findByRole("heading", { name: "비교할 실행을 찾을 수 없어요" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "테스트 목록으로" })).toBeInTheDocument();
  });
});
