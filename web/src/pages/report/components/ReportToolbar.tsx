import { useNavigate } from "react-router-dom";

import ChoiceChip from "@/components/ChoiceChip/ChoiceChip";
import DropdownMenu, { type DropdownMenuItem } from "@/components/DropdownMenu/DropdownMenu";
import Icon from "@/components/Icon/Icon";
import { buildPath } from "@/constants/routes";
import type { PersonaReportSummary, PersonaRun, ReportTask } from "@/types/persona.type";

import { formatDay } from "../utils/reportView";

type ReportToolbarProps = {
  projectId: string;
  runId: string;
  /* 지금 리포트의 차수와 실행일 (드롭다운 버튼 글자) */
  order: number | null;
  createdAt: string;
  reports: PersonaReportSummary[];
  currentRun: PersonaRun | undefined;
  tasks: ReportTask[];
  taskId: string | undefined;
  onTaskChange: (taskId: string) => void;
};

/*
  P12 머리말 아래 줄: 실행 선택(P12c) + 과업 칩.
  - 실행 목록은 완료 실행(최신순)이고, 진행 중인 실행은 보이기만 하고 고를 수 없습니다.
  - 다른 실행을 고르면 그 실행 리포트로 이동합니다(과업 선택은 처음으로).
*/
export default function ReportToolbar({
  projectId,
  runId,
  order,
  createdAt,
  reports,
  currentRun,
  tasks,
  taskId,
  onTaskChange,
}: ReportToolbarProps) {
  const navigate = useNavigate();
  const running =
    currentRun?.status === "running" &&
    currentRun.id &&
    !reports.some((report) => report.run_id === currentRun.id)
      ? currentRun
      : null;

  const items: DropdownMenuItem[] = [
    ...(running
      ? [
          {
            key: running.id!,
            label: `${reports.length + 1}차 · ${formatDay(running.created_at)}`,
            description: "실행 중 · 완료 후 선택할 수 있어요",
            disabled: true,
            selected: false,
            onSelect: () => {},
          },
        ]
      : []),
    ...reports.map((report, index) => ({
      key: report.run_id,
      label: `${reports.length - index}차 · ${formatDay(report.created_at)}`,
      description: `완료 · 세션 ${report.sessions}개`,
      selected: report.run_id === runId,
      /* 보고 있는 실행을 다시 고르면 기록만 쌓이고 ?task= 가 사라지므로 이동하지 않습니다 */
      onSelect: () => {
        if (report.run_id !== runId) {
          navigate(buildPath("report", { projectId, runId: report.run_id }));
        }
      },
    })),
  ];

  /* Figma: "첫 주문 완료 · 3차 · 11월 7일 · 완료" */
  const taskName = tasks.find((task) => task.id === taskId)?.name;
  const runLabel = [taskName, order ? `${order}차` : null, formatDay(createdAt), "완료"]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex items-center gap-3">
        <span className="text-caption font-medium text-gray-800">실행</span>
        {items.length === 0 ? (
          /* 완료 목록을 아직 받지 못했으면 빈 메뉴 대신 지금 실행만 보여줍니다 */
          <span className="inline-flex min-h-10 items-center rounded-lg bg-gray-50 p-3 text-sm text-gray-800">
            {runLabel}
          </span>
        ) : (
          <DropdownMenu
            label="실행 선택"
            items={items}
            renderTrigger={(props) => (
              <button
                type="button"
                {...props}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-gray-50 p-3 text-sm text-gray-800 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-ink"
              >
                {runLabel}
                <Icon name="chevron-right" className="size-5" />
              </button>
            )}
          />
        )}
      </div>
      {tasks.length > 0 && (
        <div className="flex items-center gap-3">
          <span className="text-caption font-medium text-gray-800">과업</span>
          <div role="radiogroup" aria-label="과업" className="flex flex-wrap gap-2">
            {tasks.map((task) => (
              <ChoiceChip
                key={task.id}
                kind="radio"
                selected={task.id === taskId}
                onClick={() => onTaskChange(task.id)}
              >
                {task.name}
              </ChoiceChip>
            ))}
          </div>
        </div>
      )}
      <p className="text-xs text-muted">이전 완료 실행의 리포트도 여기서 골라 볼 수 있어요</p>
    </div>
  );
}
