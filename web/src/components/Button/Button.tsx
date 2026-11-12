import type { ComponentProps } from "react";

import Icon from "@/components/Icon/Icon";
import type { IconName } from "@/components/Icon/iconNames";
import { cn } from "@/utils/cn";

import { buttonVariants, type ButtonVariant } from "./buttonVariants";

/* ref 는 React 19 prop 으로 받습니다 (ComponentProps 에 포함) */
export type ButtonProps = ComponentProps<"button"> & {
  variant?: ButtonVariant;
  /* 글자 앞에 붙는 16px 아이콘. 색은 글자색을 따라갑니다 */
  icon?: IconName;
};

/*
  사용 예
    <Button>새 테스트 시작하기</Button>
    <Button variant="secondary" icon="download">내보내기</Button>
    <Button variant="link">전체 보기</Button>
    <Button disabled>다음</Button>          // Figma `비활성`
*/
export default function Button({
  className,
  variant,
  icon,
  type = "button",
  children,
  ...props
}: ButtonProps) {
  return (
    <button type={type} className={cn(buttonVariants({ variant }), className)} {...props}>
      {icon && <Icon name={icon} />}
      {children}
    </button>
  );
}
