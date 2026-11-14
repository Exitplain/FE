import Icon from "@/components/Icon/Icon";
import WorkspacePageHeader from "@/components/Workspace/WorkspacePageHeader";

import GuideChecklist from "./components/GuideChecklist";

export default function GuidePage() {
  return (
    <div className="space-y-12 text-ink">
      <WorkspacePageHeader
        title="시작 가이드"
        description="반찬로드 기준 · 5단계 중 3단계 완료 · 샘플 데이터"
      />
      <GuideChecklist />
      <section className="space-y-4">
        <h2 className="text-lg font-bold">알아두기</h2>
        <ul>
          {[
            "예측 수치는 시드 3회 반복 범위예요. 실측은 단일값이에요",
            "가상 이탈은 설정한 모형의 결과예요. 실제 고객 이탈률이 아니에요",
            "단계 진입만 익명으로 모아요 · 개인정보 수집 안 함",
          ].map((text) => (
            <li
              key={text}
              className="flex items-start gap-3 border-b border-line py-4 text-sm last:border-0"
            >
              <Icon name="check" className="mt-0.5 shrink-0 text-subtle" />
              {text}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
