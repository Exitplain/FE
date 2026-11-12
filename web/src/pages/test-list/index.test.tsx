import type { QueryClient } from "@tanstack/react-query";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { confirmPersonaRun, discoverPersonaPlan, getPersonaRun } from "@/apis/persona.api";
import { queryKeys } from "@/apis/queryKeys";
import { ROUTES } from "@/constants/routes";
import { personaErrorHandlers } from "@/mocks/handlers/personas";
import { server } from "@/mocks/node";
import { renderWithProviders } from "@/test/renderWithProviders";

import TestListPage from "./index";

const queryClientRef: { current: QueryClient | null } = { current: null };

function renderPage(projectId = "banchan") {
  const result = renderWithProviders(<TestListPage />, {
    route: `/projects/${projectId}/tests`,
    path: ROUTES.testList.path,
  });
  queryClientRef.current = result.queryClient;
  return result;
}

async function startRun() {
  const plan = await discoverPersonaPlan({ variant: "problem" });
  await confirmPersonaRun({
    plan_id: plan.plan_id,
    feature_ids: ["shopping"],
    task_ids: ["order"],
    ages: ["any"],
    context: "",
    additional_request: "",
  });
}

/* mock 은 조회할 때마다 진행하므로 끝날 때까지 부릅니다 */
async function completeRun() {
  for (let i = 0; i < 20; i += 1) {
    if ((await getPersonaRun()).status === "completed") return;
  }
  throw new Error("mock 실행이 끝나지 않았습니다");
}

describe("P01 사전 테스트 목록", () => {
  it("프로젝트 머리말과 새 테스트 시작 링크를 보여준다", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { level: 1, name: "반찬로드" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "새 테스트 시작하기" })).toHaveAttribute(
      "href",
      "/projects/banchan/tests/new",
    );
  });

  it("실행 기록이 없으면 빈 상태(E02)를 보여준다", async () => {
    renderPage();

    expect(
      await screen.findByRole("heading", { name: "아직 사전 테스트가 없어요" }),
    ).toBeInTheDocument();
  });

  it("진행 중인 실행은 실행 화면으로, 완료된 실행은 리포트로 연결한다", async () => {
    await startRun();
    await completeRun();
    await startRun();

    renderPage();

    const table = await screen.findByRole("table", { name: "사전 테스트" });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByRole("link")).toHaveAttribute(
      "href",
      expect.stringMatching(/^\/projects\/banchan\/runs\/mock-run-\d+$/),
    );
    expect(within(rows[0]).getByText("실행 중")).toBeInTheDocument();
    expect(within(rows[1]).getByRole("link")).toHaveAttribute(
      "href",
      expect.stringMatching(/^\/projects\/banchan\/runs\/mock-run-\d+\/report$/),
    );
    expect(within(rows[1]).getByText("완료")).toBeInTheDocument();
  });

  it("목록을 불러오지 못하면 다시 시도해 복구할 수 있다", async () => {
    server.use(personaErrorHandlers.personasNetworkError);
    const user = userEvent.setup();
    renderPage();

    const retry = await screen.findByRole("button", { name: "다시 시도" });
    server.resetHandlers();
    await user.click(retry);

    expect(
      await screen.findByRole("heading", { name: "아직 사전 테스트가 없어요" }),
    ).toBeInTheDocument();
  });

  it("실행이 끝나도 그 실행이 목록에서 사라지지 않고 완료로 바뀐다", async () => {
    await startRun();
    renderPage();

    const table = await screen.findByRole("table", { name: "사전 테스트" });
    expect(await within(table).findByText("실행 중")).toBeInTheDocument();

    // 화면의 polling 대신 직접 끝까지 진행시키고 현재 실행을 다시 받게 합니다
    await completeRun();
    await queryClientRef.current!.invalidateQueries({ queryKey: queryKeys.personas.current() });

    expect(await within(table).findByText("완료")).toBeInTheDocument();
    expect(within(table).getAllByRole("row")).toHaveLength(2);
  });

  it("반찬로드가 아닌 프로젝트에는 개발 서버 기록이 반찬로드 기준이라고 알린다", async () => {
    renderPage("studio");

    expect(await screen.findByText(/반찬로드 모의 쇼핑몰만 실행해요/)).toBeInTheDocument();
  });

  it("없는 프로젝트면 찾을 수 없다고 알린다", async () => {
    renderPage("unknown");

    expect(await screen.findByText("프로젝트를 찾을 수 없어요")).toBeInTheDocument();
  });
});
