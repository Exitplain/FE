/* src/assets/icons/*.svg 파일 이름과 같게 유지합니다 */
export const ICON_NAMES = [
  "activity",
  "arrow-down",
  "arrow-right",
  "check",
  /* P06 생성 단계 대기. Figma icon/circle 20 그리드를 24 그리드로 옮김 */
  "circle",
  "chevron-down",
  "chevron-right",
  "close",
  "compare",
  "dashboard",
  "download",
  "flag",
  "folder",
  "folder-open",
  "grip",
  "help",
  "history",
  "image",
  "info",
  "key",
  "link",
  "logout",
  "minus",
  /* P14 실측 상태 (수집 중). Figma icon/dots 20 그리드를 24 그리드로 옮김 */
  "more",
  /* P14 실측 상태 (수집 중단). Figma icon/pause 20 그리드를 24 그리드로 옮김 */
  "pause",
  /* Figma 아이콘 섹션에는 없고 화면(P01 실행 중·P09·E02)에서 쓰는 icon/play 를 24 그리드로 옮김 */
  "play",
  "plus",
  "retry",
  "search",
  "settings",
  "spark",
  "status-done",
  "status-error",
  "status-exit",
  "status-fail",
  "status-running",
  "status-wait",
  /* P14·R01 실측 미연결. Figma icon/unlink 20 그리드를 24 그리드로 옮김 */
  "unlink",
  "verdict-before",
  "verdict-new",
  "verdict-repeat",
] as const;

export type IconName = (typeof ICON_NAMES)[number];
