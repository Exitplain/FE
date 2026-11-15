import DropdownMenu from "@/components/DropdownMenu/DropdownMenu";
import Icon from "@/components/Icon/Icon";

import { FUNNEL_STAGES, type MappingRow } from "../data/analyticsMock";

/*
  R05 이벤트 단계 매핑 (R05b 단계 드롭다운) — 수집된 단계 ID 를 사전 테스트 퍼널 단계에 연결합니다.
  취소·매핑 저장은 머리말 버튼(index)에서 처리하고, 여기서는 행만 바꿉니다.
*/
export default function MappingView({
  rows,
  onChange,
}: {
  rows: MappingRow[];
  onChange: (eventId: string, stage: number | null) => void;
}) {
  const linked = rows.filter((row) => row.stage != null).length;

  return (
    <section aria-labelledby="mapping-table-title" className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h2 id="mapping-table-title" className="text-lg font-bold text-ink">
          단계 연결
        </h2>
        <span className="text-xs font-bold text-ink">
          {FUNNEL_STAGES.length}개 중 {Math.min(linked, FUNNEL_STAGES.length)}개 연결
        </span>
      </div>
      <table aria-labelledby="mapping-table-title" className="w-full text-left text-caption">
        <thead>
          <tr className="border-b border-line text-xs text-muted">
            <th className="w-40 py-3 font-medium">수집된 단계 ID</th>
            <th className="w-8" aria-label="연결" />
            <th className="py-3 font-medium">사전 테스트 퍼널 단계</th>
            <th className="w-24 py-3 font-medium">최근 7일 이벤트</th>
            <th className="w-24 py-3 font-medium">자동 추천</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.eventId} className="border-b border-line last:border-b-0">
              <td className="py-3 font-bold text-ink">{row.eventId}</td>
              <td className="py-3">
                <Icon name="arrow-right" className="size-4" />
              </td>
              <td className="py-3">
                <DropdownMenu
                  label={`${row.eventId} 단계`}
                  items={[
                    ...FUNNEL_STAGES.map((stage, index) => ({
                      key: String(index),
                      label: `${index + 1}. ${stage}`,
                      selected: row.stage === index,
                      onSelect: () => onChange(row.eventId, index),
                    })),
                    {
                      key: "none",
                      label: "매핑 안 함",
                      selected: row.stage == null,
                      onSelect: () => onChange(row.eventId, null),
                    },
                  ]}
                  renderTrigger={(props) => (
                    <button
                      type="button"
                      {...props}
                      aria-label={`${row.eventId} 단계: ${
                        row.stage == null ? "매핑 안 함" : FUNNEL_STAGES[row.stage]
                      }`}
                      className="flex min-h-9 items-center gap-2 rounded-md bg-gray-50 px-3 text-ink hover:bg-gray-100"
                    >
                      {row.stage == null
                        ? "매핑 안 함"
                        : `${row.stage + 1}. ${FUNNEL_STAGES[row.stage]}`}
                      <Icon name="chevron-right" className="size-4" />
                    </button>
                  )}
                />
              </td>
              <td className="py-3 text-gray-800">{row.events.toLocaleString("ko-KR")}</td>
              <td className="py-3 text-gray-800">{row.suggestion}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-muted">단계 이름은 사전 테스트와 같아요</p>
    </section>
  );
}
