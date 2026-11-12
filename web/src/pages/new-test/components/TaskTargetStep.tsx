import { useState } from "react";

import Button from "@/components/Button/Button";
import ChoiceChip from "@/components/ChoiceChip/ChoiceChip";
import Field from "@/components/Field/Field";
import IconButton from "@/components/IconButton/IconButton";
import Input from "@/components/Input/Input";
import TextArea from "@/components/TextArea/TextArea";
import { useNewTestStore } from "@/stores/useNewTestStore";
import type { AgeOption, DiscoverResponse } from "@/types/persona.type";

import { TEXT_MAX, toggleAge } from "../utils/newTest";
import StepSection, { StepFooter } from "./StepSection";

type TaskTargetStepProps = {
  plan: DiscoverResponse;
  /* BE 고정 프로필 수 — 세션 수 = 과업 수 × 프로필 수 */
  profileCount: number;
  onPrev: () => void;
  onNext: () => void;
};

/*
  P05 과업 · 타겟 (P05a 선택 전 검증)
  - 과업은 탐색한 기능별로 묶어 근거 화면과 함께 보여줍니다. 추천 과업은 미리 골라 둡니다.
  - 직접 추가한 과업은 BE 가 실행하지 못해 실행에 넣지 않고 따로 둡니다.
  - 추가 메모는 additional_request 로 기록만 남고 실행 행동은 바꾸지 않습니다.
*/
export default function TaskTargetStep({
  plan,
  profileCount,
  onPrev,
  onNext,
}: TaskTargetStepProps) {
  const store = useNewTestStore();
  const [customInput, setCustomInput] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const taskError = store.taskIds.length === 0 ? "과업을 1개 이상 골라주세요" : null;
  const targetError = store.targetDescription.trim() ? null : "타겟 고객을 적어 주세요";
  const ageOptions = Object.entries(plan.age_options) as [AgeOption, string][];

  const next = () => {
    setSubmitted(true);
    if (!taskError && !targetError) onNext();
  };

  return (
    <div className="flex flex-col gap-12">
      <StepSection
        title="확인할 과업"
        description={`사이트에서 찾은 기능 · 사이트를 분석해 맞는 과업을 골라 왔어요 · ${plan.note}`}
      >
        <div className="flex flex-col gap-6">
          {plan.features.map((feature) => {
            const tasks = plan.tasks.filter((task) => task.feature_id === feature.id);
            if (tasks.length === 0) return null;
            return (
              <div key={feature.id} className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <h3 className="text-sm font-bold text-ink">{feature.name}</h3>
                  <p className="text-xs text-muted">
                    근거: ‘{feature.evidence.label}’ · {feature.evidence.path}
                  </p>
                </div>
                <div
                  role="group"
                  aria-label={`${feature.name} 과업`}
                  className="flex flex-wrap gap-2"
                >
                  {tasks.map((task) => (
                    <ChoiceChip
                      key={task.id}
                      selected={store.taskIds.includes(task.id)}
                      onClick={() => store.toggleTask(task.id)}
                      title={task.goal}
                    >
                      {task.name}
                    </ChoiceChip>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-sm font-medium text-ink">
          과업 {store.taskIds.length}개 선택 · 세션 {store.taskIds.length * profileCount}개 (프로필{" "}
          {profileCount}개 × 과업)
        </p>
        {submitted && taskError && (
          <p role="alert" className="text-xs font-medium text-danger">
            {taskError}
          </p>
        )}

        <Field
          label="과업 직접 추가"
          hint="선택 · Enter로 하나씩 추가"
          help="실행에 자동으로 넣지 않고 따로 저장해요"
        >
          {(control) => (
            <Input
              {...control}
              value={customInput}
              onChange={(event) => setCustomInput(event.target.value)}
              onKeyDown={(event) => {
                /* 한글 조합 중 Enter 는 글자 확정이라 무시합니다 */
                if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
                event.preventDefault();
                store.addCustomTask(customInput);
                setCustomInput("");
              }}
              placeholder="다음 과업 입력 후 Enter"
            />
          )}
        </Field>
        {store.customTasks.length > 0 && (
          <ul aria-label="직접 추가한 과업" className="flex flex-wrap gap-2">
            {store.customTasks.map((task) => (
              <li
                key={task}
                className="flex items-center gap-1 rounded-full bg-gray-50 py-1 pr-1 pl-3 text-sm text-gray-800"
              >
                {task}
                <IconButton
                  icon="close"
                  size="sm"
                  label={`${task} 지우기`}
                  onClick={() => store.removeCustomTask(task)}
                />
              </li>
            ))}
          </ul>
        )}

        <Field
          label="추가로 확인하고 싶은 내용"
          hint="선택"
          help="기록으로 남기고 이번 실행의 행동에는 넣지 않아요"
        >
          {(control) => (
            <TextArea
              {...control}
              rows={2}
              maxLength={TEXT_MAX}
              value={store.memo}
              onChange={(event) => store.setMemo(event.target.value)}
              placeholder="예: 쿠폰 적용 후 총액이 바로 보이는지"
            />
          )}
        </Field>
      </StepSection>

      <StepSection title="타겟 고객">
        <Field
          label="타겟 고객 설명"
          hint="필수"
          error={submitted && targetError ? targetError : undefined}
        >
          {(control) => (
            <TextArea
              {...control}
              rows={3}
              maxLength={TEXT_MAX}
              value={store.targetDescription}
              onChange={(event) => store.setTargetDescription(event.target.value)}
              placeholder="자연어로 적어주세요. 예: 퇴근 후 모바일로 저녁 반찬을 처음 주문하는 1~2인 가구"
            />
          )}
        </Field>

        <div className="flex flex-col gap-2">
          <p className="flex items-baseline gap-2">
            <span id="age-label" className="text-caption font-medium text-gray-800">
              연령대
            </span>
            <span className="text-xs text-muted">선택 · 여러 개 가능</span>
          </p>
          <div role="group" aria-labelledby="age-label" className="flex flex-wrap gap-2">
            {ageOptions.map(([age, label]) => (
              <ChoiceChip
                key={age}
                selected={store.ages.includes(age)}
                onClick={() => store.setAges(toggleAge(store.ages, age))}
              >
                {age === "any" ? "전체" : label}
              </ChoiceChip>
            ))}
          </div>
          <p className="text-xs text-muted">
            연령은 설명 문맥으로만 써요. 페르소나 행동 변수나 묘사는 바꾸지 않아요
          </p>
        </div>
      </StepSection>

      <StepFooter>
        <Button variant="link" onClick={onPrev}>
          이전
        </Button>
        <Button onClick={next}>다음: 페르소나</Button>
      </StepFooter>
    </div>
  );
}
