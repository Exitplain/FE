import type { ComponentProps } from "react";

import Icon from "@/components/Icon/Icon";
import type { IconName } from "@/components/Icon/iconNames";
import { cn } from "@/utils/cn";

import { iconButtonVariants, type IconButtonSize } from "./iconButtonVariants";

/* aria-label 은 label 로만 받습니다 (둘 다 넘겨 label 이 무시되는 일을 막음). ref 는 React 19 prop 으로 받습니다 */
export type IconButtonProps = Omit<ComponentProps<"button">, "children" | "aria-label"> & {
  icon: IconName;
  /* 글자가 없으므로 화면 낭독기가 읽을 이름이 꼭 필요합니다 (aria-label) */
  label: string;
  size?: IconButtonSize;
};

/*
  사용 예
    <IconButton icon="close" label="닫기" size="lg" />
    <IconButton icon="close" label="테스트 계정 행 삭제" className="text-muted" />
    <IconButton icon="close" label="검색어 지우기" size="sm" />
*/
export default function IconButton({
  icon,
  label,
  size,
  className,
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      className={cn(iconButtonVariants({ size }), className)}
      {...props}
    >
      <Icon name={icon} />
    </button>
  );
}
