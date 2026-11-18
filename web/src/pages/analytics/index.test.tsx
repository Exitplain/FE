import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ROUTES } from "@/constants/routes";
import { setMeasurementMock } from "@/mocks/handlers/measurements";
import { createTestProject, waitForProject } from "@/test/projects";
import { renderWithProviders } from "@/test/renderWithProviders";

import { CHECK_TIMEOUT_MS } from "./hooks/useMeasurement";
import AnalyticsPage from "./index";

async function renderAnalytics(projectId: string, search = "") {
  const result = renderWithProviders(<AnalyticsPage />, {
    route: `/projects/${projectId}/analytics${search}`,
    path: ROUTES.analytics.path,
  });
  await waitForProject();
  return result;
}

/* 매핑까지 저장해 실측 퍼널·비교를 볼 수 있는 프로젝트 */
async function connectedProject(patch = {}) {
  const projectId = await createTestProject();
  setMeasurementMock(Number(projectId), {
    key: "ep_00000000c0de",
    received: true,
    savedAt: "2026-11-18T09:00:00+09:00",
    ...patch,
  });
  return projectId;
}

describe("R01~R11 실측 분석", () => {
  it("R06 — 연결된 프로젝트는 과업별 실측 퍼널을 보여주고, 기기별로 나눠 볼 수 있다(R07)", async () => {
    const user = userEvent.setup();
    await renderAnalytics(await connectedProject());

    expect(await screen.findByRole("heading", { level: 1, name: "실측 퍼널" })).toBeInTheDocument();
    expect(await screen.findByText("비교 가능")).toBeInTheDocument();
    const funnel = screen.getByRole("table", { name: "실측 퍼널" });
    expect(within(funnel).getAllByRole("row")).toHaveLength(6);
    expect(within(funnel).getByRole("row", { name: /장바구니/ })).toHaveTextContent(
      "546 세션 · 44.0% · 이탈 41.3%",
    );

    await user.click(screen.getByRole("radio", { name: "모바일" }));
    expect(await screen.findByRole("heading", { name: "모바일 · 856 세션" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "데스크톱 · 384 세션" })).toBeInTheDocument();
  });

  it("E09 — 표본이 모자라면 수집 중으로 알리고 단계마다 표본 부족을 표시한다", async () => {
    await renderAnalytics(await connectedProject({ scale: 0.05 }));

    expect(await screen.findByText("수집 중")).toBeInTheDocument();
    expect(screen.getByText("6단계 중 0개만 표본을 채웠어요")).toBeInTheDocument();
    expect(screen.getAllByText("표본 부족")).toHaveLength(6);
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
    expect(screen.getByRole("link", { name: "사이트 열기 ↗" })).toHaveAttribute("target", "_blank");

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
    /* 경로가 같으면 일치, 비슷하면 이름 유사로 자동 연결됩니다 */
    expect(await screen.findByText("6개 중 6개 연결")).toBeInTheDocument();
    const detail = screen.getByRole("row", { name: /\/product\/:id/ });
    expect(detail).toHaveTextContent("이름 유사");
    expect(
      within(detail).getByRole("button", { name: "/product/:id 단계: 상품 상세" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /coupon_applied/ })).toHaveTextContent("후보 없음");

    await user.click(screen.getByRole("button", { name: "coupon_applied 단계: 매핑 안 함" }));
    await user.click(screen.getByRole("menuitemradio", { name: "3. 장바구니" }));
    expect(
      screen.getByRole("button", { name: "coupon_applied 단계: 장바구니" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "매핑 저장" }));
    expect(await screen.findByRole("heading", { level: 1, name: "실측 퍼널" })).toBeInTheDocument();
    expect(await screen.findByText("비교 가능")).toBeInTheDocument();
  }, 15000);

  it("R05 — 저장한 매핑은 다시 열어도 그대로이고, 예측 리포트가 없으면 이유를 알려준다", async () => {
    const user = userEvent.setup();
    const projectId = await createTestProject();
    setMeasurementMock(Number(projectId), { key: "ep_0000000000ab", received: true });
    const first = await renderAnalytics(projectId, "?view=mapping");
    await user.click(await screen.findByRole("button", { name: "/faq 단계: 매핑 안 함" }));
    await user.click(screen.getByRole("menuitemradio", { name: "1. 첫 화면" }));
    await user.click(screen.getByRole("button", { name: "매핑 저장" }));
    await screen.findByRole("heading", { level: 1, name: "실측 퍼널" });
    first.unmount();

    await renderAnalytics(projectId, "?view=mapping");
    expect(await screen.findByRole("button", { name: "/faq 단계: 첫 화면" })).toBeInTheDocument();
  });

  it("R05 — 사전 테스트 리포트가 없으면 매핑할 단계가 없다고 알려준다", async () => {
    const projectId = await createTestProject();
    setMeasurementMock(Number(projectId), {
      key: "ep_0000000000ac",
      received: true,
      predicted: false,
    });
    await renderAnalytics(projectId, "?view=mapping");
    expect(
      await screen.findByText("먼저 사전 테스트를 한 번 실행해야 비교할 단계가 생겨요."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "매핑 저장" })).not.toBeInTheDocument();
  });

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
    await renderAnalytics(await connectedProject(), "?view=compare");

    expect(await screen.findByText("불일치")).toBeInTheDocument();
    expect(
      screen.getByText("예측 장바구니→회원가입 / 실측 상품 상세→장바구니"),
    ).toBeInTheDocument();
    expect(screen.getByText("5.2%p")).toBeInTheDocument();
    expect(screen.getByText("5개 단계 절댓값 평균")).toBeInTheDocument();
    /* 첫 단계(기준 100%)는 비교표에 넣지 않습니다 */
    expect(
      within(screen.getByRole("table", { name: "단계별 비교" })).queryByRole("row", {
        name: /첫 화면/,
      }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("3차 (11월 7일) · 가장 최근")).toBeInTheDocument();
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
    await renderAnalytics(await connectedProject(), "?view=compare");

    await user.click(await screen.findByRole("radio", { name: "쿠폰으로 주문" }));

    expect(screen.getByText("일치")).toBeInTheDocument();
    expect(screen.getByText("0곳")).toBeInTheDocument();
    expect(screen.getByText("모두 범위 안")).toBeInTheDocument();
  });

  it("매핑하지 않은 단계는 실측 없이 비워 두고 오차에서 뺀다", async () => {
    await renderAnalytics(
      await connectedProject({ mapping: { "/signup": null } }),
      "?view=compare",
    );
    const signup = await screen.findByRole("row", { name: /회원가입/ });
    expect(signup).toHaveTextContent("매핑 안 됨");
    expect(screen.getByText("4개 단계 절댓값 평균")).toBeInTheDocument();
  });

  it("미연결 프로젝트는 데이터 화면 주소로 들어와도 E03 을 보여준다", async () => {
    await renderAnalytics(await createTestProject(), "?view=compare");

    expect(
      await screen.findByRole("heading", { name: "실측 데이터가 아직 없어요" }),
    ).toBeInTheDocument();
  });

  it("샘플 프로젝트는 실측을 연결할 수 없다고 알려준다", async () => {
    await renderAnalytics("1");

    expect(await screen.findByText(/샘플 프로젝트는 실측을 연결할 수 없어요/)).toBeInTheDocument();
  });
});
