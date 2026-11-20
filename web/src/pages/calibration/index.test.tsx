import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { ROUTES } from "@/constants/routes";
import { useToastStore } from "@/stores/useToastStore";
import { createTestProject, waitForProject } from "@/test/projects";
import { renderWithProviders } from "@/test/renderWithProviders";

import { setCalibrationMock } from "@/mocks/handlers/calibration";

import CalibrationPage from "./index";

async function renderCalibration(projectId: string, search = "") {
  const result = renderWithProviders(<CalibrationPage />, {
    route: `/projects/${projectId}/calibration${search}`,
    path: ROUTES.calibration.path,
  });
  await waitForProject();
  return result;
}

describe("K01~K04 예측 맞추기", () => {
  it("K01 → K02 → K03 — 조정안을 적용하면 다음 테스트를 기다리고, 이력에서 되돌릴 수 있다", async () => {
    const user = userEvent.setup();
    const projectId = await createTestProject();
    setCalibrationMock(projectId, { reason: null });
    await renderCalibration(projectId);

    expect(await screen.findByText("조정안 있음")).toBeInTheDocument();
    expect(
      screen.getByText("3차 vs 실제 고객 데이터 7일 (24회 방문) · 오차 4.5%p · 차이 구간 장바구니"),
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

    await user.click(screen.getByRole("button", { name: "예측 맞추기 적용" }));
    const dialog = screen.getByRole("dialog", { name: "예측 맞추기를 적용할까요?" });
    expect(dialog).toHaveTextContent("×1.00 → ×0.85");
    expect(dialog).toHaveTextContent("값 2개가 바뀌어요");
    await user.click(within(dialog).getByRole("button", { name: "예측 맞추기 적용" }));

    expect(await screen.findByText("예측 맞추기 적용됨")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(useToastStore.getState().toasts.at(-1)?.message).toBe(
      "예측 맞추기를 적용했어요. 다음 사전 테스트부터 반영돼요",
    );
    expect(screen.getByRole("link", { name: /새 테스트 시작하기/ })).toBeInTheDocument();
    const history = screen.getByRole("table", { name: "예측 맞추기 이력" });
    expect(within(history).getAllByRole("row")[1]).toHaveTextContent(
      "빠른 구매형 인내심 임계치 1.00→0.85",
    );
    expect(within(history).getAllByRole("row")[1]).toHaveTextContent("4.5 → 다음 테스트 후");

    await user.click(screen.getByRole("button", { name: "기본 모형으로 되돌리기" }));
    expect(
      await within(screen.getByRole("table", { name: "예측 맞추기 이력" })).findByText(
        "기본 모형으로 되돌림",
      ),
    ).toBeInTheDocument();
  });

  it("E11 — 차이 구간이 없으면 실제 평균 오차와 함께 예측을 맞출 차이가 없다고 알린다", async () => {
    const user = userEvent.setup();
    const projectId = await createTestProject();
    setCalibrationMock(projectId, { reason: "NO_GAP" });
    await renderCalibration(projectId);

    expect(
      await screen.findByRole("heading", { name: "지금은 예측을 맞출 차이가 없어요" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("모든 단계가 예측 범위 안이에요 · 평균 오차 1.2%p"),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "예측 맞추기 이력 보기" }));
    expect(
      within(screen.getByRole("table", { name: "예측 맞추기 이력" })).getByText(
        "첫 예측 맞추기 전 (기본 모형)",
      ),
    ).toBeInTheDocument();
  });

  it("실제 고객 데이터를 연결하지 않았거나 표본이 모자라면 이유와 실제 고객 데이터 분석 링크를 보여준다", async () => {
    const projectId = await createTestProject();
    await renderCalibration(projectId);
    expect(
      await screen.findByRole("heading", { name: "실제 고객 데이터를 먼저 연결해요" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "실제 고객 데이터 분석으로 가기" }),
    ).toBeInTheDocument();
  });

  it("샘플 프로젝트는 예측을 맞출 수 없다고 알린다", async () => {
    await renderCalibration("1");
    expect(
      await screen.findByRole("heading", { name: "샘플 프로젝트는 예측을 맞출 수 없어요" }),
    ).toBeInTheDocument();
  });

  it("K03 — 이 예측 맞추기로 돈 사전 테스트가 끝나면 같은 실제 고객 데이터 기간으로 예측 맞추기 전·후 오차를 비교한다", async () => {
    const projectId = await createTestProject();
    setCalibrationMock(projectId, {
      reason: "WAITING_NEXT_RUN",
      afterRun: true,
      history: [
        {
          id: 7,
          revision: 1,
          applied_at: "2026-11-18T09:00:00+09:00",
          applied_by: "maker",
          params: {},
          changes: [],
          changes_summary: "빠른 구매형 인내심 임계치 1.00→0.85",
          base_comparison: "3차 vs 실제 고객 데이터 최근 7일",
          error_before_pp: 4.5,
          error_after_pp: 2.1,
          restored_from: null,
        },
      ],
    });
    await renderCalibration(projectId);

    const table = await screen.findByRole("table", {
      name: "단계별 오차 · 예측 맞추기 전 vs 후",
    });
    expect(within(table).getByRole("row", { name: /장바구니/ })).toHaveTextContent(
      "−16.0%p−4.2%p차이 구간 해소",
    );
    expect(screen.getByText("1곳 → 0곳")).toBeInTheDocument();
    expect(screen.getByText("4차 결과로 다시 계산")).toBeInTheDocument();
    expect(
      within(screen.getByRole("table", { name: "예측 맞추기 이력" })).getByText("4.5 → 2.1"),
    ).toBeInTheDocument();
  });

  it("K04 — 관측을 저장하면 예측과 비교해 요약하고, 같은 참여자×과업은 덮어쓴다(K04c)", async () => {
    const user = userEvent.setup();
    await renderCalibration(await createTestProject(), "?view=observe");

    expect(screen.getByRole("heading", { level: 1, name: "사람 관측" })).toBeInTheDocument();
    expect(await screen.findByText("입력한 관측 0건")).toBeInTheDocument();

    /* 이탈 · 회원가입 · 입력 부담 → 예측(이탈·회원가입·입력 부담)과 모두 같음 */
    await user.click(screen.getByRole("button", { name: "멈춘 단계: 첫 화면" }));
    await user.click(screen.getByRole("menuitemradio", { name: "4. 회원가입" }));
    await user.click(screen.getByRole("button", { name: "관측 저장" }));
    expect(await screen.findByText("입력한 관측 1건")).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /H-001/ })).toHaveTextContent(
      "H-001첫 주문 완료이탈회원가입입력 부담3예측 맞추기용일치",
    );
    expect(screen.getByText("결과 일치").nextElementSibling).toHaveTextContent("1 / 1");
    expect(useToastStore.getState().toasts.at(-1)?.message).toBe("관측을 저장했어요");

    /* 같은 코드를 다시 쓰면 덮어쓰기를 알리고, 저장하면 1건 그대로 */
    await user.type(screen.getByLabelText("참여자 코드"), "{Backspace}1");
    expect(screen.getByText("H-001 관측이 이미 있어요 · 저장하면 덮어써요")).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "완료" }));
    await user.click(screen.getByRole("button", { name: "기존 관측 고치기" }));
    await waitFor(() =>
      expect(useToastStore.getState().toasts.at(-1)?.message).toBe("관측을 고쳤어요"),
    );
    expect(screen.getByText("입력한 관측 1건")).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /H-001/ })).toHaveTextContent("완료");
  });

  it("표본이 10 미만이면 임시 조정안을 보여 주고 예측 맞추기 적용을 막는다", async () => {
    const projectId = await createTestProject();
    setCalibrationMock(projectId, { reason: null, provisional: true });
    await renderCalibration(projectId);

    expect(await screen.findByText("임시 조정안")).toBeInTheDocument();
    expect(screen.getByText("임시값이에요 · 6/10회 방문")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "예측 맞추기 적용" })).toBeDisabled();
    /* 값은 미리 보기로 보여줍니다 */
    expect(screen.getByRole("table", { name: "조정안" })).toHaveTextContent("×0.85");
  });

  it("조정 강도를 '약하게'로 바꾸면 절반 크기의 조정안으로 다시 계산한다", async () => {
    const user = userEvent.setup();
    const projectId = await createTestProject();
    setCalibrationMock(projectId, { reason: null });
    await renderCalibration(projectId);

    const table = await screen.findByRole("table", { name: "조정안" });
    expect(within(table).getByRole("row", { name: /빠른 구매형/ })).toHaveTextContent("×0.85");
    await user.click(screen.getByRole("radio", { name: "약하게 (절반)" }));
    expect(
      await within(screen.getByRole("table", { name: "조정안" })).findByText("×0.95"),
    ).toBeInTheDocument();
  });

  it("예측 맞추기 이력이 있으면 예측 오차 추이를 꺾은선으로 보여준다 (표로도 읽힘)", async () => {
    const projectId = await createTestProject();
    setCalibrationMock(projectId, {
      reason: "WAITING_NEXT_RUN",
      history: [
        {
          id: 9,
          revision: 2,
          applied_at: "2026-11-19T09:00:00+09:00",
          applied_by: "maker",
          params: {},
          changes: [],
          changes_summary: "전체 불편한 점 가중치 · 비용 충격 1.00→1.10",
          base_comparison: "4차 vs 실제 고객 데이터 최근 7일",
          error_before_pp: 3.1,
          error_after_pp: null,
          restored_from: null,
        },
        {
          id: 8,
          revision: 1,
          applied_at: "2026-11-18T09:00:00+09:00",
          applied_by: "maker",
          params: {},
          changes: [],
          changes_summary: "빠른 구매형 인내심 임계치 1.00→0.85",
          base_comparison: "3차 vs 실제 고객 데이터 최근 7일",
          error_before_pp: 4.5,
          error_after_pp: 3.1,
          restored_from: null,
        },
      ],
    });
    await renderCalibration(projectId, "?view=history");

    const trend = await screen.findByRole("table", { name: "예측 맞추기별 예측 오차 추이" });
    const rows = within(trend).getAllByRole("row");
    expect(rows[1]).toHaveTextContent("r14.5%p3.1%p");
    expect(rows[2]).toHaveTextContent("r23.1%p—");
  });

  it("K04 — 가장 불편했던 화면·이유·정도를 넣으면 모델이 본 불편한 점과 비교하고 일치율 추이를 그린다", async () => {
    const user = userEvent.setup();
    await renderCalibration(await createTestProject(), "?view=observe");
    await screen.findByText("입력한 관측 0건");

    const save = async (code: string, screenName: string, reasonName: string) => {
      const input = screen.getByLabelText("참여자 코드");
      await user.clear(input);
      await user.type(input, code);
      await user.click(screen.getByRole("radio", { name: "완료" }));
      await user.click(screen.getByRole("button", { name: /^가장 불편했던 화면:/ }));
      await user.click(screen.getByRole("menuitemradio", { name: screenName }));
      await user.click(screen.getByRole("button", { name: /^불편했던 이유:/ }));
      await user.click(screen.getByRole("menuitemradio", { name: reasonName }));
      await user.click(screen.getByRole("radio", { name: "4" }));
      await user.click(screen.getByRole("button", { name: "관측 저장" }));
      await screen.findByRole("row", { name: new RegExp(code) });
    };
    /* 장바구니·비용 충격 → 모델 마찰 상위·그 화면 원인 → 둘 다 일치 */
    await save("H-101", "장바구니", "비용 충격");
    /* 첫 화면 → 모델 마찰 상위가 아님 → 다름 */
    await save("H-102", "첫 화면", "탐색 실패");

    expect(screen.getByRole("row", { name: /H-101/ })).toHaveTextContent(
      "H-101첫 주문 완료완료장바구니비용 충격4예측 맞추기용일치",
    );
    expect(screen.getByRole("row", { name: /H-102/ })).toHaveTextContent("다름");
    expect(screen.getByText("불편 화면 일치").nextElementSibling).toHaveTextContent("1 / 2");
    expect(screen.getByText("불편 이유 일치").nextElementSibling).toHaveTextContent("1 / 2");
    const trend = screen.getByRole("table", { name: "응답이 쌓일수록 불편 화면 일치율" });
    expect(within(trend).getAllByRole("row")).toHaveLength(3);
  });

  it("참여자 코드 형식이 틀리면 저장하지 않고 안내한다", async () => {
    const user = userEvent.setup();
    await renderCalibration(await createTestProject(), "?view=observe");

    const input = await screen.findByLabelText("참여자 코드");
    await user.clear(input);
    await user.type(input, "참여자 1");
    await user.click(screen.getByRole("button", { name: "관측 저장" }));

    expect(screen.getByText("영문·숫자·밑줄·하이픈 1~40자로 입력해주세요")).toBeInTheDocument();
    expect(screen.getByText("입력한 관측 0건")).toBeInTheDocument();
  });

  it("recorder.js 기록 파일을 가져오면 관측으로 들어간다", async () => {
    const user = userEvent.setup();
    await renderCalibration(await createTestProject(), "?view=observe");
    await screen.findByText("입력한 관측 0건");

    const record = {
      schema: "human-record-1",
      participant_id: "P07",
      outcome: "give_up",
      events: [],
    };
    const file = new File([JSON.stringify(record)], "human_P07_problem.json", {
      type: "application/json",
    });
    await user.upload(screen.getByLabelText("기록 파일 가져오기"), file);

    expect(await screen.findByText("입력한 관측 1건")).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /P07/ })).toHaveTextContent(
      "P07첫 주문 완료이탈장바구니원인 미상",
    );
  });

  it("사전 테스트가 없으면 관측을 비교할 수 없다고 알린다", async () => {
    const projectId = await createTestProject();
    setCalibrationMock(projectId, { predicted: false });
    await renderCalibration(projectId, "?view=observe");
    expect(
      await screen.findByText(
        "먼저 사전 테스트를 한 번 실행해야 사람 관측을 예측과 비교할 수 있어요.",
      ),
    ).toBeInTheDocument();
  });
});
