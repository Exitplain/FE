import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { buildPath, ROUTES } from "@/constants/routes";
import { server } from "@/mocks/node";
import { renderWithProviders } from "@/test/renderWithProviders";
import type { ReportSessionDetail } from "@/types/report.type";

import SessionDetailPage from "./index";
import { sessionFixture } from "./sessionFixture";

const SESSION_URL = "*/api/v1/reports/:reportId/sessions/:taskId/:seed/:personaId";

/* 실행 run-1 의 리포트 id 는 report-1, 세션 상세는 주어진 응답. 받은 주소 값을 돌려줍니다 */
function serve(detail: ReportSessionDetail | Response) {
  const requested: Record<string, unknown>[] = [];
  server.use(
    http.get("*/api/v1/runs/run-1/reports", () => HttpResponse.json({ report_id: "report-1" })),
    http.get(SESSION_URL, ({ params }) => {
      requested.push({ ...params });
      return detail instanceof Response ? detail : HttpResponse.json(detail);
    }),
  );
  return requested;
}

const productError = (status: number, code: string) =>
  HttpResponse.json({ error: { code, message: code, fields: {} } }, { status });

function renderSession(search = "") {
  const path = buildPath("sessionDetail", {
    projectId: "1",
    runId: "run-1",
    taskId: "order",
    seed: "2",
    personaId: "P-007",
  });
  return renderWithProviders(<SessionDetailPage />, {
    route: `${path}${search}`,
    path: ROUTES.sessionDetail.path,
  });
}

describe("P15·P16 세션 상세 (제품 API)", () => {
  it("P15 이탈 — 서버가 준 원인·좌절 점수·스텝으로 요약을 그리고 질문하기는 보여 주지 않는다", async () => {
    const requested = serve(sessionFixture());
    renderSession();

    /* 리포트 → 세션 두 번 받아 첫 화면이 늦을 수 있어 넉넉히 기다립니다 */
    expect(
      await screen.findByRole(
        "heading",
        { level: 1, name: "P-007 · 세션 상세" },
        { timeout: 3000 },
      ),
    ).toBeInTheDocument();
    /* 실행의 리포트 id 와 주소의 세션 키로 조회합니다 */
    expect(requested[0]).toMatchObject({
      reportId: "report-1",
      taskId: "order",
      seed: "2",
      personaId: "P-007",
    });
    expect(
      screen.getByText("신중한 첫 방문형 · 첫 주문 · 시드 2 · 3스텝 · 3분 05초"),
    ).toBeInTheDocument();
    expect(screen.getByText("이탈 원인").nextElementSibling).toHaveTextContent("입력 부담");
    expect(screen.getByText("좌절 점수").nextElementSibling).toHaveTextContent("80 / 임계치 70");
    expect(screen.queryByRole("tab", { name: /질문/ })).not.toBeInTheDocument();
    expect(screen.queryByText("이 세션에 질문하기")).not.toBeInTheDocument();
  });

  it("P15c·P15b — 타임라인 썸네일은 제품 API 캡처 주소로 그리고 크게 볼 수 있다", async () => {
    const user = userEvent.setup();
    serve(sessionFixture());
    renderSession("?tab=timeline");

    const list = await screen.findByRole("list", { name: "스텝" });
    expect(within(list).getByRole("img", { name: "스텝 3 화면" })).toHaveAttribute(
      "src",
      "/api/v1/sessions/7/final-screenshot",
    );

    await user.click(screen.getByRole("button", { name: "스텝 1 화면 크게 보기" }));
    const dialog = screen.getByRole("dialog", { name: "진단 시점의 화면 · 스텝 1" });
    expect(within(dialog).getByRole("img")).toHaveAttribute(
      "src",
      "/api/v1/observations/1/screenshot",
    );
  });

  it("E06 — 사이트 접속 실패 세션은 탭 없이 오류 안내를 보여 준다", async () => {
    serve(sessionFixture({ status: "site_failure", primary_cause: null }));
    renderSession();

    expect(await screen.findByRole("heading", { name: "세션 오류" })).toBeInTheDocument();
    expect(screen.getByText("사이트에 접속하지 못해 세션을 끝냈어요")).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });

  it("세션 기록이 지워졌으면(409) 리포트로 안내한다", async () => {
    serve(productError(409, "SESSION_FILES_MISSING"));
    renderSession();

    expect(
      await screen.findByRole("heading", { name: "세션 기록이 남아 있지 않아요" }),
    ).toBeInTheDocument();
    /* 머리의 버튼 + 오류 안내의 버튼 */
    expect(screen.getAllByRole("link", { name: "리포트로 돌아가기" })).toHaveLength(2);
  });
});
