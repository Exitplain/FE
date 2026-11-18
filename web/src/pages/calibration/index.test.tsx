import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { ROUTES } from "@/constants/routes";
import { useToastStore } from "@/stores/useToastStore";
import { createTestProject, waitForProject } from "@/test/projects";
import { renderWithProviders } from "@/test/renderWithProviders";

import { setCalibrationMock } from "@/mocks/handlers/calibration";

import { useCalibrationMockStore } from "./data/calibrationMock";
import CalibrationPage from "./index";

async function renderCalibration(projectId: string, search = "") {
  const result = renderWithProviders(<CalibrationPage />, {
    route: `/projects/${projectId}/calibration${search}`,
    path: ROUTES.calibration.path,
  });
  await waitForProject();
  return result;
}

beforeEach(() => {
  useCalibrationMockStore.setState(useCalibrationMockStore.getInitialState(), true);
});

describe("K01~K04 보정", () => {
  it("K01 → K02 → K03 — 조정안을 적용하면 다음 테스트를 기다리고, 이력에서 되돌릴 수 있다", async () => {
    const user = userEvent.setup();
    const projectId = await createTestProject();
    setCalibrationMock(projectId, { reason: null });
    await renderCalibration(projectId);

    expect(await screen.findByText("조정안 있음")).toBeInTheDocument();
    expect(
      screen.getByText("3차 vs 실측 7일 · 오차 4.5%p · 차이 구간 장바구니"),
    ).toBeInTheDocument();
    const table = screen.getByRole("table", { name: "조정안" });
    expect(within(table).getByRole("row", { name: /빠른 구매형/ })).toHaveTextContent(
      "빠른 구매형인내심 임계치×1.00×0.85",
    );
    expect(within(table).getByRole("row", { name: /꼼꼼한 비교형/ })).toHaveTextContent(
      "변화 없음",
    );
    expect(screen.getByText("세그먼트 1개 · 값 2개 변경")).toBeInTheDocument();
    /* 보정 후 오차는 추정하지 않고 다음 테스트 결과로만 보여줍니다 */
    expect(screen.getByText("다음 테스트 후")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "보정 적용" }));
    const dialog = screen.getByRole("dialog", { name: "보정을 적용할까요?" });
    expect(dialog).toHaveTextContent("×1.00 → ×0.85");
    expect(dialog).toHaveTextContent("값 2개가 바뀌어요");
    await user.click(within(dialog).getByRole("button", { name: "보정 적용" }));

    expect(await screen.findByText("보정 적용됨")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(useToastStore.getState().toasts.at(-1)?.message).toBe(
      "보정을 적용했어요. 다음 사전 테스트부터 반영돼요",
    );
    expect(screen.getByRole("link", { name: /새 테스트 시작하기/ })).toBeInTheDocument();
    const history = screen.getByRole("table", { name: "보정 이력" });
    expect(within(history).getAllByRole("row")[1]).toHaveTextContent(
      "빠른 구매형 인내심 임계치 1.00→0.85",
    );
    expect(within(history).getAllByRole("row")[1]).toHaveTextContent("4.5 → 다음 테스트 후");

    await user.click(screen.getByRole("button", { name: "기본 모형으로 되돌리기" }));
    expect(
      await within(screen.getByRole("table", { name: "보정 이력" })).findByText(
        "기본 모형으로 되돌림",
      ),
    ).toBeInTheDocument();
  });

  it("E11 — 차이 구간이 없으면 실제 평균 오차와 함께 보정할 차이가 없다고 알린다", async () => {
    const user = userEvent.setup();
    const projectId = await createTestProject();
    setCalibrationMock(projectId, { reason: "NO_GAP" });
    await renderCalibration(projectId);

    expect(
      await screen.findByRole("heading", { name: "지금은 보정할 차이가 없어요" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("모든 단계가 예측 범위 안이에요 · 평균 오차 1.2%p"),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "보정 이력 보기" }));
    expect(
      within(screen.getByRole("table", { name: "보정 이력" })).getByText("첫 보정 전 (기본 모형)"),
    ).toBeInTheDocument();
  });

  it("실측을 연결하지 않았거나 표본이 모자라면 이유와 실측 분석 링크를 보여준다", async () => {
    const projectId = await createTestProject();
    await renderCalibration(projectId);
    expect(
      await screen.findByRole("heading", { name: "실측 데이터를 먼저 연결해요" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "실측 분석으로 가기" })).toBeInTheDocument();
  });

  it("샘플 프로젝트는 보정할 수 없다고 알린다", async () => {
    await renderCalibration("1");
    expect(
      await screen.findByRole("heading", { name: "샘플 프로젝트는 보정할 수 없어요" }),
    ).toBeInTheDocument();
  });

  it("K04 — 관측을 저장하면 표와 일치 요약에 반영하고, 같은 참여자는 덮어쓴다고 알린다(K04c)", async () => {
    const user = userEvent.setup();
    await renderCalibration("1", "?view=observe");

    expect(screen.getByRole("heading", { level: 1, name: "사람 관측" })).toBeInTheDocument();
    expect(screen.getByText("입력한 관측 3건")).toBeInTheDocument();
    expect(screen.getByText("결과 일치").nextElementSibling).toHaveTextContent("2 / 3");

    await user.click(screen.getByRole("button", { name: "관측 저장" }));
    expect(screen.getByText("입력한 관측 4건")).toBeInTheDocument();
    /* 새 관측 H-004 는 이탈 · 장바구니 · 탐색 실패 → 결과만 예측과 같음 */
    expect(screen.getByRole("row", { name: /H-004/ })).toHaveTextContent(
      "H-004이탈장바구니탐색 실패일치",
    );
    /* 방금 저장한 관측은 안내 없이 두고, 입력을 바꿨다 되돌리면 덮어쓰기를 알립니다(K04c) */
    expect(screen.queryByText(/관측이 이미 있어요/)).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("참여자 코드"), "{Backspace}4");
    expect(screen.getByText("H-004 관측이 이미 있어요 · 저장하면 덮어써요")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "기존 관측 고치기" })).toBeInTheDocument();
  });

  it("참여자 코드 형식이 틀리면 저장하지 않고 안내한다", async () => {
    const user = userEvent.setup();
    await renderCalibration("1", "?view=observe");

    const input = screen.getByLabelText("참여자 코드");
    await user.clear(input);
    await user.type(input, "참여자 1");
    await user.click(screen.getByRole("button", { name: "관측 저장" }));

    expect(screen.getByText("영문·숫자·밑줄·하이픈 1~40자로 입력해주세요")).toBeInTheDocument();
    expect(screen.getByText("입력한 관측 3건")).toBeInTheDocument();
  });

  it("같은 참여자라도 과업이 다르면 다른 관측으로 저장한다", async () => {
    const user = userEvent.setup();
    await renderCalibration("1", "?view=observe");

    const input = screen.getByLabelText("참여자 코드");
    await user.clear(input);
    await user.type(input, "H-001");
    expect(screen.getByText("H-001 관측이 이미 있어요 · 저장하면 덮어써요")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "과업: 첫 주문 완료" }));
    await user.click(screen.getByRole("menuitemradio", { name: "쿠폰으로 주문" }));
    expect(screen.queryByText(/관측이 이미 있어요/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "관측 저장" }));

    expect(screen.getByText("입력한 관측 4건")).toBeInTheDocument();
    /* 방금 저장한 관측에는 덮어쓰기 안내를 바로 띄우지 않습니다 */
    expect(screen.queryByText(/관측이 이미 있어요/)).not.toBeInTheDocument();
  });
});
