import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { server } from "@/mocks/node";
import { issueFixture, issueList } from "@/test/issues";
import { renderWithProviders } from "@/test/renderWithProviders";

import IssuesPage from ".";

describe("W03 발견한 문제 (GET /api/v1/issues)", () => {
  it("원인 필터와 상세 열기·닫기가 동작한다", async () => {
    const user = userEvent.setup();
    server.use(
      http.get("*/api/v1/issues", () =>
        HttpResponse.json(
          issueList([
            issueFixture(),
            issueFixture({
              id: "order:/checkout:cost",
              cause_key: "cost",
              cause: "비용 충격",
              stage: "결제 정보 단계",
              impact: [3, 3],
              verdict: "새로 발견",
            }),
          ]),
        ),
      ),
    );
    renderWithProviders(<IssuesPage />, { route: "/issues" });

    await screen.findByRole("button", { name: "입력 부담 · 가입 단계" });
    expect(screen.getByRole("row", { name: /비용 충격/ })).toHaveTextContent("3개");
    await user.click(screen.getByRole("button", { name: /입력 부담\s*1/ }));
    expect(
      screen.queryByRole("button", { name: "비용 충격 · 결제 정보 단계" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "입력 부담 · 가입 단계" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("5~7개")).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: "리포트 보기" })).toHaveAttribute(
      "href",
      "/projects/1/runs/run-3/report",
    );
    await user.click(screen.getAllByRole("button", { name: "닫기" })[0]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("로그인하지 않았으면(401) 로그인이 필요하다고 안내한다", async () => {
    server.use(
      http.get("*/api/v1/issues", () =>
        HttpResponse.json(
          { error: { code: "AUTH_REQUIRED", message: "로그인이 필요합니다.", fields: {} } },
          { status: 401 },
        ),
      ),
    );
    renderWithProviders(<IssuesPage />, { route: "/issues" });

    expect(await screen.findByRole("heading", { name: "로그인이 필요해요" })).toBeInTheDocument();
  });
});
