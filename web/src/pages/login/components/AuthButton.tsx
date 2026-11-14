import type { ComponentProps } from "react";

import Button from "@/components/Button/Button";
import { cn } from "@/utils/cn";

type AuthButtonProps = ComponentProps<"button"> & { muted?: boolean };

/* 로그인 전용 48px 버튼. 빈 입력에서도 누를 수 있는 화면 프로토타입입니다. */
export default function AuthButton({ muted, className, ...props }: AuthButtonProps) {
  return (
    <Button
      className={cn(
        "h-12 w-full rounded-full text-caption",
        muted && "bg-gray-200 text-muted hover:bg-gray-300 active:bg-gray-300",
        className,
      )}
      {...props}
    />
  );
}
