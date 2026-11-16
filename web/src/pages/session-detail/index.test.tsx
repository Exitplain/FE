import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { confirmPersonaRun, discoverPersonaPlan } from "@/apis/persona.api";
import { buildPath, ROUTES } from "@/constants/routes";
import { server } from "@/mocks/node";
import { finishPersonaMock } from "@/mocks/personaMock";
import { renderWithProviders } from "@/test/renderWithProviders";
import type { ExplainAnswer, PersonaSession, SessionStatus } from "@/types/persona.type";

import SessionDetailPage from "./index";

async function completeRun(features = ["shopping"], tasks = ["order"]) {
  const plan = await discoverPersonaPlan({ variant: "problem" });
  await confirmPersonaRun({
    plan_id: plan.plan_id,
    feature_ids: features,
    task_ids: tasks,
    ages: ["any"],
    context: "",
    additional_request: "",
  });
  return finishPersonaMock();
}

/* 세션 결과는 세그먼트·시드로 정해져, 원하는 상태의 첫 세션을 골라 씁니다 */
function pick(sessions: PersonaSession[], status: SessionStatus) {
  const session = sessions.find((item) => item.status === status);
  if (!session) throw new Error(`${status} 세션이 없습니다`);
  return session;
}

function renderSession(runId: string, sessionId: string, search = "") {
  return renderWithProviders(<SessionDetailPage />, {
    route: `${buildPath("sessionDetail", { projectId: "1", runId, sessionId })}${search}`,
    path: ROUTES.sessionDetail.path,
  });
}

