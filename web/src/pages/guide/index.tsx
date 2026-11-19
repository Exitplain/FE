import Icon from "@/components/Icon/Icon";
import Button from "@/components/Button/Button";
import WorkspacePageHeader from "@/components/Workspace/WorkspacePageHeader";
import { useAuthSession } from "@/hooks/useAuthSession";
import { onboardingAccountKey, useOnboardingStore } from "@/stores/useOnboardingStore";

import GuideChecklist from "./components/GuideChecklist";

export default function GuidePage() {
  const { data: session, isPending } = useAuthSession();
  const startTutorial = useOnboardingStore((state) => state.start);
  return (
    <div className="space-y-12 text-ink">
      <WorkspacePageHeader
        title="시작 가이드"
        description="반찬로드 기준 · 5단계 중 3단계 완료 · 샘플 데이터"
      />
      <section className="flex flex-wrap items-center justify-between gap-5 rounded-2xl border border-line bg-gray-50 p-6">
        <div className="flex items-start gap-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-highlight">
            <Icon name="spark" className="size-5" />
          </span>
          <div>
            <h2 className="font-bold">사이트 진단 흐름, 다시 둘러볼까요?</h2>
            <p className="mt-1 text-sm text-subtle">
              내 사이트 등록부터 첫 테스트 실행 직전까지, 실제 작업을 따라 안내해요.
            </p>
          </div>
        </div>
        <Button
          icon="play"
          disabled={isPending}
          onClick={() => startTutorial(onboardingAccountKey(session))}
        >
          튜토리얼 다시 보기
        </Button>
      </section>
      <GuideChecklist />
      <section className="space-y-4">
        <h2 className="text-lg font-bold">알아두기</h2>
        <ul>
          {[
            "예측 수치는 3회 반복 범위예요. 실제 고객 데이터는 단일값이에요",
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
