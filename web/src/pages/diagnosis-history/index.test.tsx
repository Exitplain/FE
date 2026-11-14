import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { renderWithProviders } from "@/test/renderWithProviders";

import DiagnosisHistoryPage from ".";

describe("워크스페이스 진단 기록", () => {
  it("프로젝트와 상태를 함께 필터링하고 빈 결과에서 초기화한다", async () => {
    const user = userEvent.setup();
    renderWithProviders(<DiagnosisHistoryPage />, { route: "/history" });
    await screen.findByRole("link", { name: "1차 · 예약 완료" });
    await user.selectOptions(screen.getByRole("combobox", { name: "프로젝트 필터" }), "studio");
    await user.selectOptions(screen.getByRole("combobox", { name: "상태 필터" }), "failed");
    expect(screen.getByText("조건에 맞는 실행이 없어요")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "필터 모두 해제" })[0]);
    expect(screen.getByRole("link", { name: "1차 · 예약 완료" })).toBeInTheDocument();
  });

  it("호환되는 완료 실행 두 개만 비교할 수 있다", async () => {
    const user = userEvent.setup();
    renderWithProviders(<DiagnosisHistoryPage />, { route: "/history" });
    await screen.findByRole("link", { name: "3차 · 첫 주문 완료 외 1개" });
    await user.click(screen.getByRole("checkbox", { name: "3차 · 첫 주문 완료 외 1개 선택" }));
    expect(screen.getByRole("button", { name: "선택한 1개 비교" })).toBeDisabled();
    await user.click(screen.getByRole("checkbox", { name: "2차 · 첫 주문 완료 외 1개 선택" }));
    await user.click(screen.getByRole("button", { name: "선택한 2개 비교" }));
    expect(within(screen.getByRole("dialog")).getByText("과업 1 · 20~30%")).toBeInTheDocument();
  });
});
