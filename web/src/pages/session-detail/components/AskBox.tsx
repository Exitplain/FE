import { type FormEvent, useState } from "react";

import Button from "@/components/Button/Button";
import Input from "@/components/Input/Input";

const MAX_QUESTION = 500;

/*
  질문 칩 + 입력 (P15 요약 오른쪽 · P15d 질문 탭 공용).
  칩(누르면 바로 묻는 버튼이라 선택 상태가 없습니다)을 누르면 그 문장으로 바로 묻습니다. 질문은 다듬은 뒤 1~500자 (BE explain 검증과 같음).
*/
export default function AskBox({
  questions,
  onAsk,
  pending,
  withButton = false,
}: {
  questions: string[];
  onAsk: (question: string) => void;
  pending: boolean;
  withButton?: boolean;
}) {
  const [text, setText] = useState("");
  const trimmed = text.trim();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!trimmed || pending) return;
    onAsk(trimmed);
    setText("");
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {questions.map((question) => (
          <button
            key={question}
            type="button"
            disabled={pending}
            onClick={() => onAsk(question)}
            className="min-h-8 rounded-full bg-gray-50 px-3 text-caption text-ink hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {question}
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="flex gap-3">
        <Input
          aria-label="세션에 질문"
          placeholder="예: 스텝 9에서 왜 스크롤했나요?"
          value={text}
          maxLength={MAX_QUESTION}
          onChange={(event) => setText(event.target.value)}
          className="flex-1 border-transparent bg-gray-50"
        />
        {withButton && (
          <Button type="submit" disabled={!trimmed || pending}>
            질문
          </Button>
        )}
      </form>
    </div>
  );
}
