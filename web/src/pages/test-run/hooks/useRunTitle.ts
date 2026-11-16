import type { PersonaRun } from "@/types/persona.type";

import { taskOptions } from "../utils/runView";

/*
  실행 차수와 과업 요약 (제품 API sequence_no + 세션의 과업).
  Figma: 목록·실행 화면 "4차 · 첫 주문 완료 외 1개", 실패·중지는 "배송 지역 확인 · 1차"
*/
export function runTitle(run: PersonaRun) {
  const order = run.sequence_no ?? 1;
  const tasks = taskOptions(run.sessions);
  /* 세션이 아직 없으면(준비 중) 서버가 만든 이름 "1차·첫 주문 외 1개" 의 과업 부분을 씁니다 */
  const fromName = run.name?.split("·").slice(1).join("·").trim();
  const summary =
    tasks.length > 1
      ? `${tasks[0].name} 외 ${tasks.length - 1}개`
      : (tasks[0]?.name ?? (fromName || "사전 테스트"));
  return { order, summary, title: `${order}차 · ${summary}` };
}
