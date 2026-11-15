import { useEffect, useRef, useState } from "react";

import Icon from "@/components/Icon/Icon";
import type { ExplainAnswer } from "@/types/persona.type";

import AskBox from "./AskBox";

/*
  Figma P15d 질문 — 기록에 근거한 답(대화형 인터뷰 아님).
  "근거: 스텝 n" 을 누르면 스텝 타임라인의 그 스텝으로 갑니다.
*/
export default function SessionQuestions({
  answers,
  questions,
  onAsk,
  pending,
  failed,
  onEvidence,
  focusOnMount = false,
}: {
  answers: ExplainAnswer[];
  questions: string[];
  onAsk: (question: string) => void;
  pending: boolean;
  failed: boolean;
  onEvidence: (step: number) => void;
  /* 요약에서 질문해 넘어왔으면 누른 칩이 사라지므로 제목으로 포커스를 옮깁니다 */
  focusOnMount?: boolean;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  /* 처음부터 내용이 있는 알림 영역은 읽히지 않아, 들어온 뒤 늘어난 답만 "받았어요"로 알립니다 */
  const [initialCount] = useState(answers.length);
  const received = !pending && answers.length > initialCount;

  useEffect(() => {
    if (focusOnMount) heading.current?.focus();
  }, [focusOnMount]);

  return (
    <section aria-labelledby="questions-title" className="flex flex-col gap-6">
      <div className="flex items-baseline justify-between">
        <h2
          id="questions-title"
          ref={heading}
          tabIndex={-1}
          className="text-lg font-bold text-ink outline-none"
        >
          이 세션에 질문하기
        </h2>
        <p className="text-xs text-muted">기록 기반 답변 · 대화형 인터뷰 아님</p>
      </div>

      {answers.length > 0 && (
        <ul aria-label="답변" className="flex flex-col gap-3">
          {answers.map((answer) => (
            <li key={answer.id} className="flex flex-col gap-1 rounded-xl bg-gray-50 p-4">
              <p className="text-caption font-bold text-ink">Q. {answer.question}</p>
              <p className="text-caption text-ink">A. {answer.answer}</p>
              {answer.sources.length > 0 && (
                <p className="flex flex-wrap gap-4 pt-3">
                  {answer.sources.map((source) => (
                    <button
                      key={source.step}
                      type="button"
                      onClick={() => onEvidence(source.step)}
                      className="flex items-center gap-1 text-caption font-bold text-ink"
                    >
                      근거: 스텝 {source.step}
                      <Icon name="chevron-right" />
                    </button>
                  ))}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* 알림 영역은 늘 두고(사라졌다 나타나면 변경으로 읽히지 않음) 화면 표시는 따로 합니다 */}
      <p role="status" className="sr-only">
        {pending ? "기록에서 답을 찾고 있어요" : received ? "답을 받았어요" : ""}
      </p>
      {pending && (
        <p aria-hidden className="text-caption text-subtle">
          기록에서 답을 찾고 있어요
        </p>
      )}
      {failed && (
        <p role="alert" className="text-caption text-danger">
          답을 받지 못했어요. 잠시 뒤 다시 질문해 주세요.
        </p>
      )}

      <AskBox questions={questions} onAsk={onAsk} pending={pending} withButton />
    </section>
  );
}
