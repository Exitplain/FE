import { usePersonaReports } from "@/hooks/usePersonaReports";
import { runOrder } from "@/pages/report/utils/reportView";
import type { PersonaRun } from "@/types/persona.type";

import { taskOptions } from "../utils/runView";

/*
  실행 차수와 과업 요약. 진행 중인 실행은 완료 목록 다음 차수입니다.
  Figma: 목록·실행 화면 "4차 · 첫 주문 완료 외 1개", 실패·비용 상한은 "배송 지역 확인 · 1차"
*/
export function useRunTitle(run: PersonaRun) {
  const reports = usePersonaReports();
  const list = reports.data ?? [];
  const order = (run.id && runOrder(list, run.id)) || list.length + 1;
  const tasks = taskOptions(run.sessions);
  const summary =
    tasks.length > 1
      ? `${tasks[0].name} 외 ${tasks.length - 1}개`
      : (tasks[0]?.name ?? "사전 테스트");
  return { order, summary, title: `${order}차 · ${summary}` };
}
