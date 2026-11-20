import type { ComponentProps } from "react";

import { inputClass } from "@/components/Input/inputVariants";
import { cn } from "@/utils/cn";

/*
  여러 줄 입력 (P05 추가 메모·타겟 고객 설명). 높이는 rows 로 정합니다.
    <Field label="타겟 고객 설명" hint="필수">{(control) => <TextArea {...control} rows={3} />}</Field>
*/
export default function TextArea({ className, rows = 3, ...props }: ComponentProps<"textarea">) {
  return <textarea rows={rows} className={cn(inputClass, "resize-y", className)} {...props} />;
}
