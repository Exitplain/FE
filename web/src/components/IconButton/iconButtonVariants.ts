import { cva, type VariantProps } from "class-variance-authority";

/*
  아이콘만 있는 버튼 (Figma: Button/닫기 · Button/프로젝트 검색 · Button/삭제 · Button/지우기).
  모두 배경 없음 · 원형 · 아이콘 16px 입니다. 크기만 다릅니다.

  | size | 크기  | Figma 사용처                    |
  | ---- | ----- | ------------------------------- |
  | sm   | 24×24 | 검색창 지우기                   |
  | md   | 32×32 | 사이드바 프로젝트 검색, 행 삭제 |
  | lg   | 40×40 | 모달 닫기                       |

  아이콘 색 기본값은 subtle(#525252). 검색·삭제처럼 연한 색은 className="text-muted" 로 덮어씁니다.
  hover(ink 5%) · 눌림(ink 10%)은 Figma 에 정의가 없어 정한 값입니다. 흰 배경과 메쉬 배경 모두에서 보입니다.

  <Link> 를 아이콘 버튼 모양으로 쓸 때: <Link aria-label="..." className={iconButtonVariants({ size: "md" })}>
*/
export const iconButtonVariants = cva(
  [
    "inline-flex shrink-0 items-center justify-center rounded-full text-subtle transition-colors",
    "hover:bg-ink/5 active:bg-ink/10",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
    "disabled:cursor-not-allowed disabled:bg-transparent disabled:opacity-50",
  ],
  {
    variants: {
      size: {
        sm: "size-6",
        md: "size-8",
        lg: "size-10",
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);

export type IconButtonSize = NonNullable<VariantProps<typeof iconButtonVariants>["size"]>;
