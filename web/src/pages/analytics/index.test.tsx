import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ROUTES } from "@/constants/routes";
import { setMeasurementMock } from "@/mocks/handlers/measurements";
import { createTestProject, waitForProject } from "@/test/projects";
import { renderWithProviders } from "@/test/renderWithProviders";

import { CHECK_TIMEOUT_MS } from "./hooks/useMeasurement";
import { useAnalyticsMockStore } from "./data/useAnalyticsMockStore";
import AnalyticsPage from "./index";

async function renderAnalytics(projectId: string, search = "") {
  const result = renderWithProviders(<AnalyticsPage />, {
    route: `/projects/${projectId}/analytics${search}`,
    path: ROUTES.analytics.path,
  });
  await waitForProject();
  return result;
}

beforeEach(() => {
  useAnalyticsMockStore.setState(useAnalyticsMockStore.getInitialState(), true);
});

describe("R01~R11 실측 분석 (임시 하드코딩 목데이터)", () => {
  it("R06 — 연결된 프로젝트는 실측 퍼널을 보여주고, 디바이스를 고르면 디바이스별로 나눈다(R07)", async () => {
    const user = userEvent.setup();
    await renderAnalytics("1");

    expect(screen.getByRole("heading", { level: 1, name: "실측 퍼널" })).toBeInTheDocument();
    expect(screen.getByText("비교 가능")).toBeInTheDocument();
    const funnel = screen.getByRole("table", { name: "실측 퍼널" });
    expect(within(funnel).getAllByRole("row")).toHaveLength(7);
    expect(within(funnel).getByRole("row", { name: /장바구니/ })).toHaveTextContent(
      "546 세션 · 44.0% · 이탈 41.3%",
    );

    await user.click(screen.getByRole("radio", { name: "모바일" }));
    expect(screen.getByRole("heading", { name: "모바일 · 860 세션" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "데스크톱 · 380 세션" })).toBeInTheDocument();
  });

  it("E09 — 수집 중인 프로젝트는 표본이 모자란 단계를 알린다", async () => {
    /* 연결 흐름(R01~R05)을 마친 프로젝트는 수집 중이 됩니다 */
    const projectId = await createTestProject();
    useAnalyticsMockStore.getState().connect(projectId);
    await renderAnalytics(projectId);

    expect(screen.getByText("수집 중")).toBeInTheDocument();
    expect(screen.getByText("7단계 중 3개만 표본을 채웠어요")).toBeInTheDocument();
    expect(screen.getAllByText("표본 부족")).toHaveLength(4);
  });

  it("E03 → R01~R05 — 미연결이면 연결을 안내하고, 키 발급·설치 확인(첫 수집 대기)·매핑을 거쳐 수집을 시작한다", async () => {
    const user = userEvent.setup();
    const projectId = await createTestProject();
    await renderAnalytics(projectId);

    await user.click(await screen.findByRole("button", { name: "실측 데이터 연결하기" }));
    expect(screen.getByRole("heading", { level: 1, name: "실측 데이터 연결" })).toBeInTheDocument();
    /* 화면을 열면 키를 발급해 스니펫을 보여줍니다 */
    const key = `ep_${Number(projectId).toString(16).padStart(12, "0")}`;
    expect(await screen.findByText(new RegExp(`data-project="${key}"`))).toBeInTheDocument();
    expect(screen.getByText("https://shop.example.com 에서 온 수집만 받아요")).toBeInTheDocument();
    expect(screen.getByText("설치를 확인하면 열려요")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "설치 확인" }));
    expect(screen.getByRole("button", { name: "확인 중…" })).toBeDisabled();
    expect(screen.getByText(/첫 수집 대기 중/)).toBeInTheDocument();

    /* 사이트에서 첫 수집이 오면 다음 조회에서 설치됨으로 바뀝니다 */
    setMeasurementMock(Number(projectId), { received: true });
    expect(
      await screen.findByText(
        /수집을 받고 있어요 · https:\/\/shop.example.com/,
        {},
        { timeout: 5000 },
      ),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "단계 매핑하기" }));

    expect(screen.getByRole("heading", { level: 1, name: "이벤트 단계 매핑" })).toBeInTheDocument();
    expect(screen.getByText("7개 중 7개 연결")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "step_coupon 단계: 매핑 안 함" }));
    await user.click(screen.getByRole("menuitemradio", { name: "2. 탐색" }));
    expect(screen.getByRole("button", { name: "step_coupon 단계: 탐색" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "매핑 저장" }));
    expect(screen.getByRole("heading", { level: 1, name: "실측 퍼널" })).toBeInTheDocument();
    expect(screen.getByText("수집 중")).toBeInTheDocument();
  }, 15000);

  it("R04 — 5분 동안 수집이 오지 않으면 확인할 것을 보여준다", async () => {
    const projectId = await createTestProject();
    setMeasurementMock(Number(projectId), { key: "ep_0000000000aa" });
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      await renderAnalytics(projectId, "?view=connect");
      await user.click(await screen.findByRole("button", { name: "설치 확인" }));
      await act(() => vi.advanceTimersByTimeAsync(CHECK_TIMEOUT_MS));
      expect(screen.getByText("5분 동안 수집이 오지 않았어요")).toBeInTheDocument();
      expect(
        within(screen.getByRole("list", { name: "확인할 것" })).getAllByRole("listitem"),
      ).toHaveLength(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it("배포 주소가 없는 프로젝트는 실측을 시작하지 않고 이유를 알려준다", async () => {
    const projectId = await createTestProject();
    setMeasurementMock(Number(projectId), { deployed: false });
    await renderAnalytics(projectId);

    expect(
      await screen.findByRole("heading", { name: "배포된 사이트가 있어야 실측할 수 있어요" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "실측 데이터 연결하기" })).not.toBeInTheDocument();
  });

  it("R08 → R09~R11 — 차이 구간에서 원인 재현을 시작하고 결과 가설을 본다", async () => {
    const user = userEvent.setup();
    await renderAnalytics("1", "?view=compare");

    expect(screen.getByText("불일치")).toBeInTheDocument();
    expect(screen.getByText("4.5%p")).toBeInTheDocument();
    const cart = screen.getByRole("row", { name: /장바구니/ });
    expect(cart).toHaveTextContent("55~65%44.0%−16.0%p");

    await user.click(within(cart).getByRole("button", { name: "이 구간 원인 재현" }));
    expect(
      screen.getByRole("heading", { level: 1, name: "원인 재현 · 장바구니" }),
    ).toBeInTheDocument();
    expect(screen.getByText("장바구니 · 실측 44.0% · 예측 55~65% (−16.0%p)")).toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: "가격 민감형 · 5명" }));
    await user.click(screen.getByRole("button", { name: "재현 시작" }));
    expect(screen.getByText("상세 → 장바구니만 실행 · 15명 × 시드 3회 (1/3)")).toBeInTheDocument();
    expect(
      within(screen.getByRole("list", { name: "재현 세션" })).getAllByRole("listitem"),
    ).toHaveLength(15);

    expect(
      await screen.findByRole("heading", { name: "원인 가설" }, { timeout: 8000 }),
    ).toBeInTheDocument();
    expect(screen.getByText("탐색 실패")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "조정안 확인" })).toBeInTheDocument();
  }, 15000);

  it("과업을 바꾸면 그 과업의 비교로 바뀐다", async () => {
    const user = userEvent.setup();
    await renderAnalytics("1", "?view=compare");

    await user.click(screen.getByRole("radio", { name: "쿠폰으로 주문" }));

    expect(screen.getByText("일치")).toBeInTheDocument();
    expect(screen.getByText("0곳")).toBeInTheDocument();
  });

  it("미연결 프로젝트는 데이터 화면 주소로 들어와도 E03 을 보여준다", async () => {
    await renderAnalytics(await createTestProject(), "?view=compare");

    expect(screen.getByRole("heading", { name: "실측 데이터가 아직 없어요" })).toBeInTheDocument();
  });
});
