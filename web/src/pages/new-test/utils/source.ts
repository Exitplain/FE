import type { SourceSnapshot } from "@/types/source.type";

/* 코드 받기 진행을 다시 묻는 간격 (테스트는 바로) */
export const SOURCE_POLL_MS = import.meta.env.MODE === "test" ? 0 : 1000;
/* 서버가 멈춘 작업을 2분 안에 실패로 바꾸지만, 그래도 끝나지 않으면 이 시간 뒤 그만 묻습니다 */
export const SOURCE_POLL_LIMIT_MS = 10 * 60 * 1000;
/* BE EXITPLAIN_SOURCE_MAX_UPLOAD_BYTES 와 같게 */
export const MAX_ZIP_BYTES = 30 * 1024 * 1024;

const RUNNABLE_TEXT: Record<SourceSnapshot["runnable"], string> = {
  static: "정적 사이트",
  needs_build: "빌드 필요",
  unknown: "실행 방법 확인 필요",
};
const SKIP_TEXT: Record<string, string> = {
  secret_like: "비밀값으로 보이는 파일",
  excluded_dir: "빌드·의존성 폴더",
  too_large: "너무 큰 파일",
  unsafe_path: "위험한 경로",
  symlink: "심볼릭 링크",
};

/* "코드를 준비했어요 · commit a2d43dd · 파일 445개 · 정적 사이트 · 화면 경로 15개" */
export function sourceSummary(source: SourceSnapshot) {
  return [
    "코드를 준비했어요",
    source.commit_sha ? `commit ${source.commit_sha.slice(0, 7)}` : null,
    `파일 ${source.file_count}개`,
    RUNNABLE_TEXT[source.runnable],
    source.analysis.counts ? `화면 경로 ${source.analysis.counts.routes}개` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/* 저장하지 않은 파일과 다음에 할 수 있는 일 */
export function sourceNote(source: SourceSnapshot) {
  const skipped = Object.entries(source.skipped ?? {})
    .filter(([, count]) => count > 0)
    .map(([key, count]) => `${SKIP_TEXT[key] ?? key} ${count}개`)
    .join(", ");
  const next =
    source.runnable === "static"
      ? "정적 사이트라 URL 없이 미리보기로 테스트할 수 있어요"
      : source.runnable === "needs_build"
        ? "빌드가 필요해 지금은 코드 분석만 했어요 · 빌드 결과물(dist) zip 이나 배포 URL 을 주면 테스트할 수 있어요"
        : "실행 방법을 판단하지 못해 코드 분석만 했어요";
  return skipped ? `${skipped}는 저장하지 않았어요 · ${next}` : next;
}
