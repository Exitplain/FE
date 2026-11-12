import { cva, type VariantProps } from "class-variance-authority";

/*
  Figma `Button` 컴포넌트 (237:8815) — 높이 40 · pill · 14px Medium · 아이콘 16px.
  와이어프레임의 Button 인스턴스 284개가 모두 40px 이라 크기 옵션은 두지 않습니다.

  | variant   | Figma 종류         | 눌림(누르는 동안)      |
  | --------- | ------------------ | --------------------- |
  | primary   | 검정               | 살짝 밝게 (#333)       |
  | secondary | 흰색               | 살짝 어둡게 (#ededed)  |
  | outline   | 흰색 검은 테두리   | 살짝 어둡게 (#ededed)  |
  | link      | 밑줄               | 글자가 밝아짐 (#737373) |

  Figma `비활성` 종류는 variant 가 아니라 disabled 속성으로 표현합니다.

  <Link> 를 버튼 모양으로 쓸 때: <Link className={buttonVariants({ variant: "outline" })}>
*/
export const buttonVariants = cva(
  [
    "inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full",
    "text-sm font-medium whitespace-nowrap select-none transition-colors",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
    "disabled:cursor-not-allowed",
  ],
  {
    variants: {
      variant: {
        primary: [
          "bg-ink px-4 text-surface active:bg-ink-pressed",
          "disabled:bg-gray-300 disabled:text-subtle",
        ],
        secondary: [
          "border border-gray-300 bg-surface px-4 text-ink active:bg-surface-pressed",
          "disabled:border-transparent disabled:bg-gray-300 disabled:text-subtle",
        ],
        outline: [
          "border border-ink bg-surface px-4 text-ink active:bg-surface-pressed",
          "disabled:border-transparent disabled:bg-gray-300 disabled:text-subtle",
        ],
        /* 밑줄 버튼은 배경이 없어 비활성일 때 글자만 흐리게 합니다 (subtle 은 거의 검정이라 gray-400) */
        link: "px-2 text-ink underline active:text-muted disabled:text-gray-400",
      },
    },
    defaultVariants: {
      variant: "primary",
    },
  },
);

export type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>["variant"]>;
