import { useId } from "react";

import Icon from "@/components/Icon/Icon";
import InfoTip from "@/components/InfoTip/InfoTip";
import type { TechnicalFailure } from "@/types/persona.type";

/*
  P12 기술 실패 · 한도 초과 — 이탈이 아니라 실행 문제라 이탈률·원인 계산에서 뺀 세션.
  Figma: 제목 16px Medium + 정보 + 바로 옆 12px 설명, 행은 경고 아이콘 · 세션 · 과업 · 사유
*/
export default function TechnicalFailures({ failures }: { failures: TechnicalFailure[] }) {
  const headingId = useId();
  if (failures.length === 0) return null;
  return (
    <section id="technical" aria-labelledby={headingId} className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <h2 id={headingId} className="text-base font-medium text-ink">
          기술 실패 · 한도 초과
        </h2>
        <InfoTip text="브라우저 오류나 행동·시간 한도로 끝난 세션이에요. 가상 이탈로 세지 않아요." />
        <span className="ml-1 text-xs text-muted">이탈률·원인 계산에서 제외</span>
      </div>
      <ul className="flex flex-col gap-4">
        {failures.map((failure) => (
          <li key={failure.session_id} className="flex items-center gap-2 text-caption">
            <Icon name="status-error" className="text-danger" />
            <span className="w-32 font-medium text-ink">{failure.persona_name}</span>
            <span className="w-24 text-subtle">{failure.task_name}</span>
            <span className="text-gray-800">{failure.reason}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
