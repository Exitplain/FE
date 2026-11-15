import { screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { confirmPersonaRun, discoverPersonaPlan } from "@/apis/persona.api";
import { buildPath, ROUTES } from "@/constants/routes";
import { server } from "@/mocks/node";
import { finishPersonaMock } from "@/mocks/personaMock";
import { renderWithProviders } from "@/test/renderWithProviders";

import SharedReportPage from "./index";

async function completeRun() {
  const plan = await discoverPersonaPlan({ variant: "problem" });
  await confirmPersonaRun({
    plan_id: plan.plan_id,
    feature_ids: ["shopping", "coupon"],
    task_ids: ["order", "coupon"],
    ages: ["any"],
    context: "",
    additional_request: "",
  });
  return finishPersonaMock().id!;
}

function renderShared(shareId: string, search = "") {
  return renderWithProviders(<SharedReportPage />, {
    route: `${buildPath("sharedReport", { shareId })}${search}`,
    path: ROUTES.sharedReport.path,
  });
}

describe("P21 공유 리포트 (읽기 전용)", () => {
  it("한눈에 보기 · 요약 · 퍼널 · Top 3 · 원인 · 히트맵 · 실측 비교를 앱 링크 없이 보여준다", async () => {
    const runId = await completeRun();
    renderShared(runId);

    expect(
      await screen.findByRole("heading", { level: 1, name: "반찬로드 모의 쇼핑몰 · 첫 주문" }),
    ).toBeInTheDocument();
    expect(screen.getByText("사전 테스트 리포트 · 예측")).toBeInTheDocument();
    expect(
      screen.getByText(/AI 고객 20명 × 시드 3회 · 과업 2개 \(첫 주문 외 1개\)/),
    ).toBeInTheDocument();

    const glance = screen.getByRole("region", { name: "한눈에 보기" });
    expect(within(glance).getAllByRole("listitem")).toHaveLength(3);
    expect(glance).toHaveTextContent(/목표 달성률 40~65% \(예측\)/);

    for (const name of [
      "1. 예측 퍼널",
      "2. 개선 우선순위 Top 3",
      "3. 이탈 원인 분포",
      "세그먼트 × 이탈 구간",
      "실측 비교 요약",
    ]) {
      expect(screen.getByRole("heading", { name })).toBeInTheDocument();
    }
    /* 히트맵은 펼친 채로, 접기 버튼 없음 */
    expect(screen.getByRole("table", { name: "세그먼트 × 이탈 구간 히트맵" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /세그먼트 \d+개 더 보기|접기/ })).toBeNull();
    /* 앱 안 화면(세션 상세·실측 분석·목업)으로 가는 링크·버튼이 없습니다 */
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "목업 비교" })).toBeNull();
    expect(screen.getByText("Exitplain · 읽기 전용 공유 리포트")).toBeInTheDocument();
  });

  it("공유한 사람이 고른 과업(?task=)을 보여준다", async () => {
    const runId = await completeRun();
    renderShared(runId, "?task=coupon");

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "반찬로드 모의 쇼핑몰 · 쿠폰으로 주문",
      }),
    ).toBeInTheDocument();
  });

  it("E17 — 없는 링크는 만료·해제 안내만 보여주고 리포트 내용을 남기지 않는다", async () => {
    renderShared("expired");

    expect(
      await screen.findByRole("heading", { name: "공유 링크가 만료됐거나 해제됐어요" }),
    ).toBeInTheDocument();
    expect(screen.getByText("공유한 사람에게 새 링크를 요청하세요")).toBeInTheDocument();
    expect(screen.queryByText("한눈에 보기")).toBeNull();
  });

  it("불러오지 못하면 다시 시도할 수 있다", async () => {
    server.use(http.get("*/api/personas/report", () => HttpResponse.error()));
    renderShared("run-1");

    expect(
      await screen.findByRole(
        "heading",
        { name: "공유 리포트를 불러오지 못했어요" },
        { timeout: 3000 },
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeInTheDocument();
  });
});

describe("P21 — 받는 사람이 할 수 없는 응답", () => {
  it("권한 없음(401)도 다시 시도 대신 만료 안내(E17)로 둔다", async () => {
    server.use(
      http.get("*/api/personas/report", () =>
        HttpResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }),
      ),
    );
    renderShared("run-1");

    expect(
      /* 리포트 조회는 404·409 밖의 오류를 한 번 다시 시도한 뒤 오류로 봅니다 */
      await screen.findByRole(
        "heading",
        { name: "공유 링크가 만료됐거나 해제됐어요" },
        { timeout: 3000 },
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "다시 시도" })).toBeNull();
  });
});
