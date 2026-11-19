import { useId } from "react";
import { Link } from "react-router-dom";

import Icon from "@/components/Icon/Icon";
import InfoTip from "@/components/InfoTip/InfoTip";
import { buildPath } from "@/constants/routes";
import type { ReportTaskV1, ReportTechnicalFailure } from "@/types/report.type";

/*
  P12 기술 실패 · 한도 초과 — 이탈이 아니라 실행 문제라 이탈률·원인 계산에서 뺀 세션.
  Figma: 제목 16px Medium + 정보 + 바로 옆 12px 설명, 행은 경고 아이콘 · 페르소나 · 과업 · 사유
*/
export default function TechnicalFailures({
  failures,
  tasks,
  projectId,
  runId,
}: {
  failures: ReportTechnicalFailure[];
  /* 과업 id → 이름 */
  tasks: Pick<ReportTaskV1, "task_id" | "name">[];
  /* 행을 누르면 그 세션의 상세(E06)로 갑니다 */
  projectId: string;
  runId: string;
}) {
  const headingId = useId();
  if (failures.length === 0) return null;
  const taskName = (id: string) => tasks.find((task) => task.task_id === id)?.name ?? id;
  return (
    <section id="technical" aria-labelledby={headingId} className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <h2 id={headingId} className="text-base font-medium text-ink">
          기술 실패 · 한도 초과
        </h2>
        <InfoTip text="브라우저 오류나 행동·시간 한도로 끝난 방문이에요. 가상 이탈로 세지 않아요." />
        <span className="ml-1 text-xs text-muted">이탈률·원인 계산에서 제외</span>
      </div>
      <ul className="flex flex-col gap-4">
        {failures.map((failure) => (
          <li key={`${failure.task_id}-${failure.seed}-${failure.persona_id}`}>
            <Link
              to={buildPath("sessionDetail", {
                projectId,
                runId,
                taskId: failure.task_id,
                seed: String(failure.seed),
                personaId: failure.persona_id,
              })}
              className="flex items-center gap-2 rounded text-caption hover:bg-gray-50"
            >
              <Icon name="status-error" className="text-danger" />
              <span className="w-32 font-medium text-ink underline-offset-4 hover:underline">
                {failure.persona_id} · 반복 {failure.seed}
              </span>
              <span className="w-24 text-subtle">{taskName(failure.task_id)}</span>
              <span className="text-gray-800">{failure.reason ?? failure.status}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
