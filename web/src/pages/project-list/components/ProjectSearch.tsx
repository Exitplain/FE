import { useState } from "react";

import Icon from "@/components/Icon/Icon";
import IconButton from "@/components/IconButton/IconButton";
import Input from "@/components/Input/Input";

export default function ProjectSearch({
  value,
  onChange,
  onClear,
}: {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
}) {
  const [input, setInput] = useState({
    text: value,
    externalValue: value,
    published: value,
    pending: [] as string[],
  });

  // Router updates can arrive after the next syllable has already started.
  // Acknowledging a published value must never replace newer local input.
  if (input.externalValue !== value) {
    const acknowledged = input.pending.indexOf(value);
    setInput({
      text: acknowledged >= 0 ? input.text : value,
      externalValue: value,
      published: acknowledged >= 0 ? input.published : value,
      pending: acknowledged >= 0 ? input.pending.slice(acknowledged + 1) : [],
    });
  }

  const publish = (text: string) => {
    if (text === input.published) {
      setInput((previous) => ({ ...previous, text }));
      return;
    }
    setInput((previous) => ({
      ...previous,
      text,
      published: text,
      pending: [...previous.pending, text],
    }));
    onChange(text);
  };

  return (
    <div className="relative">
      <label className="block">
        <span className="sr-only">프로젝트 이름 또는 URL 검색</span>
        <Icon name="search" className="absolute top-3 left-4 text-subtle" />
        <Input
          value={input.text}
          placeholder="프로젝트 이름 또는 URL 검색"
          onCompositionEnd={(event) => {
            publish(event.currentTarget.value);
          }}
          onChange={(event) => publish(event.target.value)}
          className="rounded-full border border-subtle bg-surface pr-12 pl-10"
        />
      </label>
      {input.text && (
        <IconButton
          label="검색어 지우기"
          icon="close"
          size="sm"
          onClick={() => {
            setInput((previous) => ({
              ...previous,
              text: "",
              published: "",
              pending: [...previous.pending, ""],
            }));
            onClear();
          }}
          className="absolute top-2 right-3"
        />
      )}
    </div>
  );
}
