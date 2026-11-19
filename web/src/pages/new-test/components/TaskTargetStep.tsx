import { useId, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import Button from "@/components/Button/Button";
import ChoiceChip from "@/components/ChoiceChip/ChoiceChip";
import Field from "@/components/Field/Field";
import Icon from "@/components/Icon/Icon";
import TextArea from "@/components/TextArea/TextArea";
import { inputClass } from "@/components/Input/inputVariants";
import { useNewTestStore } from "@/stores/useNewTestStore";
import type { AgeKey } from "@/types/plan.type";
import { cn } from "@/utils/cn";

import { sum, TEXT_MAX, toggleAgeChip, type WizardPlan } from "../utils/newTest";
import { StepFooter } from "./StepSection";

type TaskTargetStepProps = {
  plan: WizardPlan;
  onPrev: () => void;
  onNext: () => void;
  /* 다음 단계로 가기 전에 계획을 저장하는 중 (PATCH) */
  saving?: boolean;
};

/* Figma 연령대 칩: 전체 · 20대 · 30대 · 40대 · 50대 이상 (서버 연령 any · 20s · 30s · 40s · 50plus) */
const AGE_CHIPS: { label: string; ages: AgeKey[] }[] = [
  { label: "전체", ages: ["any"] },
  { label: "20대", ages: ["20s"] },
  { label: "30대", ages: ["30s"] },
  { label: "40대", ages: ["40s"] },
  { label: "50대 이상", ages: ["50plus"] },
];

/*
  P05 과업 · 타겟 (P05a 선택 전) — Figma Wizard/Body: 왼쪽 입력(704) · 오른쪽 "사이트에서 찾은 기능"(368)
  - 과업은 한 줄 칩으로 고르고, 근거 화면은 오른쪽 기능 목록에 둡니다. 추천 과업은 미리 골라 둡니다.
  - 과업이 0개면 바로 빨간 안내를 띄우고 다음을 막습니다(P05a).
  - 직접 추가한 과업은 BE 가 실행하지 못해 실행에 넣지 않고 따로 둡니다(태그 칩).
  - 추가 메모는 additional_request 로 기록만 남고 실행 행동은 바꾸지 않습니다.
*/
export default function TaskTargetStep({
  plan,
  onPrev,
  onNext,
  saving = false,
}: TaskTargetStepProps) {
  /* 필요한 값만 구독해 다른 단계 입력에 이 화면이 다시 그려지지 않게 합니다 (액션은 바뀌지 않는 참조) */
  const store = useNewTestStore(
    useShallow((state) => ({
      taskIds: state.taskIds,
      customTasks: state.customTasks,
      memo: state.memo,
      targetDescription: state.targetDescription,
      ages: state.ages,
      /* 세그먼트 인원 합계 = 에이전트 수 (P05b 에서 조절) */
      agents: sum(state.segmentCounts),
      seedCount: state.seedCount,
      toggleTask: state.toggleTask,
      addCustomTask: state.addCustomTask,
      removeCustomTask: state.removeCustomTask,
      setMemo: state.setMemo,
      setTargetDescription: state.setTargetDescription,
      setAges: state.setAges,
    })),
  );
  const taskErrorId = useId();
  const customId = useId();
  const taskTitleId = useId();
  const targetTitleId = useId();
  const featuresTitleId = useId();
  const targetRef = useRef<HTMLTextAreaElement>(null);
  const [customInput, setCustomInput] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const taskError = store.taskIds.length === 0 ? "과업을 1개 이상 골라주세요" : null;
  const targetError = store.targetDescription.trim() ? null : "타겟 고객을 적어 주세요";

  const next = () => {
    setSubmitted(true);
    if (taskError) return;
    /* 고쳐야 할 곳으로 초점을 옮겨 오류를 바로 알 수 있게 합니다 */
    if (targetError) {
      targetRef.current?.focus();
      return;
    }
    onNext();
  };

  return (
    <div className="flex flex-col gap-14">
      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-8 flex flex-col gap-14">
          <section aria-labelledby={taskTitleId} className="flex flex-col gap-6">
            <h2 id={taskTitleId} className="text-lg font-bold text-ink">
              확인할 과업
            </h2>
            <div className="flex flex-col gap-2">
              <p className="flex items-center gap-2 text-caption text-subtle">
                <Icon name="spark" />
                사이트를 분석해 맞는 과업을 골라 왔어요 · 여러 개 선택 가능
              </p>
              <div
                role="group"
                aria-label="확인할 과업"
                aria-describedby={taskError ? taskErrorId : undefined}
                className="flex flex-wrap gap-1"
              >
                {plan.tasks.map((task) => (
                  <ChoiceChip
                    key={task.id}
                    size="sm"
                    selected={store.taskIds.includes(task.id)}
                    onClick={() => store.toggleTask(task.id)}
                    title={task.goal}
                  >
                    {task.name}
                  </ChoiceChip>
                ))}
              </div>
              {taskError ? (
                <p id={taskErrorId} role="alert" className="text-caption font-medium text-danger">
                  {taskError}
                </p>
              ) : (
                <p className="text-caption font-medium text-gray-800">
                  과업 {store.taskIds.length}개 선택 · {store.agents}명 × {store.taskIds.length}개 ×
                  반복 {store.seedCount}회
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor={customId} className="flex items-baseline gap-2">
                <span className="text-caption font-medium text-ink">과업 직접 추가</span>
                <span className="text-xs text-muted">선택 · Enter로 하나씩 추가</span>
              </label>
              {/* Figma Input/과업 추가(태그): 입력칸 안에 추가한 과업 칩과 입력이 함께 있습니다 */}
              <div
                className={cn(
                  inputClass,
                  "flex min-h-10 flex-wrap items-center gap-3 py-1.5 pl-2",
                  "focus-within:ring-2 focus-within:ring-ink",
                )}
              >
                {store.customTasks.length > 0 && (
                  /* display: contents 는 일부 화면 낭독기에서 목록 의미를 잃어 role 을 적어 둡니다 */
                  <ul role="list" aria-label="직접 추가한 과업" className="contents">
                    {store.customTasks.map((task) => (
                      <li
                        key={task}
                        className="flex h-7 items-center gap-2 rounded-full border border-gray-300 bg-surface pr-2 pl-3 text-caption text-ink"
                      >
                        {task}
                        <button
                          type="button"
                          aria-label={`${task} 지우기`}
                          onClick={() => store.removeCustomTask(task)}
                          className="rounded-full text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-ink"
                        >
                          <Icon name="close" className="size-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <input
                  id={customId}
                  value={customInput}
                  onChange={(event) => setCustomInput(event.target.value)}
                  maxLength={TEXT_MAX}
                  onKeyDown={(event) => {
                    /* 빈 입력에서 Backspace 는 마지막 태그를 지웁니다 */
                    if (event.key === "Backspace" && !customInput && store.customTasks.length > 0) {
                      store.removeCustomTask(store.customTasks[store.customTasks.length - 1]);
                      return;
                    }
                    /* 한글 조합 중 Enter(Safari 는 keyCode 229)는 글자 확정이라 무시합니다 */
                    if (
                      event.key !== "Enter" ||
                      event.nativeEvent.isComposing ||
                      event.keyCode === 229
                    ) {
                      return;
                    }
                    event.preventDefault();
                    store.addCustomTask(customInput);
                    setCustomInput("");
                  }}
                  placeholder={
                    store.customTasks.length > 0 ? "다음 과업 입력 후 Enter" : "과업 입력 후 Enter"
                  }
                  className="min-w-40 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted"
                />
              </div>
            </div>

            <Field
              label="추가로 확인하고 싶은 내용"
              hint="선택"
              help="실행에 자동으로 넣지 않고 따로 저장해요"
            >
              {(control) => (
                <TextArea
                  {...control}
                  rows={1}
                  maxLength={TEXT_MAX}
                  value={store.memo}
                  onChange={(event) => store.setMemo(event.target.value)}
                  placeholder="예: 쿠폰 적용 후 총액이 바로 보이는지"
                />
              )}
            </Field>
          </section>

          <section aria-labelledby={targetTitleId} className="flex flex-col gap-8">
            <h2 id={targetTitleId} className="text-lg font-bold text-ink">
              타겟 고객
            </h2>
            <div className="flex flex-col gap-6">
              <Field
                label="타겟 고객 설명"
                hint="필수"
                error={submitted && targetError ? targetError : undefined}
              >
                {(control) => (
                  <TextArea
                    {...control}
                    ref={targetRef}
                    rows={3}
                    maxLength={TEXT_MAX}
                    value={store.targetDescription}
                    onChange={(event) => store.setTargetDescription(event.target.value)}
                    placeholder="자연어로 적어주세요. 예: 퇴근 후 모바일로 처음 주문하는 1~2인 가구"
                  />
                )}
              </Field>

              <div className="flex flex-col gap-3">
                <p className="flex items-baseline gap-2">
                  <span id="age-label" className="text-caption font-medium text-ink">
                    연령대
                  </span>
                  <span className="text-xs text-muted">선택 · 여러 개 가능</span>
                </p>
                <div className="flex flex-col gap-2">
                  <div role="group" aria-labelledby="age-label" className="flex flex-wrap gap-2">
                    {AGE_CHIPS.map((chip) => (
                      <ChoiceChip
                        key={chip.label}
                        size="sm"
                        selected={chip.ages.every((age) => store.ages.includes(age))}
                        onClick={() => store.setAges(toggleAgeChip(store.ages, chip.ages))}
                      >
                        {chip.label}
                      </ChoiceChip>
                    ))}
                  </div>
                  <p className="text-xs text-muted">연령은 문맥으로만 써요</p>
                </div>
              </div>
            </div>
          </section>
        </div>

        <aside aria-labelledby={featuresTitleId} className="col-span-4 flex flex-col gap-6">
          <h2 id={featuresTitleId} className="text-base font-medium text-ink">
            사이트에서 찾은 기능
          </h2>
          <ul className="flex flex-col">
            {plan.features.map((feature) => (
              <li
                key={feature.id}
                className="flex flex-col gap-1 border-line py-4 not-first:border-t first:pt-0"
              >
                <span className="text-sm font-medium text-ink">{feature.name}</span>
                <span className="text-xs text-muted">
                  근거: ‘{feature.evidence.label}’ · {feature.evidence.path}
                </span>
              </li>
            ))}
          </ul>
        </aside>
      </div>

      <StepFooter>
        <Button variant="link" onClick={onPrev}>
          이전
        </Button>
        <Button disabled={taskError !== null || saving} onClick={next}>
          다음: 페르소나
        </Button>
      </StepFooter>
    </div>
  );
}
