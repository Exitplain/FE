import { cn } from "@/utils/cn";

import { isPersonaAvatar } from "./personaAvatars";

/*
  페르소나 캐릭터 이미지. 모르는 키(예전 스냅샷 등)면 아무것도 그리지 않습니다.
  정해진 키만 받아 정적 파일 경로를 만듭니다 (응답 값으로 임의 경로를 만들지 않음).
*/
export default function PersonaAvatar({
  avatar,
  className,
}: {
  avatar: string | null | undefined;
  className?: string;
}) {
  if (!isPersonaAvatar(avatar)) return null;
  return (
    <img
      src={`/personas/persona-${avatar}.svg`}
      alt=""
      aria-hidden
      draggable={false}
      className={cn("size-12 shrink-0 [image-rendering:pixelated]", className)}
    />
  );
}
