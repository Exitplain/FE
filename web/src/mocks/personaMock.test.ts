import { describe, expect, it, vi } from "vitest";

import {
  confirmPersonaRun,
  discoverPersonaPlan,
  explainPersonaSession,
  getPersonaReport,
  getPersonaReportMarkdown,
  getPersonaReportPdf,
  getPersonaReports,
  getPersonaRun,
  saveHumanObservation,
} from "@/apis/persona.api";
import { server } from "@/mocks/node";
import type { ConfirmRequest, HumanObservationRequest } from "@/types/persona.type";

import { personaErrorHandlers } from "./handlers/personas";

async function confirmBody(overrides: Partial<ConfirmRequest> = {}): Promise<ConfirmRequest> {
  const plan = await discoverPersonaPlan({ variant: "problem" });
  return {
    plan_id: plan.plan_id,
    feature_ids: ["shopping", "coupon"],
    task_ids: ["order", "coupon"],
    ages: ["30s"],
    context: "퇴근 후 모바일로 저녁 반찬을 처음 주문하는 1~2인 가구",
    additional_request: "",
    ...overrides,
  };
}

/* 실행이 끝날 때까지 상태를 조회합니다 (mock 은 조회할 때마다 한 단계씩 진행) */
async function runToCompletion() {
  for (let i = 0; i < 100; i += 1) {
    const run = await getPersonaRun();
    if (run.status === "completed") return run;
  }
  throw new Error("mock 실행이 끝나지 않았습니다");
}

