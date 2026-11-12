import Button from "@/components/Button/Button";
import InfoTip from "@/components/InfoTip/InfoTip";
import type { PersonaProfile } from "@/types/persona.type";

import StepSection, { StepFooter } from "./StepSection";

/* BE agent/persona_dashboard.py 실행 한도 (코드 상수, 요청으로 바꿀 수 없음) */
export const RUN_CONDITIONS =
  "동시 3세션 · 세션당 스텝 35 · 150초 · 결제·본인인증·개인정보 입력은 하지 않아요";

type PersonaStepProps = {
  profiles: PersonaProfile[];
  taskCount: number;
  accountCount: number;
  onPrev: () => void;
  onNext: () => void;
};

/*
  P05b 페르소나 — 개발 서버 기준 읽기 전용.
  Figma 는 세그먼트 4개의 인원을 +/- 로 정하지만(P05e 합계 오류, P05h 계정 수만큼),
  BE 는 프로필 3개 × 과업으로 세션 수가 고정이라 프로필과 세션 수를 보여주기만 합니다.
*/
export default function PersonaStep({
  profiles,
  taskCount,
  accountCount,
  onPrev,
  onNext,
}: PersonaStepProps) {
  return (
    <div className="flex flex-col gap-12">
      <StepSection
        title="세그먼트"
        description={`프로필 ${profiles.length}개가 과업마다 1세션씩 실행해요 · 세그먼트 비율 조정은 서버가 지원하면 열려요`}
      >
        {profiles.length === 0 && (
          <p role="status" className="text-sm text-muted">
            페르소나 프로필을 불러오는 중이에요…
          </p>
        )}
        <ul aria-label="페르소나 프로필" className="flex flex-col">
          {profiles.map((profile) => (
            <li
              key={profile.id}
              className="flex items-center justify-between gap-6 border-b border-line py-4"
            >
              <div className="flex flex-col gap-1">
                <p className="text-sm font-bold text-ink">{profile.name}</p>
                <p className="text-xs text-muted">{profile.context}</p>
                <p className="text-xs text-subtle">
                  허용 입력 칸 {profile.max_required_fields}개 · 화면 너비 {profile.width}px
                  {profile.width <= 480 ? " (모바일)" : " (데스크톱)"}
                </p>
              </div>
              <p className="shrink-0 text-sm font-bold text-ink">세션 {taskCount}개</p>
            </li>
          ))}
          <li className="flex items-center justify-between py-4">
            <p className="text-sm font-bold text-ink">합계</p>
            <p className="text-sm font-bold text-ink">세션 {profiles.length * taskCount}개</p>
          </li>
        </ul>
        {accountCount > 0 && (
          <p className="text-xs text-subtle">
            등록한 테스트 계정 {accountCount}개는 아직 실행에 쓰이지 않아요 (서버 미지원)
          </p>
        )}
      </StepSection>

      <StepSection title="실행 조건">
        <div className="flex items-center gap-2">
          <p className="text-caption text-subtle">{RUN_CONDITIONS}</p>
          <InfoTip text="실행 한도는 개발 서버에 고정된 값이에요. 좌절 점수가 프로필의 허용 입력 칸 × 16 을 넘으면 이탈로 기록해요." />
        </div>
      </StepSection>

      <StepFooter>
        <Button variant="link" onClick={onPrev}>
          이전
        </Button>
        <Button onClick={onNext}>다음: 시작 전 확인</Button>
      </StepFooter>
    </div>
  );
}
