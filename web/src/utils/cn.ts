import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/*
  styles/index.css @theme 에 추가한 radius·shadow 토큰을 tailwind-merge 에 알려 줍니다.
  등록하지 않으면 rounded-tooltip 을 모서리로, shadow-tooltip 을 그림자 크기로 인식하지 못해
  className 을 덮어쓸 때 둘 다 남거나 엉뚱한 클래스가 지워집니다.
  @theme 에 --radius-* / --shadow-* / --text-* 를 추가하면 여기에도 이름을 추가합니다.
  (text-caption 을 등록하지 않으면 글자 크기가 아니라 색으로 인식해 text-ink 등을 지웁니다)
*/
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      radius: ["tooltip"],
      shadow: ["tooltip", "surface", "dialog"],
      text: ["caption"],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
