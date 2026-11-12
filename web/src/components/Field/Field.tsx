import { type ReactNode, useId } from "react";

import { cn } from "@/utils/cn";

/* Field 가 입력칸에 넘겨주는 접근성 속성. Input·TextArea 에 그대로 펼쳐 넣습니다 */
export type FieldControlProps = {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
};

type FieldProps = {
  label: string;
  /* 라벨 옆 회색 글자: "필수", "선택", "선택 · 여러 개 가능" */
  hint?: string;
  /* 입력칸 아래 도움말 */
  help?: ReactNode;
  /* 있으면 빨간 글자로 보여주고 입력칸을 aria-invalid 로 표시합니다 */
  error?: string;
  className?: string;
  children: (control: FieldControlProps) => ReactNode;
};

/*
  Figma `Field/*` — 13px Medium 라벨 + 12px 회색 hint, 아래 입력칸, 그 아래 12px 도움말.
  라벨·설명 연결(id, aria-describedby)을 여기서 한 번에 맞추려고 children 을 함수로 받습니다.

  사용 예
    <Field label="제품 URL" hint="필수" error={urlError}>
      {(control) => <Input {...control} value={url} onChange={...} />}
    </Field>
*/
export default function Field({ label, hint, help, error, className, children }: FieldProps) {
  const id = useId();
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;
  const describedBy = [help != null ? helpId : null, error ? errorId : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-baseline gap-2">
        <label htmlFor={id} className="text-caption font-medium text-gray-800">
          {label}
        </label>
        {hint && <span className="text-xs text-muted">{hint}</span>}
      </div>
      {children({
        id,
        "aria-describedby": describedBy || undefined,
        "aria-invalid": error ? true : undefined,
      })}
      {help != null && (
        <p id={helpId} className="text-xs text-muted">
          {help}
        </p>
      )}
      {error && (
        // 제출 뒤에 나타나는 오류도 화면 낭독기가 읽도록 polite 로 알립니다
        <p id={errorId} aria-live="polite" className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
