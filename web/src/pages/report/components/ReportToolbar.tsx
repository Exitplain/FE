import { useNavigate } from "react-router-dom";

import ChoiceChip from "@/components/ChoiceChip/ChoiceChip";
import DropdownMenu, { type DropdownMenuItem } from "@/components/DropdownMenu/DropdownMenu";
import Icon from "@/components/Icon/Icon";
import { buildPath } from "@/constants/routes";
import type { ReportTaskV1 } from "@/types/report.type";
import { ACTIVE_RUN_STATUSES, type RunItem, type RunStatus } from "@/types/run.type";

import { ALL_TASKS } from "../utils/reportData";
import { formatDay } from "../utils/reportView";

type ReportToolbarProps = {
  projectId: string;
  runId: string;
  /* 지금 리포트의 실행 (차수·상태). 아직 받지 못했으면 undefined */
  run: Pick<RunItem, "sequence_no" | "status"> | undefined;
  createdAt: string;
  /* 프로젝트 실행 목록 (GET /api/v1/projects/{id}/runs, 최신순) */
  runs: RunItem[];
  tasks: Pick<ReportTaskV1, "task_id" | "name">[];
  taskId: string | undefined;
  onTaskChange: (taskId: string) => void;
};

const STATUS_LABEL: Partial<Record<RunStatus, string>> = {
  completed: "완료",
  partially_completed: "부분 완료",
};

/*
  P12 머리말 아래 줄: 실행 선택(P12c) + 과업 칩.
  - 실행 목록은 리포트가 있는 실행(최신순)이고, 진행 중인 실행은 보이기만 하고 고를 수 없습니다.
  - 실패·취소로 리포트가 없는 실행은 넣지 않습니다.
  - 다른 실행을 고르면 그 실행 리포트로 이동합니다(과업 선택은 처음으로).
*/
export default function ReportToolbar({
  projectId,
  runId,
  run,
  createdAt,
  runs,
  tasks,
  taskId,
  onTaskChange,
}: ReportToolbarProps) {
  const navigate = useNavigate();

  const items: DropdownMenuItem[] = runs.flatMap((item): DropdownMenuItem[] => {
    const label = `${item.sequence_no}차 · ${formatDay(item.created_at)}`;
    if (ACTIVE_RUN_STATUSES.includes(item.status)) {
      return [
        {
          key: item.id,
          label,
          description: "실행 중 · 완료 후 선택할 수 있어요",
          disabled: true,
          selected: false,
          onSelect: () => {},
        },
      ];
    }
    if (!item.report) return [];
    return [
      {
        key: item.id,
        label,
        description: `${STATUS_LABEL[item.status] ?? "완료"} · ${item.name}`,
        selected: item.id === runId,
        /* 보고 있는 실행을 다시 고르면 기록만 쌓이고 ?task= 가 사라지므로 이동하지 않습니다 */
        onSelect: () => {
          if (item.id !== runId) navigate(buildPath("report", { projectId, runId: item.id }));
        },
      },
    ];
  });

  /* Figma: "첫 주문 완료 · 3차 · 11월 7일 · 완료" */
  const taskName =
    taskId === ALL_TASKS ? "전체" : tasks.find((task) => task.task_id === taskId)?.name;
  const runLabel = [
    taskName,
    run ? `${run.sequence_no}차` : null,
    formatDay(createdAt),
    run ? STATUS_LABEL[run.status] : null,
  ]
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
            {/* 과업이 둘 이상이면 맨 앞에 "전체" (과업 카드로 비교) */}
            {tasks.length > 1 && (
              <ChoiceChip
                kind="radio"
                selected={taskId === ALL_TASKS}
                onClick={() => onTaskChange(ALL_TASKS)}
              >
                전체
              </ChoiceChip>
            )}
            {tasks.map((task) => (
              <ChoiceChip
                key={task.task_id}
                kind="radio"
                selected={task.task_id === taskId}
                onClick={() => onTaskChange(task.task_id)}
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
