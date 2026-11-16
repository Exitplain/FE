import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { confirmPersonaRun, discoverPersonaPlan } from "@/apis/persona.api";
import { getRunReport } from "@/apis/report.api";
import ToastViewport from "@/components/Toast/ToastViewport";
import { reportErrorHandlers } from "@/mocks/handlers/reports";
import { server } from "@/mocks/node";
import { finishPersonaMock } from "@/mocks/personaMock";
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
  /* 제품 API 리포트 (GET /api/v1/runs/{id}/reports) */
  return getRunReport(finishPersonaMock().id!);
}

describe("P13 내보내기 메뉴", () => {
  /* jsdom 에는 파일 다운로드용 객체 주소가 없어 대신 넣고, 무엇을 받았는지 봅니다 */
  const created: Blob[] = [];
  const names: string[] = [];
  const click = HTMLAnchorElement.prototype.click;
  beforeEach(() => {
    created.length = 0;
    names.length = 0;
    /* 내려받는 파일 이름(a[download])을 봅니다. jsdom 은 이동하지 않습니다 */
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
      names.push(this.download);
    };
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
    HTMLAnchorElement.prototype.click = click;
    useToastStore.setState({ toasts: [] });
  });

  it("PDF·Markdown 은 리포트 id 로 서버에서 받고, JSON 은 받은 리포트를 저장한다", async () => {
    const report = await completedReport();
    render(<ExportMenu report={report} />);

    for (const [name, type] of [
      ["PDF로 내보내기", "application/pdf"],
      ["Markdown으로 내보내기", "text/markdown; charset=utf-8"],
      ["결과 JSON 내보내기", "application/json"],
    ]) {
      await userEvent.click(screen.getByRole("button", { name: "내보내기" }));
      await userEvent.click(screen.getByRole("menuitem", { name: new RegExp(name) }));
      await waitFor(() => expect(created.at(-1)?.type).toBe(type));
    }
    expect(created).toHaveLength(3);
    /* 서버가 정한 파일 이름(Content-Disposition)을 쓰고, JSON 은 리포트 id 로 */
    expect(names).toEqual([
      `exitplain-report-${report.run_ref}.pdf`,
      `exitplain-report-${report.run_ref}.md`,
      `exitplain-report-${report.report_id}.json`,
    ]);
  });

  it("PDF 를 만들 수 없으면(503 PDF_UNAVAILABLE) Markdown 으로 받으라고 알린다", async () => {
    const report = await completedReport();
    server.use(reportErrorHandlers.pdfUnavailable);
    render(
      <>
        <ExportMenu report={report} />
        <ToastViewport />
      </>,
    );

    await userEvent.click(screen.getByRole("button", { name: "내보내기" }));
    await userEvent.click(screen.getByRole("menuitem", { name: /PDF로 내보내기/ }));

    expect(
      await screen.findByText("지금은 PDF를 만들 수 없어요. Markdown으로 내려받아 주세요"),
    ).toBeInTheDocument();
    expect(created).toHaveLength(0);
  });
});
