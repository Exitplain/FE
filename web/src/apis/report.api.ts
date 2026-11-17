import type {
  ReportSessionDetail,
  ReportSessionKey,
  RunReport,
  ShareLink,
  SharedReport,
} from "@/types/report.type";

import axiosInstance from "./axiosInstance";

/*
  제품 API 리포트 (P12·P13·P20·P21). 리포트는 로그인 + 프로젝트 소유자만 볼 수 있습니다 (샘플도 같음).
  공유 보기(GET /api/v1/shared/{token})만 로그인 없이 됩니다.
*/

/* 실행의 최신 리포트. 아직 만들어지지 않았으면 404 ("이 실행의 리포트가 아직 없습니다.") */
export async function getRunReport(runId: string): Promise<RunReport> {
  const { data } = await axiosInstance.get<RunReport>(
    `/api/v1/runs/${encodeURIComponent(runId)}/reports`,
  );
  return data;
}

/*
  P15 세션 상세 — 리포트의 세션 한 줄(task_id · seed · persona_id)로 타임라인·좌절 점수를 받습니다.
  리포트에 없는 세션은 404, 세션 기록이 지워졌으면 409 SESSION_FILES_MISSING
*/
export async function getReportSession(
  reportId: string,
  { taskId, seed, personaId }: ReportSessionKey,
): Promise<ReportSessionDetail> {
  const path = [reportId, "sessions", taskId, String(seed), personaId]
    .map(encodeURIComponent)
    .join("/");
  const { data } = await axiosInstance.get<ReportSessionDetail>(`/api/v1/reports/${path}`);
  return data;
}

export type DownloadedFile = { blob: Blob; fileName: string | null };

/* Content-Disposition: attachment; filename="..." 에서 파일 이름을 꺼냅니다 */
export function fileNameOf(disposition: unknown): string | null {
  if (typeof disposition !== "string") return null;
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  if (encoded) {
    try {
      return decodeURIComponent(encoded[1].trim());
    } catch {
      /* 잘못 인코딩된 이름은 아래 일반 filename 으로 */
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(disposition);
  return plain ? plain[1].trim() : null;
}

async function download(path: string): Promise<DownloadedFile> {
  const response = await axiosInstance.get<Blob>(path, { responseType: "blob" });
  return { blob: response.data, fileName: fileNameOf(response.headers["content-disposition"]) };
}

/* P13 Markdown 내려받기 */
export function exportReportMarkdown(reportId: string): Promise<DownloadedFile> {
  return download(`/api/v1/reports/${encodeURIComponent(reportId)}/export.md`);
}

/* P13 PDF 내려받기 (서버가 Chromium 으로 인쇄, 1~3초). 만들 수 없으면 503 PDF_UNAVAILABLE */
export function exportReportPdf(reportId: string): Promise<DownloadedFile> {
  return download(`/api/v1/reports/${encodeURIComponent(reportId)}/export.pdf`);
}

/* P20 공유 링크 목록 (취소·만료된 것 포함) */
export async function getShareLinks(reportId: string): Promise<ShareLink[]> {
  const { data } = await axiosInstance.get<{ items: ShareLink[] }>(
    `/api/v1/reports/${encodeURIComponent(reportId)}/share-links`,
  );
  return data.items;
}

/* P20 공유 링크 만들기 (기본 7일, 1~30일) */
export async function createShareLink(
  reportId: string,
  expiresInDays?: number,
): Promise<ShareLink> {
  const { data } = await axiosInstance.post<ShareLink>(
    `/api/v1/reports/${encodeURIComponent(reportId)}/share-links`,
    expiresInDays === undefined ? {} : { expires_in_days: expiresInDays },
  );
  return data;
}

/* P21 공유 리포트. 없거나 취소된 링크는 404, 만료된 링크는 410 SHARE_LINK_EXPIRED */
export async function getSharedReport(token: string): Promise<SharedReport> {
  const { data } = await axiosInstance.get<SharedReport>(
    `/api/v1/shared/${encodeURIComponent(token)}`,
  );
  return data;
}
