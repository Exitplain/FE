import { useState } from "react";

import { exportReportMarkdown, exportReportPdf } from "@/apis/report.api";
import Button from "@/components/Button/Button";
import DropdownMenu from "@/components/DropdownMenu/DropdownMenu";
import { useToastStore } from "@/stores/useToastStore";
import { ApiError } from "@/types/api.type";
import type { RunReport } from "@/types/report.type";

import { downloadFile } from "../utils/downloadFile";

/*
  P13 내보내기 메뉴 — PDF · Markdown · 결과 JSON (GET /api/v1/reports/{id}/export.pdf|md).
  - 파일 이름은 서버가 정한 이름(Content-Disposition)을 쓰고, 없으면 리포트 id 로 만듭니다.
  - PDF 를 만들 수 없으면(503 PDF_UNAVAILABLE) Markdown 으로 받으라고 안내합니다.
  - JSON 은 이미 받은 리포트 응답을 그대로 저장합니다 (원본 집계 · 개발·분석용).
*/
export default function ExportMenu({ report }: { report: RunReport }) {
  const show = useToastStore((state) => state.show);
  const dismiss = useToastStore((state) => state.dismiss);
  const [pdfPending, setPdfPending] = useState(false);
  const base = `exitplain-report-${report.report_id}`;

  const exportPdf = async () => {
    setPdfPending(true);
    /* 생성 안내는 끝나면 지우고 결과 알림으로 바꿉니다 (오래 걸려 자동으로 사라져도 결과는 알림) */
    const pending = show("PDF를 만들고 있어요. 끝나면 자동으로 내려받아요", "status-wait");
    try {
      const file = await exportReportPdf(report.report_id);
      downloadFile(file.blob, file.fileName ?? `${base}.pdf`);
      dismiss(pending);
      show("PDF를 내려받았어요");
    } catch (error) {
      dismiss(pending);
      const unavailable = error instanceof ApiError && error.code === "PDF_UNAVAILABLE";
      show(
        unavailable
          ? "지금은 PDF를 만들 수 없어요. Markdown으로 내려받아 주세요"
          : "PDF를 만들지 못했어요. 다시 시도해 주세요",
        "status-error",
      );
    } finally {
      setPdfPending(false);
    }
  };

  const exportMarkdown = async () => {
    try {
      const file = await exportReportMarkdown(report.report_id);
      downloadFile(file.blob, file.fileName ?? `${base}.md`);
    } catch {
      show("Markdown을 내려받지 못했어요. 다시 시도해 주세요", "status-error");
    }
  };

  const exportJson = () =>
    downloadFile(
      new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }),
      `${base}.json`,
    );

  return (
    <DropdownMenu
      label="내보내기 형식"
      align="end"
      items={[
        {
          key: "pdf",
          label: "PDF로 내보내기",
          description: pdfPending ? "만드는 중이에요" : "A4 · 요약부터 방문 근거까지",
          disabled: pdfPending,
          onSelect: () => void exportPdf(),
        },
        {
          key: "md",
          label: "Markdown으로 내보내기",
          description: "텍스트 · 표 포함",
          onSelect: () => void exportMarkdown(),
        },
        {
          key: "json",
          label: "결과 JSON 내보내기",
          description: "원본 실행 기록 · 개발·분석용",
          onSelect: exportJson,
        },
      ]}
      renderTrigger={(props) => (
        <Button variant="secondary" icon="download" {...props}>
          내보내기
        </Button>
      )}
    />
  );
}
