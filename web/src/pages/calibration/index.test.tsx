import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { ROUTES } from "@/constants/routes";
import { useToastStore } from "@/stores/useToastStore";
import { createTestProject, waitForProject } from "@/test/projects";
import { renderWithProviders } from "@/test/renderWithProviders";

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

describe("K01~K04 보정 (임시 하드코딩 목데이터)", () => {
  it("K01 → K02 → K03 — 조정안을 확인하고 적용하면 오차 비교와 보정 이력을 보여준다", async () => {
    const user = userEvent.setup();
    await renderCalibration("1");

    expect(screen.getByText("조정안 있음")).toBeInTheDocument();
    const table = screen.getByRole("table", { name: "조정안" });
    expect(within(table).getAllByRole("row")).toHaveLength(7);
    expect(screen.getByText("세그먼트 4개 · 값 5개 변경")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "보정 적용" }));
    const dialog = screen.getByRole("dialog", { name: "보정을 적용할까요?" });
    expect(dialog).toHaveTextContent("70 → 62");
    expect(dialog).toHaveTextContent("값 5개가 바뀌어요");
    await user.click(within(dialog).getByRole("button", { name: "보정 적용" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("보정 적용됨")).toBeInTheDocument();
    expect(screen.getByText(/적용 · 이후 사전 테스트에 자동 적용돼요/)).toBeInTheDocument();
    expect(useToastStore.getState().toasts.at(-1)?.message).toBe(
      "보정을 적용했어요. 다음 사전 테스트부터 반영돼요",
    );
    expect(screen.getByRole("row", { name: /장바구니/ })).toHaveTextContent(
      "−16.0%p−4.2%p차이 구간 해소",
    );

    await user.click(screen.getByRole("radio", { name: "보정 이력 3" }));
    const history = screen.getByRole("table", { name: "보정 이력" });
    expect(within(history).getAllByRole("row")).toHaveLength(4);
    expect(within(history).getAllByRole("row")[1]).toHaveTextContent("4.5 → 2.1%p");
  });

  it("E11 — 조정안이 없으면 보정할 차이가 없다고 알리고 이력으로 안내한다", async () => {
    const user = userEvent.setup();
    await renderCalibration(await createTestProject());

    expect(
      screen.getByRole("heading", { name: "지금은 보정할 차이가 없어요" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "보정 이력 보기" }));

    expect(
      within(screen.getByRole("table", { name: "보정 이력" })).getAllByRole("row"),
    ).toHaveLength(3);
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

  it("보정 이력·관측은 프로젝트마다 따로 둔다", async () => {
    useCalibrationMockStore.getState().apply("1", new Date());
    useCalibrationMockStore.getState().saveObservation("1", {
      participant: "H-009",
      task: "첫 주문 완료",
      outcome: "success",
      stage: null,
      cause: null,
      matches: { outcome: false, stage: false, cause: false },
    });

    await renderCalibration(await createTestProject(), "?view=history");

    expect(
      within(screen.getByRole("table", { name: "보정 이력" })).getAllByRole("row"),
    ).toHaveLength(3);
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
