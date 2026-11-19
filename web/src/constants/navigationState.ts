/*
  사이드바 "테스트" 메뉴나 다른 프로젝트 탭(실제 고객 데이터 분석 · 예측 맞추기)에서 "테스트 목록"으로
  올 때 붙이는 이동 state 입니다. P01 목록은 이 표시가 있고 진행 중인 실행이 있으면 실행 화면을 이어서 보여 줍니다.
  실행·리포트 화면의 "테스트 목록" 탭 같은 다른 링크에는 붙이지 않아, 진행 중에도 목록을 볼 수 있습니다.
*/
export const RESUME_ACTIVE_RUN_STATE = { resumeActiveRun: true } as const;

export function wantsResumeActiveRun(state: unknown): boolean {
  return (
    typeof state === "object" &&
    state !== null &&
    (state as { resumeActiveRun?: unknown }).resumeActiveRun === true
  );
}
