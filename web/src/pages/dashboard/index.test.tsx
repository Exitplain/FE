import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { setProjectLoopMock } from "@/mocks/handlers/projects";
import { server } from "@/mocks/node";
import { issueFixture, issueList } from "@/test/issues";
import { createTestProject } from "@/test/projects";
import { renderWithProviders } from "@/test/renderWithProviders";

import DashboardPage from ".";

function LocationProbe() {
  const location = useLocation();
  return (
    <output aria-label="이동 주소">
      {location.pathname}
      {location.search}
    </output>
  );
}

/* 불러오기가 끝나면(헤더에 프로젝트 수) 머리의 새 테스트 버튼으로 W07 을 엽니다 */
async function openStartModal(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByText(/프로젝트 \d+개/);
  await user.click(screen.getAllByRole("button", { name: "새 테스트 시작하기" })[0]);
}

describe("W01 대시보드 (제품 API 실행 목록)", () => {
  it("실행 중 카드·최근 문제·최근 달성률·루프 위치를 실행 목록으로 그리고 투두리스트는 Figma 3칸", async () => {
    const now = new Date().toISOString();
    const base = {
      kind: "pretest",
      change_note: "",
      parent_run_id: null,
      created_at: now,
      started_at: null,
      finished_at: null,
    };
    server.use(
      http.get("*/api/v1/projects/:projectId/runs", () =>
        HttpResponse.json({
          items: [
            { ...base, id: "run-2", sequence_no: 2, name: "2차", status: "running", report: null },
            {
              ...base,
              id: "run-1",
              sequence_no: 1,
              name: "1차 · 첫 주문",
              status: "completed",
              finished_at: now,
              report: {
                id: "r1",
                status: "final",
                revision: 1,
                goal_rates: [{ task_id: "order", name: "첫 주문", achievement_rate: 0.3 }],
                top_causes: [{ key: "input_burden", name: "입력 부담", dropouts: 5 }],
              },
            },
          ],
          next_cursor: null,
          total: 2,
        }),
      ),
      http.get("*/api/v1/issues", () => HttpResponse.json(issueList([issueFixture()]))),
      http.get("*/api/v1/runs/run-2", () =>
        HttpResponse.json({
          ...base,
          id: "run-2",
          sequence_no: 2,
          status: "running",
          progress: {
            expected_sessions: 20,
            started_sessions: 11,
            sessions_by_status: { running: 6, success: 3, simulated_dropout: 2 },
          },
        }),
      ),
    );
    renderWithProviders(<DashboardPage />);

    /* 프로젝트 → 실행 목록 → 실행 상태를 차례로 받아 늦을 수 있어 넉넉히 기다립니다 */
    expect(
      await screen.findByRole("heading", { name: "지금 실행 중" }, { timeout: 3000 }),
    ).toBeInTheDocument();
    expect(screen.getByText("반찬로드 2차")).toBeInTheDocument();
    /* 카드는 목록 값으로 먼저 그리고, 실행 상태를 받으면 세션 수를 채웁니다 */
    expect(await screen.findByText("방문 5 / 20 종료")).toBeInTheDocument();
    expect(screen.getByText("대기").parentElement).toHaveTextContent("9");
    /* 최근 발견한 문제는 GET /api/v1/issues 의 앞 3개, 누르면 W03 에서 그 문제를 엽니다 */
    const issue = await screen.findByRole("link", { name: /입력 부담 · 가입 단계/ });
    expect(issue).toHaveTextContent("5~7");
    expect(issue).toHaveTextContent("계속 발생");
    expect(issue).toHaveAttribute("href", expect.stringContaining("/issues?issue=1%3Aorder"));
    expect(screen.getByRole("link", { name: "문제 1개 전체 보기" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /반찬로드 1차/ })).toHaveTextContent("30%");
    expect(screen.getByText("이번 주 완료 테스트").nextElementSibling).toHaveTextContent("1개");
    /* 조정안 대기는 프로젝트마다 무거운 조정안 계산이 필요해 아직 세지 않고, 샘플만 있으면 실측 비교 대상도 0 */
    expect(screen.getByText("예측 맞추기 조정안 대기").nextElementSibling).toHaveTextContent("–");
    expect(screen.getByText("실제 고객 데이터 비교 가능").nextElementSibling).toHaveTextContent(
      /^0 \/ 0/,
    );
    /* 반찬로드는 2차가 진행 중이라 사전 테스트 1/7, 다음 행동은 그 실행의 실시간 보기 */
    const row = screen.getByRole("row", { name: /^반찬로드/ });
    expect(row).toHaveTextContent("1 / 7 · 테스트 실행 중");
    expect(within(row).getByRole("link", { name: "실시간 보기" })).toHaveAttribute(
      "href",
      "/projects/1/runs/run-2",
    );
  });
});

