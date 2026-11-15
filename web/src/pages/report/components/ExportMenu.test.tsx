import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  confirmPersonaRun,
  discoverPersonaPlan,
  getPersonaReport,
  getPersonaRun,
} from "@/apis/persona.api";
import ToastViewport from "@/components/Toast/ToastViewport";
import { personaErrorHandlers } from "@/mocks/handlers/personas";
import { server } from "@/mocks/node";
import { useToastStore } from "@/stores/useToastStore";

import ExportMenu from "./ExportMenu";

async function completedReport() {
  const plan = await discoverPersonaPlan({ variant: "problem" });
  await confirmPersonaRun({
    plan_id: plan.plan_id,
    feature_ids: ["shopping"],
    task_ids: ["order"],
    ages: ["any"],
    context: "",
    additional_request: "",
  });
  for (let i = 0; i < 30; i += 1) {
    const run = await getPersonaRun();
    if (run.status === "completed") return getPersonaReport(run.id!);
  }
  throw new Error("mock 실행이 끝나지 않았습니다");
}

describe("P13 내보내기 메뉴", () => {
  /* jsdom 에는 파일 다운로드용 객체 주소가 없어 대신 넣고, 무엇을 받았는지 봅니다 */
  const created: Blob[] = [];
  beforeEach(() => {
    created.length = 0;
    /* URL 전체를 바꾸면 axios 가 쓰는 new URL() 이 깨지므로 두 함수만 넣습니다 */
    Object.assign(URL, {
      createObjectURL: (blob: Blob) => {
        created.push(blob);
        return "blob:test";
      },
      revokeObjectURL: () => {},
    });
  });
  afterEach(() => {
    Reflect.deleteProperty(URL, "createObjectURL");
    Reflect.deleteProperty(URL, "revokeObjectURL");
    useToastStore.setState({ toasts: [] });
  });

  it("PDF·Markdown·JSON 을 내려받는다", async () => {
    const report = await completedReport();
    render(<ExportMenu report={report} />);

    for (const [name, type] of [
      ["PDF로 내보내기", "application/pdf"],
      ["Markdown으로 내보내기", "text/markdown;charset=utf-8"],
      ["결과 JSON 내보내기", "application/json"],
    ]) {
      await userEvent.click(screen.getByRole("button", { name: "내보내기" }));
      await userEvent.click(screen.getByRole("menuitem", { name: new RegExp(name) }));
      await waitFor(() => expect(created.at(-1)?.type).toBe(type));
    }
    expect(created).toHaveLength(3);
  });

  it("다른 PDF 를 만드는 중(429)이면 잠시 뒤 다시 시도하라고 알린다", async () => {
    const report = await completedReport();
    server.use(personaErrorHandlers.pdfBusy);
    render(
      <>
        <ExportMenu report={report} />
        <ToastViewport />
      </>,
    );

    await userEvent.click(screen.getByRole("button", { name: "내보내기" }));
    await userEvent.click(screen.getByRole("menuitem", { name: /PDF로 내보내기/ }));

    expect(
      await screen.findByText("다른 PDF를 만드는 중이에요. 잠시 뒤 다시 시도해 주세요"),
    ).toBeInTheDocument();
    expect(created).toHaveLength(0);
  });
});
