import DropdownMenu from "@/components/DropdownMenu/DropdownMenu";
import Icon from "@/components/Icon/Icon";
import type { MappingRowData, MappingStage } from "@/types/measurement.type";

const SUGGESTION: Record<string, string> = { exact: "일치", similar: "이름 유사" };

/*
  R05 이벤트 단계 매핑 (R05b 단계 드롭다운) — 실제 방문자에게서 수집한 화면(단계 ID)을 사전 테스트 실행 퍼널 단계에 연결합니다.
  단계 ID 와 퍼널 단계는 모두 화면 경로라 대부분 자동 추천(일치)으로 맞춰집니다.
  취소·매핑 저장은 머리말 버튼(MappingStep)에서 처리하고, 여기서는 행만 바꿉니다.
*/
export default function MappingView({
  stages,
  rows,
  draft,
  onChange,
}: {
  stages: MappingStage[];
  rows: MappingRowData[];
  /* 지금 고른 값 {step_id: stage_id | null} */
  draft: Record<string, string | null>;
  onChange: (stepId: string, stageId: string | null) => void;
}) {
  const order = new Map(stages.map((stage, index) => [stage.id, index]));
  const indexOf = (stageId: string | null) => (stageId == null ? undefined : order.get(stageId));
  const linked = new Set(Object.values(draft).filter((id) => id != null && order.has(id))).size;

  return (
    <section aria-labelledby="mapping-table-title" className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h2 id="mapping-table-title" className="text-lg font-bold text-ink">
          단계 연결
        </h2>
        <span className="text-xs font-bold text-ink">
          {stages.length}개 중 {linked}개 연결
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-lg bg-gray-50 p-4 text-caption text-subtle">
          최근 7일 동안 수집된 화면이 없어요. 사이트를 열어 본 뒤 다시 확인해 주세요.
        </p>
      ) : (
        <table aria-labelledby="mapping-table-title" className="w-full text-left text-caption">
          <thead>
            <tr className="border-b border-line text-xs text-muted">
              <th className="w-56 py-3 font-medium">수집된 단계 ID</th>
              <th className="w-8" aria-label="연결" />
              <th className="py-3 font-medium">사전 테스트 퍼널 단계</th>
              <th className="w-28 py-3 font-medium">최근 7일 세션</th>
              <th className="w-24 py-3 font-medium">자동 추천</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const current = draft[row.step_id] ?? null;
              const index = indexOf(current);
              return (
                <tr key={row.step_id} className="border-b border-line last:border-b-0">
                  <td className="py-3 font-bold break-all text-ink">{row.step_id}</td>
                  <td className="py-3">
                    <Icon name="arrow-right" className="size-4" />
                  </td>
                  <td className="py-3">
                    <DropdownMenu
                      label={`${row.step_id} 단계`}
                      items={[
                        ...stages.map((stage, i) => ({
                          key: stage.id,
                          label: `${i + 1}. ${stage.name}`,
                          selected: current === stage.id,
                          onSelect: () => onChange(row.step_id, stage.id),
                        })),
                        {
                          key: "none",
                          label: "매핑 안 함",
                          selected: index === undefined,
                          onSelect: () => onChange(row.step_id, null),
                        },
                      ]}
                      renderTrigger={(props) => (
                        <button
                          type="button"
                          {...props}
                          aria-label={`${row.step_id} 단계: ${
                            index === undefined ? "매핑 안 함" : stages[index].name
                          }`}
                          className="flex min-h-9 items-center gap-2 rounded-md bg-gray-50 px-3 text-ink hover:bg-gray-100"
                        >
                          {index === undefined
                            ? "매핑 안 함"
                            : `${index + 1}. ${stages[index].name}`}
                          <Icon name="chevron-right" className="size-4" />
                        </button>
                      )}
                    />
                  </td>
                  <td className="py-3 text-gray-800 tabular-nums">
                    {row.sessions.toLocaleString("ko-KR")}
                  </td>
                  <td className="py-3 text-gray-800">
                    {row.suggestion ? SUGGESTION[row.suggestion] : "후보 없음"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <p className="text-xs text-muted">
        단계 이름은 가장 최근 사전 테스트의 실행 퍼널과 같아요 · 단계 ID 는 화면 경로예요
      </p>
    </section>
  );
}
