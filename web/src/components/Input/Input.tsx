import type { ComponentProps } from "react";

import { cn } from "@/utils/cn";

import { inputClass } from "./inputVariants";

/*
  한 줄 입력. 라벨·도움말·오류는 Field 로 감쌉니다.
    <Field label="제품 URL" hint="필수">{(control) => <Input {...control} type="url" />}</Field>
*/
export default function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(inputClass, "min-h-10", className)} {...props} />;
}