describe("페르소나 mock — 탐색", () => {
  it("BE 와 같은 기능·과업·연령 후보와 plan_id 를 준다", async () => {
    const plan = await discoverPersonaPlan({ variant: "fixed" });

    expect(plan.plan_id).toEqual(expect.any(String));
    expect(plan.features.map((feature) => feature.id)).toEqual([
      "shopping",
      "delivery",
      "coupon",
      "subscription",
    ]);
    expect(plan.tasks.find((task) => task.id === "order")).toMatchObject({
      feature_id: "shopping",
      suggested: true,
    });
    expect(plan.age_options.any).toBe("전체 연령");
  });

  it("variant 외의 키가 있으면 400", async () => {
    await expect(
      discoverPersonaPlan({ variant: "fixed", url: "https://x" } as never),
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe("페르소나 mock — 확인 검증 (BE preflight.confirm 규칙)", () => {
  it.each([
    ["필드 누락", (body: ConfirmRequest) => ({ ...body, context: undefined })],
    ["없는 plan_id", (body: ConfirmRequest) => ({ ...body, plan_id: "unknown" })],
    ["전체 연령과 특정 연령을 함께", (body: ConfirmRequest) => ({ ...body, ages: ["any", "30s"] })],
    ["고르지 않은 기능의 과업", (body: ConfirmRequest) => ({ ...body, task_ids: ["delivery"] })],
    ["빈 과업", (body: ConfirmRequest) => ({ ...body, task_ids: [] })],
    ["500자 초과", (body: ConfirmRequest) => ({ ...body, context: "가".repeat(501) })],
    ["추가 키", (body: ConfirmRequest) => ({ ...body, url: "https://x" })],
  ])("%s → 400", async (_, change) => {
    const body = change(await confirmBody()) as ConfirmRequest;

    await expect(confirmPersonaRun(body)).rejects.toMatchObject({ status: 400 });
  });

  it("탐색한 지 15분이 지나면 계획이 만료돼 400", async () => {
    const body = await confirmBody();
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now + 15 * 60 * 1000);

    await expect(confirmPersonaRun(body)).rejects.toMatchObject({
      status: 400,
      message: "탐색 결과가 만료됐습니다. 다시 확인해주세요.",
    });
  });

  it("실행 중에 다시 확인하면 409", async () => {
    await confirmPersonaRun(await confirmBody());

    await expect(confirmPersonaRun(await confirmBody())).rejects.toMatchObject({ status: 409 });
  });
});

describe("페르소나 mock — 실행", () => {
  it("확인하면 에이전트 20명 × 과업 세션이 준비 단계·대기 상태로 시작한다", async () => {
    const run = await confirmPersonaRun(await confirmBody());

    expect(run.status).toBe("running");
    expect(run.stage).toBe("preparing");
    expect(run.prepare).toEqual({ browsers_ready: 0, browsers_total: 20 });
    expect(run.seeds).toEqual({ current: 1, total: 3 });
    expect(run.sessions).toHaveLength(40);
    expect(run.sessions[0]).toMatchObject({
      id: "P-001_order",
      code: "P-001",
      segment_name: "빠른 구매형",
      seed: 1,
    });
    expect(run.sessions.every((session) => session.status === "queued")).toBe(true);
    expect(run.panel?.map((segment) => segment.count)).toEqual([5, 5, 5, 5]);
    expect(run.audience?.ages).toEqual(["30s"]);
  });

  it("준비 → 실행(시드 1~3) → 분석 1~3단계 → 완료 순서로 진행한다", async () => {
    await confirmPersonaRun(await confirmBody());

    const stages: string[] = [];
    const seeds = new Set<number>();
    const steps = new Set<number>();
    for (let i = 0; i < 100; i += 1) {
      const run = await getPersonaRun();
      if (stages.at(-1) !== run.stage) stages.push(run.stage!);
      if (run.stage === "running") seeds.add(run.seeds!.current);
      if (run.stage === "analyzing") steps.add(run.analysis!.step);
      expect(run.sessions.filter((s) => s.status === "running").length).toBeLessThanOrEqual(20);
      if (run.status === "completed") break;
    }

    expect(stages).toEqual(["preparing", "running", "analyzing", "completed"]);
    expect([...seeds]).toEqual([1, 2, 3]);
    expect([...steps]).toEqual([1, 2, 3]);
  });

  it("세션은 진행하면서 행동 기록·Think-aloud 발화·토큰·비용이 쌓인다 (임시 필드)", async () => {
    await confirmPersonaRun(await confirmBody());

    const run = await runToCompletion();
    const session = run.sessions[0];

    expect(session.events.length).toBeGreaterThan(0);
    expect(session.utterances?.length).toBe(session.events.length);
    expect(session.tokens).toBeGreaterThan(0);
    expect(session.elapsed_ms).toBeGreaterThan(0);
  });

  it("배송 지역 확인은 모든 세션이 접속 실패라 첫 시드에서 끝난다 (E05 예시)", async () => {
    await confirmPersonaRun(
      await confirmBody({ feature_ids: ["delivery"], task_ids: ["delivery"] }),
    );

    const run = await runToCompletion();

    expect(run.seeds?.current).toBe(1);
    expect(run.sessions.every((s) => s.status === "agent_failure")).toBe(true);
  });

  it("과업이 5개 이상이면 시드 2 중간에 비용 상한으로 멈추고 부분 결과로 끝난다 (E12 예시)", async () => {
    await confirmPersonaRun(
      await confirmBody({
        feature_ids: ["shopping", "coupon", "subscription"],
        task_ids: ["order", "cart", "coupon", "benefit", "subscription"],
      }),
    );

    const run = await runToCompletion();

    expect(run.stopped).toMatchObject({ reason: "budget", seed: 2, total: 300, cost_ratio: 1 });
    expect(run.stopped!.finished).toBeLessThan(run.stopped!.total);
    const report = await getPersonaReport(run.id!);
    expect(report.limitations.join(" ")).toMatch(/비용 상한/);
  });

  it("끝나면 completed 가 되고 모든 세션이 종료 상태다", async () => {
    await confirmPersonaRun(await confirmBody());

    const run = await runToCompletion();

    expect(run.sessions.every((s) => !["queued", "running"].includes(s.status))).toBe(true);
    expect(run.sessions.some((s) => s.status === "simulated_dropout")).toBe(true);
    expect(run.sessions.some((s) => s.status === "success")).toBe(true);
  });

  it("완료된 실행은 목록에 최신순으로 나온다", async () => {
    await confirmPersonaRun(await confirmBody());
    const first = await runToCompletion();
    await confirmPersonaRun(await confirmBody({ task_ids: ["order"], feature_ids: ["shopping"] }));
    const second = await runToCompletion();

    const reports = await getPersonaReports();

    expect(reports.map((report) => report.run_id)).toEqual([second.id, first.id]);
    expect(reports[1]).toMatchObject({ sessions: 40, variant: "problem" });
  });
});

describe("페르소나 mock — 세션 질문 (BE session_explain 규칙)", () => {
  it("질문을 다듬어 기록 기반으로 답하고, 세션 answers 에 쌓는다", async () => {
    await confirmPersonaRun(await confirmBody());
    const run = await runToCompletion();
    const sessionId = run.sessions[0].id;

    const answer = await explainPersonaSession({
      run_id: run.id!,
      session_id: sessionId,
      question: "  왜 멈췄나요?  ",
    });

    expect(answer).toMatchObject({
      question: "왜 멈췄나요?",
      method: "record_based_rules",
      supported_by_record: true,
    });
    const after = await getPersonaRun();
    expect(after.sessions.find((s) => s.id === sessionId)?.answers?.at(-1)?.id).toBe(answer.id);
  });

  it("아직 끝나지 않은 세션의 답은 기록 근거가 없다고 표시한다", async () => {
    const run = await confirmPersonaRun(await confirmBody());

    const answer = await explainPersonaSession({
      run_id: run.id!,
      session_id: run.sessions[0].id,
      question: "지금 뭐 하나요?",
    });

    expect(answer).toMatchObject({ kind: "execution_status", supported_by_record: false });
  });

  it.each([
    ["다른 실행", { run_id: "other" }],
    ["없는 세션", { session_id: "nobody" }],
    ["빈 질문", { question: "   " }],
    ["500자 초과 질문", { question: "가".repeat(501) }],
    ["잘못된 step", { step: 0 }],
    ["추가 키", { extra: true }],
  ])("%s → 400", async (_, change) => {
    await confirmPersonaRun(await confirmBody());
    const run = await runToCompletion();
    const body = { run_id: run.id!, session_id: run.sessions[0].id, question: "왜?", ...change };

    await expect(explainPersonaSession(body as never)).rejects.toMatchObject({ status: 400 });
  });
});

describe("페르소나 mock — 실패 응답", () => {
  it("탐색 실패(503)를 재현할 수 있다", async () => {
    server.use(personaErrorHandlers.discoverUnavailable);

    await expect(discoverPersonaPlan({ variant: "fixed" })).rejects.toMatchObject({ status: 503 });
  });

  it("계획 만료(400)를 재현할 수 있다", async () => {
    server.use(personaErrorHandlers.confirmExpired);

    await expect(confirmPersonaRun(await confirmBody())).rejects.toMatchObject({
      status: 400,
      message: "탐색 결과가 만료됐습니다. 다시 확인해주세요.",
    });
  });

  it("PDF 생성 중(429)·실패(503)는 blob 응답이어도 서버 메시지를 읽는다", async () => {
    await confirmPersonaRun(await confirmBody());
    const run = await runToCompletion();

    server.use(personaErrorHandlers.pdfBusy);
    await expect(getPersonaReportPdf(run.id!)).rejects.toMatchObject({
      status: 429,
      message: "PDF를 만드는 중입니다. 잠시 뒤 다시 시도해주세요.",
    });

    server.use(personaErrorHandlers.pdfFailed);
    await expect(getPersonaReportPdf(run.id!)).rejects.toMatchObject({ status: 503 });
  });
});

describe("페르소나 mock — 리포트", () => {
  it("완료된 실행의 결과를 가상 이탈·기술 실패로 나눠 센다", async () => {
    await confirmPersonaRun(
      await confirmBody({ feature_ids: ["shopping", "delivery"], task_ids: ["order", "delivery"] }),
    );
    const run = await runToCompletion();

    const report = await getPersonaReport(run.id!);

    expect(report.summary).toMatchObject({ sessions: 40, simulated_dropout: 10, technical: 20 });
    expect(report.technical_failures).toHaveLength(20);
    expect(report.technical_failures[0]).toMatchObject({
      session_id: "P-001_delivery",
      persona_name: "P-001",
      status: "agent_failure",
    });
    /* 기술 실패는 퍼널 분모에서 빠집니다 */
    const delivery = report.tasks.find((task) => task.id === "delivery");
    expect(delivery).toMatchObject({ total: 20, technical: 20 });
    expect(delivery?.funnel?.[0]).toMatchObject({ stage: "landing", reached: [0, 0] });
  });

  it("과업 퍼널은 단계별 도달·이탈 인원을 범위로 주고, 이탈은 문제로 묶는다", async () => {
    await confirmPersonaRun(await confirmBody({ feature_ids: ["shopping"], task_ids: ["order"] }));
    const run = await runToCompletion();

    const report = await getPersonaReport(run.id!);
    const funnel = report.tasks[0].funnel!;

    /* 시드 3회의 [최소, 최대]. 가입 화면에서 떠난 세션은 장바구니까지만 넘어온 것으로 셉니다 */
    expect(funnel.map((stage) => stage.reached)).toEqual([
      [20, 20],
      [17, 20],
      [17, 20],
      [10, 15],
      [8, 13],
      [8, 13],
    ]);
    expect(funnel.map((stage) => stage.dropout)).toEqual([
      [0, 0],
      [0, 3],
      [0, 0],
      [5, 8],
      [2, 2],
      [0, 0],
    ]);
    /* 문제 수는 대표 시드(시드 1) 기준 */
    expect(report.findings).toEqual([
      expect.objectContaining({
        stage: "signup",
        category: "input_burden",
        affected_sessions: 8,
        task_sessions: 20,
      }),
      expect.objectContaining({ stage: "checkout", category: "cost", affected_sessions: 2 }),
    ]);
    /* mock 은 화면을 캡처하지 않아 근거 이미지를 만들어 채우지 않습니다 */
    expect(report.findings[0].evidence[0]).toMatchObject({
      session_id: "P-001_order",
      artifact_id: null,
      evidence_status: "missing",
    });
    expect(report.summary.missing_evidence).toBe(10);
  });

  it("run_id 를 생략하면 현재 실행의 리포트를 준다", async () => {
    await confirmPersonaRun(await confirmBody());
    const run = await runToCompletion();

    const response = await fetch("http://localhost/api/personas/report");

    expect((await response.json()).run_id).toBe(run.id);
  });

  it("실행 중이면 409, 없는 실행이면 404", async () => {
    const running = await confirmPersonaRun(await confirmBody());

    await expect(getPersonaReport(running.id!)).rejects.toMatchObject({ status: 409 });
    await expect(getPersonaReport("mock-run-없음")).rejects.toMatchObject({ status: 404 });
  });

  it("Markdown 오류는 text 응답이어도 서버 메시지를 읽는다", async () => {
    await expect(getPersonaReportMarkdown("mock-run-없음")).rejects.toMatchObject({
      status: 404,
      message: "저장된 실행을 찾을 수 없습니다.",
    });
  });

  it("사람 관측이 없으면 일치 요약은 unverified 다", async () => {
    await confirmPersonaRun(await confirmBody());
    const run = await runToCompletion();

    const report = await getPersonaReport(run.id!);

    expect(report.alignment).toMatchObject({
      observations: 0,
      metrics: { outcome: { matched: 0, total: 0 } },
      status: "unverified",
    });
  });

  it("세그먼트별 이탈 합계는 퍼널 이탈과 같고, 실측 비교·조건은 과업마다 채운다 (임시 필드)", async () => {
    await confirmPersonaRun(await confirmBody());
    const run = await runToCompletion();

    const report = await getPersonaReport(run.id!);

    for (const task of report.tasks) {
      const funnel = task.funnel!;
      /*
        시드마다는 구간 i → i+1 의 세그먼트 합 = 퍼널 i+1 단계 이탈.
        범위는 세그먼트·퍼널을 따로 [최소, 최대] 로 합쳐, 세그먼트 합의 범위가 퍼널 범위를 감쌉니다
      */
      funnel.slice(1).forEach((stage, index) => {
        const [low, high] = task.segments!.reduce(
          ([min, max], segment) => [
            min + segment.dropouts[index][0],
            max + segment.dropouts[index][1],
          ],
          [0, 0],
        );
        expect(low).toBeLessThanOrEqual(stage.dropout[0]);
        expect(high).toBeGreaterThanOrEqual(stage.dropout[1]);
      });
      expect(task.actual).toMatchObject({ status: "comparable" });
    }
    const order = report.tasks.find((task) => task.id === "order")!;
    expect(order.actual).toMatchObject({ max_drop: { predicted: ["cart", "signup"] } });
    expect(order.median_duration).toEqual([86, 95]);
    expect(report.conditions).toEqual({
      panel_size: 20,
      seeds: 3,
      calibrated_at: "2026-11-05T05:50:00+00:00",
    });
  });

  it("Markdown 과 PDF 로 내보낼 수 있다", async () => {
    await confirmPersonaRun(await confirmBody());
    const run = await runToCompletion();

    expect(await getPersonaReportMarkdown(run.id!)).toContain(`# 사전 테스트 리포트 (${run.id})`);
    const pdf = await getPersonaReportPdf(run.id!);
    expect(pdf).toBeInstanceOf(Blob);
    expect(pdf.type).toBe("application/pdf");
  });
});

describe("페르소나 mock — 사람 관측 (명세 5.2)", () => {
  async function completedRun() {
    await confirmPersonaRun(await confirmBody({ feature_ids: ["shopping"], task_ids: ["order"] }));
    return runToCompletion();
  }

  function observation(
    runId: string,
    overrides: Partial<HumanObservationRequest> = {},
  ): HumanObservationRequest {
    return {
      run_id: runId,
      persona_id: "P-001_order",
      participant_id: "H-001",
      outcome: "dropout",
      stage: "signup",
      cause: "input_burden",
      source: "참여자 01 관측 기록",
      ...overrides,
    };
  }

  it("저장하면 관측이 쌓이고 예측과의 일치 요약이 리포트에 나온다", async () => {
    const run = await completedRun();

    await saveHumanObservation(observation(run.id!));
    const saved = await saveHumanObservation(
      observation(run.id!, {
        persona_id: "P-002_order",
        participant_id: "H-002",
        stage: "cart",
        cause: "cost",
      }),
    );

    expect(saved.human_observations).toHaveLength(2);
    const report = await getPersonaReport(run.id!);
    expect(report.alignment).toMatchObject({
      participants: 2,
      observations: 2,
      /* P-002_order 는 예측상 완료 → 결과·단계·원인 모두 다름 */
      metrics: {
        outcome: { matched: 1, total: 2 },
        stage: { matched: 1, total: 2 },
        cause: { matched: 1, total: 2 },
      },
      status: "partial",
    });
  });

  it("기술 실패 세션에 대응한 관측은 예측 비교에서 뺀다 (이탈 일치로 세지 않음)", async () => {
    await confirmPersonaRun(
      await confirmBody({ feature_ids: ["delivery"], task_ids: ["delivery"] }),
    );
    const run = await runToCompletion();

    await saveHumanObservation(
      observation(run.id!, {
        persona_id: "P-001_delivery",
        stage: "delivery",
        cause: "unknown",
      }),
    );
    const report = await getPersonaReport(run.id!);

    expect(report.alignment).toMatchObject({
      observations: 1,
      metrics: { outcome: { matched: 0, total: 0 } },
      status: "unverified",
    });
  });

  it("같은 참여자 × 과업 × 세션은 갱신하고, 다른 세션에 대응하면 400", async () => {
    const run = await completedRun();
    await saveHumanObservation(observation(run.id!));

    const updated = await saveHumanObservation(
      observation(run.id!, { source: "다시 확인한 기록" }),
    );
    expect(updated.human_observations).toEqual([
      expect.objectContaining({ participant_id: "H-001", source: "다시 확인한 기록" }),
    ]);

    await expect(
      saveHumanObservation(observation(run.id!, { persona_id: "P-002_order" })),
    ).rejects.toMatchObject({ status: 400 });
  });

  it.each([
    ["참여자 코드 형식", { participant_id: "참여자 1" }],
    ["근거 3자 미만", { source: "  짧 " }],
    ["other 단계", { stage: "other" as never }],
    ["완료인데 이탈 원인", { outcome: "success" as const, stage: "complete" as const }],
  ])("%s 이면 400", async (_, overrides) => {
    const run = await completedRun();

    await expect(saveHumanObservation(observation(run.id!, overrides))).rejects.toMatchObject({
      status: 400,
    });
  });

  it("실행이 끝나기 전에는 저장할 수 없다", async () => {
    const running = await confirmPersonaRun(await confirmBody());

    await expect(saveHumanObservation(observation(running.id!))).rejects.toMatchObject({
      status: 400,
    });
  });
});
