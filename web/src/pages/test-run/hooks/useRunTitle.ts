import type { PersonaRun } from "@/types/persona.type";

import { taskFromRunName } from "../utils/runAdapter";
import { taskOptions } from "../utils/runView";

/*
  실행 차수와 과업 요약 (제품 API sequence_no + 서버 실행 이름).
  Figma: 목록·실행 화면 "4차 · 첫 주문 완료 외 1개", 실패·중지는 "배송 지역 확인 · 1차"
*/
export function runTitle(run: PersonaRun) {
  const order = run.sequence_no ?? 1;
  /*
    서버가 확정 계획의 과업 이름으로 만든 이름 "1차·첫 주문 외 1개" 의 과업 부분을 먼저 씁니다.
    세션 응답에는 과업 id 만 있어 세션으로 만들면 영어 id 가 나올 수 있습니다.
  */
  const fromName = taskFromRunName(run.name);
  const tasks = taskOptions(run.sessions);
  const summary =
    fromName ??
    (tasks.length > 1
      ? `${tasks[0].name} 외 ${tasks.length - 1}개`
      : (tasks[0]?.name ?? "사전 테스트"));
  return { order, summary, title: `${order}차 · ${summary}` };
}
