import type { ComponentProps } from "react";

import Button from "@/components/Button/Button";
import { cn } from "@/utils/cn";

type AuthButtonProps = ComponentProps<"button"> & { muted?: boolean };

/*
  로그인 전용 48px 버튼. muted 는 입력이 덜 됐을 때의 회색 스타일이고, 막는 것은 disabled 입니다.
  muted 이면서 disabled 인 경우(로그인 중…, 코드 요청 중)도 Figma L05 처럼 같은 연회색으로 둡니다.
*/
export default function AuthButton({ muted, className, ...props }: AuthButtonProps) {
  return (
    <Button
      className={cn(
        "h-12 w-full rounded-full text-caption",
        muted &&
          "bg-gray-200 text-muted hover:bg-gray-300 active:bg-gray-300 disabled:bg-gray-200 disabled:text-muted disabled:hover:bg-gray-200",
        className,
      )}
      {...props}
    />
  );
}
