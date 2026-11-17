import plane from "@/assets/workspace/todo-plane.svg";
import Icon from "@/components/Icon/Icon";

/*
  Figma W01 투두리스트 — 요약 패널 (흰 바탕 · 모서리 10 · 그림자 0 3px 6px).
  칸: 보정 조정안 대기(값 32px Bold) · 이번 주 완료 테스트(22px Bold + 실패 n) · 실측 비교 가능(22px Bold + "프로젝트")
  라벨은 11px 회색, 칸 사이는 높이 82 세로선입니다.
  보정·실측은 BE API 가 아직 없어 실제로 0 이라 0 으로 보여 줍니다 (조정안·실측 연결이 생기면 값만 바뀜).
  이번 주 완료·실패는 실행 목록(끝난 시각 기준 최근 7일)으로 셉니다.
*/
export default function SummaryCards({
  completed,
  failed,
  projectCount,
}: {
  completed: number;
  failed: number;
  projectCount: number;
}) {
  return (
    <section aria-labelledby="workspace-todo" className="flex flex-wrap items-end gap-[34px]">
      <img src={plane} alt="" width={182} height={139} className="shrink-0" />
      <div className="min-w-0 flex-1 space-y-4">
        <h2 id="workspace-todo" className="text-2xl leading-8 font-bold">
          투두리스트
        </h2>
        <div className="grid min-h-[123px] gap-4 rounded-[10px] bg-surface px-5 pt-5 pb-2 shadow-[0_3px_6px_rgb(10_10_10/0.06)] sm:grid-cols-3 sm:gap-0">
          <div className="flex flex-col gap-3 pt-2 pr-5">
            <p className="text-[11px] leading-4 text-subtle">보정 조정안 대기</p>
            <p className="text-[32px] leading-[39px] font-bold text-ink">0개</p>
          </div>
          <div className="flex flex-col gap-3 pt-1 sm:border-l sm:border-line sm:pl-[18px]">
            <p className="text-[11px] leading-4 text-subtle">이번 주 완료 테스트</p>
            <p className="text-[22px] leading-[29px] font-bold text-ink">{completed}개</p>
            <p className="flex items-center gap-1.5 text-[10.5px] leading-[15px] text-subtle">
              <Icon name="status-fail" className="size-[13px] text-danger" />
              실패 {failed}
            </p>
          </div>
          <div className="flex flex-col gap-5 pt-2 sm:border-l sm:border-line sm:pl-5">
            <p className="text-[11px] leading-4 text-subtle">실측 비교 가능</p>
            <p className="flex items-end gap-1">
              <span className="text-[22px] leading-[29px] font-bold text-ink">
                0 / {projectCount}
              </span>
              <span className="text-[11px] leading-4 text-subtle">프로젝트</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
