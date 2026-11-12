import { cn } from "@/utils/cn";

import { ICON_NAMES, type IconName } from "./iconNames";

/*
  Figma `아이콘` 섹션(24 그리드 · 선 두께 2)에서 내보낸 SVG 를 그대로 씁니다.
  선 색은 currentColor 라서 text-* 클래스로 바꿉니다. 기본 크기는 Figma 기준 16px(size-4).

  아이콘 추가: Figma 에서 내보낸 SVG 를 src/assets/icons/<이름>.svg 로 저장하고
  stroke 색을 currentColor 로 바꾼 뒤 ./iconNames.ts 의 ICON_NAMES 에 이름을 추가합니다.
  viewBox 는 0 0 24 24 여야 합니다 (아래에서 svg 껍데기를 새로 씌웁니다).
*/
const svgFiles = import.meta.glob<string>("../../assets/icons/*.svg", {
  query: "?raw",
  import: "default",
  eager: true,
});

/* <svg ...> 껍데기를 벗기고 안쪽 도형만 남깁니다 (viewBox 는 모두 0 0 24 24) */
const ICON_BODY = Object.fromEntries(
  Object.entries(svgFiles).map(([path, raw]) => [
    path.slice(path.lastIndexOf("/") + 1, -".svg".length),
    raw.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, ""),
  ]),
) as Partial<Record<IconName, string>>;

/* 이름 목록과 파일이 어긋나면 빈 아이콘이 조용히 그려지므로 개발 중에 바로 알립니다 */
if (import.meta.env.DEV) {
  const files = Object.keys(ICON_BODY);
  const missing = ICON_NAMES.filter((name) => !files.includes(name));
  const unregistered = files.filter((file) => !(ICON_NAMES as readonly string[]).includes(file));
  if (missing.length || unregistered.length) {
    console.error("[Icon] iconNames.ts 와 assets/icons 가 다릅니다.", { missing, unregistered });
  }
}

type IconProps = {
  name: IconName;
  className?: string;
  /* 의미가 있는 아이콘(버튼 안에 글자 없이 쓰는 경우 등)에만 넣습니다 */
  label?: string;
};

export default function Icon({ name, className, label }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={cn("size-4 shrink-0 icon-stroke", className)}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      /* 저장소 안의 고정 SVG 파일만 넣습니다 (사용자 입력 아님) */
      dangerouslySetInnerHTML={{ __html: ICON_BODY[name] ?? "" }}
    />
  );
}
