/* 화면에 줄여 보여 줄 사이트 이름. 주소 없이 만든 프로젝트(첫 테스트 전)는 빈 문자열입니다 */
export function siteHost(url: string): string {
  if (!url) return "";
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}
