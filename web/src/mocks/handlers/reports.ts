import { http, HttpResponse } from "msw";

import type { ShareLink } from "@/types/report.type";
import type { RunDetail, RunItem } from "@/types/run.type";

import { MockApiError, runList } from "../personaMock";
import { reportMarkdownV1, runIdOfReport, runReportV1 } from "../reportV1Mock";

/*
  제품 API 실행 상태·리포트·내보내기·공유 mock (P12·P13·P20·P21).
  개발 API mock 의 같은 실행(id)을 쓰므로 P01 목록·실행 화면 mock 과 이어집니다.
  mock 은 로그인·소유자를 따지지 않습니다 (실서버 리포트는 로그인 + 소유자만).
*/

function productError(status: number, code: string, message: string) {
  return HttpResponse.json(
    { error: { code, message, fields: {} }, request_id: "req_mock" },
    { status },
  );
}

const notFound = (message: string) => productError(404, "NOT_FOUND", message);

const PHASE: Record<RunItem["status"], RunDetail["phase"]> = {
  queued: "preparing",
  running: "running",
  finalizing: "analyzing",
  completed: "done",
  partially_completed: "done",
  failed: "failed",
  cancelled: "cancelled",
};

/* 조회만으로 실행이 진행되지 않게 progress 없이 목록을 봅니다 (진행은 P01·실행 화면 polling 이 맡음) */
function findRunItem(runId: string) {
  return runList({ progress: false }).find((item) => item.id === runId);
}

export function runDetailOf(item: RunItem): RunDetail {
  return {
    ...item,
    project_id: 1,
    phase: PHASE[item.status],
    cancel_requested: false,
    error:
      item.status === "failed"
        ? { code: "ALL_TASKS_FAILED", message: "모든 세션이 실패했어요." }
        : null,
    progress: {
      expected_sessions: 0,
      started_sessions: 0,
      finished_sessions: 0,
      sessions_by_status: {},
      task_runs: { total: 0, queued: 0, running: 0, succeeded: 0, failed: 0, cancelled: 0 },
    },
  };
}

/* 끝난 실행의 리포트. 진행 중(409)·없음(404) 모두 BE 처럼 404 "리포트가 아직 없습니다" */
function reportOf(runId: string) {
  try {
    return runReportV1(runId);
  } catch (error) {
    if (error instanceof MockApiError) return null;
    throw error;
  }
}

/* 공유 링크 (메모리). 테스트마다 resetReportMock 으로 비웁니다 */
let shareLinks: ShareLink[] = [];

export function resetReportMock() {
  shareLinks = [];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/* 화면 확인용 빈 PDF (실제 내용 없음) */
const MOCK_PDF = new TextEncoder().encode("%PDF-1.4\n% mock report\n%%EOF\n");

function exportedReport(reportId: string) {
  const runId = runIdOfReport(reportId);
  return runId ? reportOf(runId) : null;
}

export const reportHandlers = [
  http.get("*/api/v1/runs/:runId", ({ params }) => {
    const item = findRunItem(String(params.runId));
    return item ? HttpResponse.json(runDetailOf(item)) : notFound("실행을 찾을 수 없습니다.");
  }),
  http.get("*/api/v1/runs/:runId/reports", ({ params }) => {
    const report = reportOf(String(params.runId));
    return report ? HttpResponse.json(report) : notFound("이 실행의 리포트가 아직 없습니다.");
  }),
  http.get("*/api/v1/reports/:reportId/export.md", ({ params }) => {
    const report = exportedReport(String(params.reportId));
    if (!report) return notFound("리포트를 찾을 수 없습니다.");
    return new HttpResponse(reportMarkdownV1(report.run_ref), {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="exitplain-report-${report.run_ref}.md"`,
      },
    });
  }),
  http.get("*/api/v1/reports/:reportId/export.pdf", ({ params }) => {
    const report = exportedReport(String(params.reportId));
    if (!report) return notFound("리포트를 찾을 수 없습니다.");
    return new HttpResponse(MOCK_PDF, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="exitplain-report-${report.run_ref}.pdf"`,
      },
    });
  }),
  http.get("*/api/v1/reports/:reportId/share-links", ({ params }) => {
    if (!exportedReport(String(params.reportId))) return notFound("리포트를 찾을 수 없습니다.");
    return HttpResponse.json({
      items: shareLinks.filter((link) => link.report_id === params.reportId),
    });
  }),
  http.post("*/api/v1/reports/:reportId/share-links", ({ params }) => {
    const reportId = String(params.reportId);
    if (!exportedReport(reportId)) return notFound("리포트를 찾을 수 없습니다.");
    const now = Date.now();
    const token = `mock-share-${shareLinks.length + 1}`;
    const link: ShareLink = {
      id: `share-link-${shareLinks.length + 1}`,
      report_id: reportId,
      token,
      path: `/api/v1/shared/${token}`,
      state: "active",
      created_at: new Date(now).toISOString(),
      expires_at: new Date(now + 7 * DAY_MS).toISOString(),
      revoked_at: null,
    };
    shareLinks.push(link);
    return HttpResponse.json(link, { status: 201 });
  }),
  http.delete("*/api/v1/share-links/:linkId", ({ params }) => {
    const link = shareLinks.find((item) => item.id === params.linkId);
    if (!link) return notFound("공유 링크를 찾을 수 없습니다.");
    link.state = "revoked";
    link.revoked_at = new Date().toISOString();
    return new HttpResponse(null, { status: 204 });
  }),
  http.get("*/api/v1/shared/:token", ({ params }) => {
    const link = shareLinks.find((item) => item.token === params.token);
    if (!link || link.state === "revoked") return notFound("공유 링크를 찾을 수 없습니다.");
    if (link.state === "expired" || Date.parse(link.expires_at) <= Date.now()) {
      return productError(410, "SHARE_LINK_EXPIRED", "공유 링크가 만료되었습니다.");
    }
    const report = exportedReport(link.report_id);
    if (!report) return notFound("공유 링크를 찾을 수 없습니다.");
    const run = findRunItem(report.run_ref);
    /* 공유 응답은 report_dict 그대로라 revisions 가 없습니다 */
    return HttpResponse.json({
      report_id: report.report_id,
      run_ref: report.run_ref,
      revision: report.revision,
      status: report.status,
      source: report.source,
      kind: report.kind,
      plan_revision_id: report.plan_revision_id,
      created_at: report.created_at,
      data: report.data,
      shared: true,
      expires_at: link.expires_at,
      project: { name: "반찬로드" },
      run: { name: run?.name ?? "" },
    });
  }),
];

/* 테스트에서 server.use(...) 로 바꿔 끼우는 오류 응답 */
export const reportErrorHandlers = {
  reportNetworkError: http.get("*/api/v1/runs/:runId/reports", () => HttpResponse.error()),
  reportUnauthorized: http.get("*/api/v1/runs/:runId/reports", () =>
    productError(401, "AUTH_REQUIRED", "로그인이 필요합니다."),
  ),
  reportForbidden: http.get("*/api/v1/runs/:runId/reports", () =>
    productError(403, "FORBIDDEN", "권한이 없습니다."),
  ),
  pdfUnavailable: http.get("*/api/v1/reports/:reportId/export.pdf", () =>
    productError(
      503,
      "PDF_UNAVAILABLE",
      "지금은 PDF를 만들 수 없습니다. Markdown으로 내려받아 주세요.",
    ),
  ),
  sharedExpired: http.get("*/api/v1/shared/:token", () =>
    productError(410, "SHARE_LINK_EXPIRED", "공유 링크가 만료되었습니다."),
  ),
};
