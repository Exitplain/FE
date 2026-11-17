import plane from "@/assets/workspace/todo-plane.svg";
import Icon from "@/components/Icon/Icon";

/*
  W01 투두리스트. 보정 조정안 대기·실측 비교 가능은 BE 보정·실측 API 가 없어 숨기고,
  실행 목록으로 셀 수 있는 이번 주 완료 테스트만 보여 줍니다.
*/
export default function SummaryCards({ completed, failed }: { completed: number; failed: number }) {
  return (
    <section aria-labelledby="workspace-todo" className="flex flex-wrap items-end gap-10">
      <img src={plane} alt="" width={182} height={139} className="shrink-0" />
      <div className="min-w-0 flex-1 space-y-4">
        <h2 id="workspace-todo" className="text-2xl font-bold">
          투두리스트
        </h2>
        <div className="rounded-xl bg-surface px-6 py-6 shadow-surface">
          <div className="space-y-2">
            <p className="text-xs text-subtle">이번 주 완료 테스트</p>
            <p className="text-3xl font-bold">{completed}개</p>
            <p className="flex items-center gap-1 text-xs text-subtle">
              <Icon name="status-fail" className="text-danger" />
              실패 {failed}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
