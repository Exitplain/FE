import DropdownMenu from "@/components/DropdownMenu/DropdownMenu";
import Icon from "@/components/Icon/Icon";
import { useRetestStore } from "@/stores/useRetestStore";
import type { PersonaReportSummary } from "@/types/persona.type";

import { runLabel } from "../utils/compareView";

/*
  Figma P18 A / B 실행 선택 — 완료된 실행 목록에서 고릅니다.
  반대편에서 고른 실행은 같은 실행끼리 비교하지 않도록 뺍니다.
*/
export default function RunPicker({
  side,
  runId,
  otherRunId,
  reports,
  onSelect,
}: {
  side: "A" | "B";
  runId: string;
  otherRunId: string;
  reports: PersonaReportSummary[];
  onSelect: (runId: string) => void;
}) {
  const retests = useRetestStore((state) => state.byRunId);
  const label = (id: string) => runLabel(reports, id, Boolean(retests[id]));
  const items = reports
    .filter((report) => report.run_id !== otherRunId)
    .map((report) => ({
      key: report.run_id,
      label: label(report.run_id),
      selected: report.run_id === runId,
      onSelect: () => {
        if (report.run_id !== runId) onSelect(report.run_id);
      },
    }));

  return (
    <DropdownMenu
      label={`${side} 실행 선택`}
      items={items}
      className="flex-1"
      renderTrigger={(props) => (
        <button
          type="button"
          {...props}
          className="flex min-h-10 w-full items-center gap-3 rounded-lg border border-line px-3 text-caption text-ink hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-ink"
        >
          <span className="font-bold">{side}</span>
          <span className="flex-1 text-left">{label(runId)}</span>
          <Icon name="chevron-right" className="size-5" />
        </button>
      )}
    />
  );
}
