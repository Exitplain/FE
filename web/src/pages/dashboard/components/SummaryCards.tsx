import plane from "@/assets/workspace/todo-plane.svg";
import Icon from "@/components/Icon/Icon";

/*
  W01 투두리스트 (Figma 3칸: 보정 조정안 대기 · 이번 주 완료 테스트 · 실측 비교 가능).
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
    <section aria-labelledby="workspace-todo" className="flex flex-wrap items-end gap-10">
      <img src={plane} alt="" width={182} height={139} className="shrink-0" />
      <div className="min-w-0 flex-1 space-y-4">
        <h2 id="workspace-todo" className="text-2xl font-bold">
          투두리스트
        </h2>
        <div className="grid gap-6 rounded-xl bg-surface px-6 py-6 shadow-surface sm:grid-cols-3">
          <div className="space-y-2 sm:border-r sm:border-line sm:pr-5">
            <p className="text-xs text-subtle">보정 조정안 대기</p>
            <p className="text-3xl font-bold">0개</p>
          </div>
          <div className="space-y-2 sm:border-r sm:border-line sm:pr-5">
            <p className="text-xs text-subtle">이번 주 완료 테스트</p>
            <p className="text-3xl font-bold">{completed}개</p>
            <p className="flex items-center gap-1 text-xs text-subtle">
              <Icon name="status-fail" className="text-danger" />
              실패 {failed}
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-xs text-subtle">실측 비교 가능</p>
            <p className="text-3xl font-bold">
              0 / {projectCount}
              <span className="ml-2 text-xs font-normal text-subtle">프로젝트</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
