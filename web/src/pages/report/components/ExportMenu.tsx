import { useState } from "react";

import { getPersonaReportMarkdown, getPersonaReportPdf } from "@/apis/persona.api";
import Button from "@/components/Button/Button";
import DropdownMenu from "@/components/DropdownMenu/DropdownMenu";
import { useToastStore } from "@/stores/useToastStore";
import { ApiError } from "@/types/api.type";
import type { PersonaReport } from "@/types/persona.type";

import { downloadFile } from "../utils/downloadFile";

/*
  P13 내보내기 메뉴 — PDF · Markdown · 결과 JSON.
  - PDF 는 서버가 한 번에 1건만 만들어서, 만드는 동안 버튼을 막고 429 면 잠시 뒤 다시 시도하라고 알립니다.
  - JSON 은 이미 받은 리포트 응답을 그대로 저장합니다 (원본 실행 기록 · 개발·분석용).
*/
export default function ExportMenu({ report }: { report: PersonaReport }) {
  const show = useToastStore((state) => state.show);
  const dismiss = useToastStore((state) => state.dismiss);
  const [pdfPending, setPdfPending] = useState(false);
  const base = `dropspot-report-${report.run_id}`;

  const exportPdf = async () => {
    setPdfPending(true);
    /* 생성 안내는 끝나면 지우고 결과 알림으로 바꿉니다 (오래 걸려 자동으로 사라져도 결과는 알림) */
    const pending = show("PDF를 만들고 있어요. 끝나면 자동으로 내려받아요", "status-wait");
    try {
      downloadFile(await getPersonaReportPdf(report.run_id), `${base}.pdf`);
      dismiss(pending);
      show("PDF를 내려받았어요");
    } catch (error) {
      dismiss(pending);
      const busy = error instanceof ApiError && error.status === 429;
      show(
        busy
          ? "다른 PDF를 만드는 중이에요. 잠시 뒤 다시 시도해 주세요"
          : "PDF를 만들지 못했어요. 다시 시도해 주세요",
        "status-error",
      );
    } finally {
      setPdfPending(false);
    }
  };

  const exportMarkdown = async () => {
    try {
      const text = await getPersonaReportMarkdown(report.run_id);
      downloadFile(new Blob([text], { type: "text/markdown;charset=utf-8" }), `${base}.md`);
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
          description: pdfPending ? "만드는 중이에요" : "A4 · 요약부터 세션 근거까지",
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