describe("W01 루프 위치 — 실측·보정 상태", () => {
  const finished = () => {
    const done = new Date().toISOString();
    return http.get("*/api/v1/projects/:projectId/runs", () =>
      HttpResponse.json({
        items: [
          {
            id: "run-1",
            sequence_no: 1,
            name: "1차",
            kind: "pretest",
            status: "completed",
            change_note: "",
            parent_run_id: null,
            created_at: done,
            started_at: null,
            finished_at: done,
            report: null,
          },
        ],
        next_cursor: null,
        total: 1,
      }),
    );
  };

  it("프로젝트 목록의 실측·보정 상태로 단계를 나누고, 실측 비교 가능은 내 프로젝트 중 연결된 수", async () => {
    const id = await createTestProject();
    setProjectLoopMock(Number(id), {
      measurement: { status: "connected", last_received_at: "2026-11-18T00:00:00+00:00" },
      calibration: {
        status: "applied",
        revision: 2,
        applied_at: "2026-11-18T01:00:00+00:00",
        mean_error_pp: 6.2,
      },
    });
    await createTestProject("나다움", "https://nadaum.example/");
    server.use(finished());
    renderWithProviders(<DashboardPage />);

    const row = await screen.findByRole("row", { name: /^스튜디오 예약/ });
    expect(row).toHaveTextContent("7 / 7 · 예측 맞추기 적용됨");
    expect(row).toHaveTextContent("실제 고객 데이터 연결됨");
    expect(row).toHaveTextContent("예측 맞추기 · r2 적용");
    expect(within(row).getByRole("link", { name: "예측 맞추기 보기" })).toHaveAttribute(
      "href",
      `/projects/${id}/calibration`,
    );
    const other = screen.getByRole("row", { name: /^나다움/ });
    expect(other).toHaveTextContent("4 / 7 · 실제 고객 데이터 연결 전");
    expect(other).toHaveTextContent("실제 고객 데이터 미연결");
    expect(other).toHaveTextContent("예측 맞추기 · 예측 맞추기 전");
    /* 샘플은 내 프로젝트가 아니라 분모에서 빼고, 조정안 대기는 아직 세지 않음 */
    expect(screen.getByText("실제 고객 데이터 비교 가능").nextElementSibling).toHaveTextContent(
      /^1 \/ 2/,
    );
    expect(screen.getByText("예측 맞추기 조정안 대기").nextElementSibling).toHaveTextContent("–");
  });

  it("서버가 실측·보정 상태를 주지 않으면(배포 전) 4단계 · 실측 연결 전으로 둔다", async () => {
    const id = await createTestProject();
    setProjectLoopMock(Number(id), { measurement: undefined, calibration: undefined });
    server.use(finished());
    renderWithProviders(<DashboardPage />);

    const row = await screen.findByRole("row", { name: /^스튜디오 예약/ });
    expect(row).toHaveTextContent("4 / 7 · 실제 고객 데이터 연결 전");
    expect(within(row).getByRole("link", { name: "실제 고객 데이터 연결하기" })).toHaveAttribute(
      "href",
      `/projects/${id}/analytics`,
    );
  });
});

describe("W01 지금 실행 중 — 실행 중인 테스트가 없을 때", () => {
  it("카드에 안내를 두고, 카드의 새 테스트 시작하기로 W07 을 연다", async () => {
    const user = userEvent.setup();
    const done = new Date().toISOString();
    server.use(
      http.get("*/api/v1/projects/:projectId/runs", () =>
        HttpResponse.json({
          items: [
            {
              id: "run-1",
              sequence_no: 1,
              name: "1차",
              kind: "pretest",
              status: "completed",
              change_note: "",
              parent_run_id: null,
              created_at: done,
              started_at: null,
              finished_at: done,
              report: null,
            },
          ],
          next_cursor: null,
          total: 1,
        }),
      ),
    );
    renderWithProviders(<DashboardPage />);

    const card = await screen.findByRole("region", { name: "지금 실행 중" });
    expect(within(card).getByText("실행 중인 테스트가 없어요")).toBeInTheDocument();
    expect(within(card).queryByRole("link", { name: "실시간 보기" })).not.toBeInTheDocument();
    await user.click(within(card).getByRole("button", { name: "새 테스트 시작하기" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

describe("워크스페이스 대시보드", () => {
  it("W07에서 선택한 프로젝트의 기존 새 테스트 경로로 이동한다", async () => {
    const user = userEvent.setup();
    await createTestProject();
    renderWithProviders(
      <>
        <DashboardPage />
        <LocationProbe />
      </>,
    );
    await openStartModal(user);
    await user.click(screen.getByRole("combobox", { name: "테스트할 프로젝트" }));
    await user.click(screen.getByRole("option", { name: /스튜디오 예약/ }));
    await user.click(screen.getByRole("button", { name: "계속" }));
    expect(screen.getByLabelText("이동 주소")).toHaveTextContent("/projects/101/tests/new");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("선택 메뉴에서 Escape는 메뉴만 닫고 키보드로 프로젝트를 선택할 수 있다", async () => {
    const user = userEvent.setup();
    await createTestProject();
    renderWithProviders(<DashboardPage />);
    await openStartModal(user);
    const picker = screen.getByRole("combobox", { name: "테스트할 프로젝트" });
    await user.click(picker);
    /* 내 프로젝트가 샘플보다 먼저 오고, 첫 프로젝트가 기본 선택입니다 */
    expect(
      screen.getByRole("option", { name: /스튜디오 예약/, selected: true }),
    ).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(picker).toHaveTextContent("반찬로드 · banchanroad.example");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("새 프로젝트 옵션은 프로젝트 생성 모달 경로로 연결한다", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <DashboardPage />
        <LocationProbe />
      </>,
    );
    await openStartModal(user);
    await user.click(screen.getByRole("combobox", { name: "테스트할 프로젝트" }));
    await user.click(screen.getByRole("option", { name: /새 프로젝트/ }));
    expect(screen.getByLabelText("이동 주소")).toHaveTextContent("/projects?create=1");
  });
});
