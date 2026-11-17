import { screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { confirmPersonaRun, discoverPersonaPlan } from "@/apis/persona.api";
import { createShareLink, getRunReport } from "@/apis/report.api";
import { buildPath, ROUTES } from "@/constants/routes";
import { reportErrorHandlers } from "@/mocks/handlers/reports";
import { server } from "@/mocks/node";
import { finishPersonaMock } from "@/mocks/personaMock";
import { cannedReport } from "@/pages/report/reportFixture";
import { renderWithProviders } from "@/test/renderWithProviders";

import SharedReportPage from "./index";

/* 실행을 끝내고 그 리포트의 공유 링크 토큰을 만듭니다 (mock) */
async function sharedToken() {
  const plan = await discoverPersonaPlan({ variant: "problem" });
  await confirmPersonaRun({
    plan_id: plan.plan_id,
    feature_ids: ["shopping", "coupon"],
    task_ids: ["order", "coupon"],
    ages: ["any"],
    context: "",
    additional_request: "",
  });
  const report = await getRunReport(finishPersonaMock().id!);
  return (await createShareLink(report.report_id)).token;
}

function renderShared(shareId: string, search = "") {
  return renderWithProviders(<SharedReportPage />, {
    route: `${buildPath("sharedReport", { shareId })}${search}`,
    path: ROUTES.sharedReport.path,
  });
}

/* 정해 둔 리포트 숫자로 확인할 때 (GET /api/v1/shared/{token}) */
function serveShared() {
  const report: Partial<ReturnType<typeof cannedReport>> = cannedReport();
  /* 공유 응답은 report_dict 그대로라 revisions 가 없습니다 */
  delete report.revisions;
  server.use(
    http.get("*/api/v1/shared/:token", () =>
      HttpResponse.json({
        ...report,
        shared: true,
        expires_at: "2026-11-14T05:20:00+00:00",
        project: { name: "반찬로드 데모" },
        run: { name: "3차·첫 주문 외 1개" },
      }),
    ),
  );
}

describe("P21 공유 리포트 (GET /api/v1/shared/{token}, 로그인 없이)", () => {
  it("공유 링크 토큰으로 리포트를 받아 프로젝트·과업을 제목으로 보여준다", async () => {
    renderShared(await sharedToken());

    expect(
      await screen.findByRole("heading", { level: 1, name: "반찬로드 · 첫 주문" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "예측 퍼널" })).toBeInTheDocument();
  });

  it("한눈에 보기 · 요약 · 퍼널 · 원인 · 히트맵을 앱 링크 없이 보여준다", async () => {
    serveShared();
    renderShared("token-1");

    expect(
      await screen.findByRole("heading", { level: 1, name: "반찬로드 데모 · 첫 주문" }),
    ).toBeInTheDocument();
    expect(screen.getByText("사전 테스트 리포트 · 예측")).toBeInTheDocument();
    expect(
      screen.getByText("11월 7일 · AI 고객 20명 × 시드 3회 · 과업 2개 (첫 주문 외 1개)"),
    ).toBeInTheDocument();

    const glance = screen.getByRole("region", { name: "한눈에 보기" });
    expect(within(glance).getAllByRole("listitem")).toHaveLength(3);
    expect(glance).toHaveTextContent("목표 달성률 45~55% (예측)");
    expect(glance).toHaveTextContent("유효 세션 58개 중 30개가 목표에 도달했어요");
    expect(glance).toHaveTextContent("가장 많이 떠난 구간 · 장바구니 → 가입");
    expect(glance).toHaveTextContent("가장 많은 이탈 원인 · 입력 부담");

    for (const name of ["1. 예측 퍼널", "2. 이탈 원인 분포", "세그먼트 × 이탈 구간"]) {
      expect(screen.getByRole("heading", { name })).toBeInTheDocument();
    }
    /* 히트맵은 펼친 채로, 접기 버튼 없음 */
    expect(screen.getByRole("table", { name: "세그먼트 × 이탈 구간 히트맵" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /세그먼트 \d+개 더 보기|접기/ })).toBeNull();
    /* 앱 안 화면으로 가는 링크가 없고, v1 에 없는 Top 3·실측 비교도 없습니다 */
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(screen.queryByText(/개선 우선순위/)).toBeNull();
    expect(
      screen.getByText("Exitplain · 읽기 전용 공유 리포트 · 11월 14일까지"),
    ).toBeInTheDocument();
  });

  it("공유한 사람이 고른 과업(?task=)을 보여준다", async () => {
    serveShared();
    renderShared("token-1", "?task=coupon");

    expect(
      await screen.findByRole("heading", { level: 1, name: "반찬로드 데모 · 쿠폰으로 주문" }),
    ).toBeInTheDocument();
  });

  it("E17 — 없거나 취소된 링크(404)는 만료·해제 안내만 보여주고 리포트 내용을 남기지 않는다", async () => {
    renderShared("unknown-token");

    expect(
      await screen.findByRole("heading", { name: "공유 링크가 만료됐거나 해제됐어요" }),
    ).toBeInTheDocument();
    expect(screen.getByText("공유한 사람에게 새 링크를 요청하세요")).toBeInTheDocument();
    expect(screen.queryByText("한눈에 보기")).toBeNull();
  });

  it("E17 — 만료된 링크(410 SHARE_LINK_EXPIRED)도 만료 안내로 둔다", async () => {
    server.use(reportErrorHandlers.sharedExpired);
    renderShared("token-1");

    expect(
      await screen.findByRole("heading", { name: "공유 링크가 만료됐거나 해제됐어요" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "다시 시도" })).toBeNull();
  });

  it("불러오지 못하면 다시 시도할 수 있다", async () => {
    server.use(http.get("*/api/v1/shared/:token", () => HttpResponse.error()));
    renderShared("token-1");

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
