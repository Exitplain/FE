import plane from "@/assets/workspace/todo-plane.svg";
import Icon from "@/components/Icon/Icon";

/*
  Figma W01 투두리스트 — 요약 패널 (흰 바탕 · 모서리 10 · 그림자 0 3px 6px).
  칸: 보정 조정안 대기 · 이번 주 완료 테스트(+ 실패 n) · 실측 비교 가능(+ "프로젝트"), 칸 사이 세로선.
  Figma 패널은 축소해 그려져 있어(라벨 11px) 읽기 좋게 라벨 12px · 값 30px Bold 로 맞춥니다.
  실측 비교 가능: 내 프로젝트(샘플 제외) 중 실측이 연결된(수집을 받은) 수.
  보정 조정안 대기: 프로젝트마다 무거운 조정안 계산(GET /calibration/proposal)이 필요해 아직 세지 않고 "–" 로 둡니다.
  이번 주 완료·실패는 실행 목록(끝난 시각 기준 최근 7일)으로 셉니다.
*/
export default function SummaryCards({
  completed,
  failed,
  comparable,
  projectCount,
}: {
  completed: number;
  failed: number;
  comparable: number;
  projectCount: number;
}) {
  return (
    <section aria-labelledby="workspace-todo" className="flex flex-wrap items-end gap-[34px]">
      <img src={plane} alt="" width={182} height={139} className="shrink-0" />
      <div className="min-w-0 flex-1 space-y-4">
        <h2 id="workspace-todo" className="text-2xl leading-8 font-bold">
          투두리스트
        </h2>
        <div className="grid gap-4 rounded-[10px] bg-surface px-6 py-6 shadow-[0_3px_6px_rgb(10_10_10/0.06)] sm:grid-cols-3 sm:gap-0">
          <div className="flex flex-col gap-2 sm:pr-5">
            <p className="text-xs leading-4 text-subtle">보정 조정안 대기</p>
            <p className="text-3xl font-bold text-ink">–</p>
          </div>
          <div className="flex flex-col gap-2 sm:border-l sm:border-line sm:px-5">
            <p className="text-xs leading-4 text-subtle">이번 주 완료 테스트</p>
            <p className="text-3xl font-bold text-ink">{completed}개</p>
            <p className="flex items-center gap-1.5 text-xs text-subtle">
              <Icon name="status-fail" className="size-3.5 text-danger" />
              실패 {failed}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:border-l sm:border-line sm:pl-5">
            <p className="text-xs leading-4 text-subtle">실측 비교 가능</p>
            <p className="flex items-end gap-1">
              <span className="text-3xl font-bold text-ink">
                {comparable} / {projectCount}
              </span>
              <span className="pb-1 text-xs text-subtle">프로젝트</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
