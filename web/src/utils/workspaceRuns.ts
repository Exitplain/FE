import { runStatusOf } from "@/apis/project.api";
import { formatRunDate } from "@/pages/test-list/utils/testRows";
import type { RunItem } from "@/types/run.type";
import type { WorkspaceRun } from "@/types/workspace.type";

/*
  제품 API 실행 목록(GET /api/v1/projects/{id}/runs) 한 줄 → 진단 기록·대시보드 화면 값.
  목표 달성률은 리포트 요약의 과업별 값(0~1)을 % 로 바꿉니다. 예측 범위가 아니라 값 하나라 [n, n] 입니다.
*/
export function toWorkspaceRun(item: RunItem, project: { id: string; name: string }): WorkspaceRun {
  const predictions = (item.report?.goal_rates ?? []).flatMap((goal): [number, number][] => {
    if (goal.achievement_rate == null) return [];
    const percent = Math.round(goal.achievement_rate * 100);
    return [[percent, percent]];
  });
  return {
    id: item.id,
    projectId: project.id,
    projectName: project.name,
    title: item.name || `${item.sequence_no}차`,
    type: item.kind === "cause_repro" ? "원인 재현" : "사전 테스트",
    /* 서버가 모르는 상태를 보내면 진행 중으로 봅니다 */
    status: runStatusOf(item.status) ?? "running",
    predictions,
    date: item.created_at,
    dateLabel: formatRunDate(item.created_at),
  };
}

/* "20~30%" · 값이 하나면 "25%" */
export function formatRate([min, max]: [number, number]) {
  return min === max ? `${min}%` : `${min}~${max}%`;
}