describe("P15·P16 세션 상세", () => {
  it("P15 이탈 — KPI·근거 발화·끊긴 단계·좌절 점수·최근 스텝을 보여준다", async () => {
    const run = await completeRun();
    const session = pick(run.sessions, "simulated_dropout");
    const last = session.trace.at(-1)!;
    renderSession(run.id!, session.id);

    expect(
      await screen.findByRole("heading", { level: 1, name: `${session.code} · 세션 상세` }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/시드 1 · 12스텝 · \d분 \d{2}초 · [\d.]+k 토큰 · \$0\.\d{2}/),
    ).toBeInTheDocument();
    expect(screen.getByText("이탈", { selector: "span" })).toBeInTheDocument();

    expect(screen.getByText("좌절 점수").nextElementSibling).toHaveTextContent(
      `${last.score} / 임계치 ${last.threshold}`,
    );
    expect(screen.getByText("종료 사유").nextElementSibling).toHaveTextContent(
      "임계치 초과 → 이탈",
    );
    expect(screen.getByText("근거 발화")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "어디서 흐름이 끊겼나요?" })).toBeInTheDocument();
    expect(screen.getByText("여기서 중단")).toBeInTheDocument();

    /* 스텝 12개 막대, 마지막 막대만 임계치 초과 */
    const bars = within(screen.getByRole("list", { name: "스텝별 좌절 점수" })).getAllByRole(
      "listitem",
    );
    expect(bars).toHaveLength(12);
    expect(bars[11]).toHaveTextContent("임계치 초과");
    expect(bars[0]).not.toHaveTextContent("임계치 초과");

    expect(screen.getByRole("button", { name: "스텝 12개 전체 보기" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "왜 멈췄나요?" })).toBeInTheDocument();
  });

  it("P16 완료 — 도달 단계 → 완료, 최고 좌절 점수, 목표 달성", async () => {
    const run = await completeRun();
    const session = pick(run.sessions, "success");
    const peak = Math.max(...session.trace.map((point) => point.score));
    renderSession(run.id!, session.id);

    expect(await screen.findByText("도달 단계")).toBeInTheDocument();
    expect(screen.getByText("도달 단계").nextElementSibling).toHaveTextContent("결제 정보 → 완료");
    expect(screen.getByText("최고 좌절 점수").nextElementSibling).toHaveTextContent(
      `${peak} / 임계치`,
    );
    expect(screen.getByText("목표 달성")).toBeInTheDocument();
    expect(screen.getByText("결제 정보는 도달까지만 기록해요 (실결제 금지)")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "지나온 단계" })).toBeInTheDocument();
    expect(screen.getByLabelText("완료")).toBeInTheDocument();
    expect(screen.queryByText("근거 발화")).not.toBeInTheDocument();
  });

  it("P15c·P15b — 타임라인은 최근 3스텝부터, 더 보기로 전부 펼치고 썸네일로 화면을 크게 본다", async () => {
    const user = userEvent.setup();
    const run = await completeRun();
    const session = pick(run.sessions, "simulated_dropout");
    renderSession(run.id!, session.id);

    await user.click(await screen.findByRole("button", { name: "스텝 12개 전체 보기" }));
    expect(screen.getByRole("tab", { name: "스텝 타임라인 12" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    const list = screen.getByRole("list", { name: "스텝" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByText("총 12스텝 · 최근 3개 표시")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "이전 스텝 더 보기" }));
    expect(within(list).getAllByRole("listitem")).toHaveLength(12);

    await user.click(screen.getByRole("button", { name: "스텝 12 화면 크게 보기" }));
    const dialog = screen.getByRole("dialog", { name: "진단 시점의 화면 · 스텝 12" });
    expect(within(dialog).getByText(/박스 = 문제가 된 요소 위치/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("radio", { name: "원본 크기" }));
    await user.click(within(dialog).getAllByRole("button", { name: "닫기" })[1]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("P15d — 칩으로 질문하면 질문 탭에 답과 근거 스텝이 나오고, 근거를 누르면 그 스텝으로 간다", async () => {
    const user = userEvent.setup();
    const run = await completeRun();
    const session = pick(run.sessions, "simulated_dropout");
    renderSession(run.id!, session.id);

    await user.click(await screen.findByRole("button", { name: "왜 멈췄나요?" }));

    expect(screen.getByRole("tab", { name: "질문" })).toHaveAttribute("aria-selected", "true");
    const answers = await screen.findByRole("list", { name: "답변" });
    expect(answers).toHaveTextContent("Q. 왜 멈췄나요?");
    expect(answers).toHaveTextContent(
      /A\. 스텝 11.*스텝 12에서 \d+로 올라 임계치 \d+을 넘어 멈췄어요/,
    );

    /* 직접 입력한 질문도 같은 목록에 쌓입니다 */
    await user.type(
      screen.getByRole("textbox", { name: "세션에 질문" }),
      "가입에서 뭐가 힘들었나요?",
    );
    await user.click(screen.getByRole("button", { name: "질문" }));
    expect(await within(answers).findByText("Q. 가입에서 뭐가 힘들었나요?")).toBeInTheDocument();

    await user.click(within(answers).getAllByRole("button", { name: "근거: 스텝 11" })[0]);
    expect(screen.getByRole("tab", { name: "스텝 타임라인 12" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(document.getElementById("session-step-11")).toHaveAttribute("aria-current", "step");
  });

  it("E06 — 기술 오류 세션은 탭 없이 오류 안내와 멈추기 전 기록을 보여준다", async () => {
    const run = await completeRun(["delivery"], ["delivery"]);
    const session = pick(run.sessions, "agent_failure");
    renderSession(run.id!, session.id);

    expect(await screen.findByRole("heading", { name: "세션 오류" })).toBeInTheDocument();
    expect(
      screen.getByText("브라우저가 30초 동안 응답하지 않아 세션을 끝냈어요"),
    ).toBeInTheDocument();
    expect(screen.getByText("기술 오류라 이탈률·원인 계산에서 빠져요")).toBeInTheDocument();
    expect(screen.getByText(/12스텝에서 멈춤/)).toBeInTheDocument();
    expect(screen.getByText(/→ 응답 없음/)).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });

  it("잘못된 탭 주소는 요약으로 연다", async () => {
    const run = await completeRun();
    const session = pick(run.sessions, "success");
    renderSession(run.id!, session.id, "?tab=nope");

    expect(await screen.findByRole("tab", { name: "요약" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("없는 세션이면 찾을 수 없다고 알리고 리포트로 안내한다", async () => {
    renderSession("run-x", "nobody");

    expect(
      await screen.findByRole("heading", { name: "세션을 찾을 수 없어요" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "리포트로 돌아가기" })).toHaveLength(2);
  });

  it("조회가 실패하면 다시 시도할 수 있다", async () => {
    server.use(http.get("*/api/personas/session", () => HttpResponse.error()));
    renderSession("run-x", "nobody");

    expect(
      /* 앱 기본값처럼 한 번 다시 시도(1초 뒤)한 다음 오류를 보여줍니다 */
      await screen.findByRole(
        "heading",
        { name: "세션 기록을 불러오지 못했어요" },
        { timeout: 3000 },
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeInTheDocument();
  });

  it("탭은 화살표·Home·End 로 옮겨 다닌다", async () => {
    const user = userEvent.setup();
    const run = await completeRun();
    renderSession(run.id!, pick(run.sessions, "success").id);

    await user.click(await screen.findByRole("tab", { name: "요약" }));
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: /스텝 타임라인/ })).toHaveFocus();
    await user.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "질문" })).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{Home}");
    expect(screen.getByRole("tab", { name: "요약" })).toHaveAttribute("aria-selected", "true");
  });

  it("최근 3개 밖의 근거 스텝으로 가면 타임라인을 모두 펼치고 그 스텝에 포커스를 둔다", async () => {
    const user = userEvent.setup();
    const run = await completeRun();
    const session = pick(run.sessions, "simulated_dropout");
    const answer: ExplainAnswer = {
      id: "answer-1",
      question: "처음에 뭘 봤나요?",
      answer: "첫 화면을 확인했어요.",
      kind: "recorded_action",
      supported_by_record: true,
      sources: [{ step: 1, stage: "landing", stage_name: "첫 화면", artifact_id: null }],
      recorded_at: "",
      method: "record_based_rules",
      model_calls: 0,
    };
    server.use(
      http.get("*/api/personas/session", () =>
        HttpResponse.json({ ...session, answers: [answer] }),
      ),
    );
    renderSession(run.id!, session.id, "?tab=questions");

    await user.click(await screen.findByRole("button", { name: "근거: 스텝 1" }));

    expect(
      within(screen.getByRole("list", { name: "스텝" })).getAllByRole("listitem"),
    ).toHaveLength(12);
    expect(document.getElementById("session-step-1")).toHaveFocus();
  });

  it("요약에서 질문하면 질문 탭 제목으로 포커스를 옮기고 답을 받으면 알린다", async () => {
    const user = userEvent.setup();
    const run = await completeRun();
    renderSession(run.id!, pick(run.sessions, "success").id);

    await user.click(await screen.findByRole("button", { name: "개선하려면?" }));

    expect(screen.getByRole("heading", { name: "이 세션에 질문하기" })).toHaveFocus();
    expect(await screen.findByText("답을 받았어요")).toBeInTheDocument();
  });

  it("E06 비용 상한 — 한도 문구로 안내하고 응답 없음을 붙이지 않는다", async () => {
    const run = await completeRun();
    const base = pick(run.sessions, "success");
    server.use(
      http.get("*/api/personas/session", () =>
        HttpResponse.json({
          ...base,
          status: "budget_exceeded",
          reason: "실행당 비용 상한에 닿아 멈췄습니다.",
        }),
      ),
    );
    renderSession(run.id!, base.id);

    expect(await screen.findByText("실행당 비용 상한에 닿아 세션을 멈췄어요")).toBeInTheDocument();
    expect(
      screen.getByText("기록된 사유: 실행당 비용 상한에 닿아 멈췄습니다."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/응답 없음/)).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "멈추기 전 기록" })).toBeInTheDocument();
  });
});
