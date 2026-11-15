import type { ReactNode } from "react";

import characterDefault from "@/assets/characters/character-default.svg";
import Button from "@/components/Button/Button";
import Icon from "@/components/Icon/Icon";
import Modal from "@/components/Modal/Modal";
import SegmentedTabs from "@/components/SegmentedTabs/SegmentedTabs";
import { cn } from "@/utils/cn";

import {
  ADJUSTMENTS,
  ERROR_SUMMARY,
  type HistoryRow,
  PROPOSAL_BASIS,
  STAGE_ERRORS,
} from "../data/calibrationMock";

const formatPp = (value: number) =>
  `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toFixed(1)}%p`;

/* Figma Card/KPI 3칸 — 첫 칸은 큰 숫자, 나머지는 세로 선으로 나눕니다 */
export function KpiTrio({
  items,
}: {
  items: { label: string; value: ReactNode; note?: string }[];
}) {
  return (
    <dl className="grid grid-cols-1 md:grid-cols-4">
      {items.map((item, index) => (
        <div
          key={item.label}
          className={cn(
            "flex flex-col gap-1 p-4",
            index === 0 ? "md:col-span-2" : "border-line md:border-l",
          )}
        >
          <dt className="text-xs text-subtle">{item.label}</dt>
          <dd className={cn("font-bold text-ink", index === 0 ? "text-display" : "text-lg")}>
            {item.value}
          </dd>
          {item.note && <dd className="text-xs text-muted">{item.note}</dd>}
        </div>
      ))}
    </dl>
  );
}

/* K01 보정 조정안 */
export function ProposalView() {
  const changed = ADJUSTMENTS.filter((row) => row.proposed);
  return (
    <div className="flex flex-col gap-10">
      <p className="flex items-center gap-2 rounded-lg bg-gray-50 p-3 text-caption font-bold text-ink">
        <Icon name="settings" className="size-5" />
        {PROPOSAL_BASIS}
      </p>
      <KpiTrio
        items={[
          {
            label: "지금 예측 오차",
            value: `${ERROR_SUMMARY.before}%p`,
            note: `평균 · ${ERROR_SUMMARY.stageCount}개 단계`,
          },
          {
            label: "보정 후 예상 오차",
            value: `${ERROR_SUMMARY.after}%p`,
            note: "같은 데이터로 다시 계산",
          },
          {
            label: "차이 구간",
            value: `${ERROR_SUMMARY.stagesBefore}곳 → ${ERROR_SUMMARY.stagesAfter}곳`,
            note: "예상",
          },
        ]}
      />
      <section aria-labelledby="adjust-title" className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 id="adjust-title" className="text-lg font-bold text-ink">
            조정안
          </h2>
          <span className="text-xs font-bold text-ink">
            세그먼트{" "}
            {new Set(ADJUSTMENTS.map((row) => row.segment).filter((s) => s !== "전체")).size}개 · 값{" "}
            {changed.length}개 변경
          </span>
        </div>
        <table aria-labelledby="adjust-title" className="w-full text-left text-caption">
          <thead>
            <tr className="border-b border-line text-xs text-muted">
              <th className="w-32 py-3 font-medium">세그먼트</th>
              <th className="w-44 py-3 font-medium">항목</th>
              <th className="w-20 py-3 font-medium">현재 값</th>
              <th className="w-20 py-3 font-medium">제안 값</th>
              <th className="py-3 font-medium">근거</th>
            </tr>
          </thead>
          <tbody>
            {ADJUSTMENTS.map((row, index) => (
              <tr key={index} className="border-b border-line last:border-b-0">
                <th scope="row" className="py-3 font-bold text-ink">
                  {row.segment}
                </th>
                <td className="py-3 text-gray-800">{row.item}</td>
                <td className="py-3 text-gray-800">{row.current}</td>
                <td className="py-3 font-bold text-ink">{row.proposed || "변화 없음"}</td>
                <td className="py-3 text-gray-800">{row.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

/* K02 보정 적용 확인 */
export function ApplyModal({
  open,
  onClose,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  onApply: () => void;
}) {
  const changed = ADJUSTMENTS.filter((row) => row.proposed);
  const segments = new Set(changed.map((row) => row.segment).filter((s) => s !== "전체")).size;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="보정을 적용할까요?"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button onClick={onApply}>보정 적용</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-caption font-bold text-ink">바뀌는 값 · 현재 → 제안</p>
        <ul className="flex flex-col text-caption">
          {changed.map((row, index) => (
            <li
              key={index}
              className="flex items-center gap-4 border-b border-line py-2.5 last:border-b-0"
            >
              <span className="w-28 font-bold text-ink">{row.segment}</span>
              <span className="flex-1 text-gray-800">{row.item}</span>
              <span className="font-bold text-ink">
                {row.current} → {row.proposed}
              </span>
            </li>
          ))}
        </ul>
        <ul className="flex flex-col">
          {[
            [`값 ${changed.length}개가 바뀌어요`, `세그먼트 4개 중 ${segments}개`],
            /* 임시: 새 테스트 위저드는 보정 이력 API mock 을 읽어, 여기서 적용해도 표시가 바뀌지 않습니다 */
            ["다음 사전 테스트부터 자동으로 써요", "새 테스트 입력에 ‘보정 적용됨’으로 표시"],
            ["이미 끝난 테스트 결과는 바뀌지 않아요", "비교하려면 재테스트하세요"],
          ].map(([title, note]) => (
            <li key={title} className="flex gap-3 border-b border-line py-2.5 last:border-b-0">
              <Icon name="check" className="mt-0.5 size-4" />
              <span className="flex flex-col">
                <span className="text-caption font-bold text-ink">{title}</span>
                <span className="text-xs text-subtle">{note}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}

/* K03 보정 적용됨 — 오차 비교 · 보정 이력(K03b) 탭 */
export function AppliedView({
  tab,
  onTabChange,
  history,
}: {
  tab: "errors" | "history";
  onTabChange: (tab: "errors" | "history") => void;
  history: HistoryRow[];
}) {
  return (
    <div className="flex flex-col gap-10">
      <SegmentedTabs
        label="보정 보기"
        value={tab}
        onChange={onTabChange}
        options={[
          { value: "errors", label: "오차 비교" },
          { value: "history", label: `보정 이력 ${history.length}` },
        ]}
      />
      {tab === "errors" ? (
        <>
          <KpiTrio
            items={[
              { label: "보정 전 오차", value: `${ERROR_SUMMARY.before}%p`, note: "평균" },
              {
                label: "보정 후 오차",
                value: `${ERROR_SUMMARY.after}%p`,
                note: "같은 실측 기준 재계산",
              },
              {
                label: "차이 구간",
                value: `${ERROR_SUMMARY.stagesBefore}곳 → ${ERROR_SUMMARY.stagesAfter}곳`,
              },
            ]}
          />
          <section aria-labelledby="stage-error-title" className="flex flex-col gap-3">
            <h2 id="stage-error-title" className="text-lg font-bold text-ink">
              단계별 오차 · 보정 전 vs 후
            </h2>
            <table aria-labelledby="stage-error-title" className="w-full text-left text-caption">
              <thead>
                <tr className="border-b border-line text-xs text-muted">
                  <th className="py-3 font-medium">단계</th>
                  <th className="w-24 py-3 font-medium">보정 전</th>
                  <th className="w-24 py-3 font-medium">보정 후</th>
                  <th className="w-32 py-3 font-medium">변화</th>
                </tr>
              </thead>
              <tbody>
                {STAGE_ERRORS.map((row) => {
                  const strong = row.change === "차이 구간 해소";
                  return (
                    <tr key={row.stage} className="border-b border-line last:border-b-0">
                      <th scope="row" className="py-3 font-bold text-ink">
                        {row.stage}
                      </th>
                      <td className={cn("py-3", strong ? "font-bold text-ink" : "text-gray-800")}>
                        {formatPp(row.before)}
                      </td>
                      <td className={cn("py-3", strong ? "font-bold text-ink" : "text-gray-800")}>
                        {formatPp(row.after)}
                      </td>
                      <td className={cn("py-3", strong ? "font-bold text-ink" : "text-gray-800")}>
                        {row.change}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        </>
      ) : (
        <HistoryTable history={history} />
      )}
    </div>
  );
}

/* K03b 보정 이력 */
export function HistoryTable({ history }: { history: HistoryRow[] }) {
  return (
    <section aria-labelledby="history-title" className="flex flex-col gap-3">
      <h2 id="history-title" className="text-lg font-bold text-ink">
        보정 이력
      </h2>
      <table aria-labelledby="history-title" className="w-full text-left text-caption">
        <thead>
          <tr className="border-b border-line text-xs text-muted">
            <th className="w-24 py-3 font-medium">일시</th>
            <th className="py-3 font-medium">변경 값</th>
            <th className="w-40 py-3 font-medium">기준 비교</th>
            <th className="w-28 py-3 font-medium">오차 변화</th>
          </tr>
        </thead>
        <tbody>
          {history.map((row, index) => (
            <tr key={`${row.date}-${index}`} className="border-b border-line last:border-b-0">
              <th scope="row" className="py-3 font-bold text-ink">
                {row.date}
              </th>
              <td className="py-3 pr-6 text-gray-800">{row.change}</td>
              <td className="py-3 text-gray-800">{row.basis}</td>
              <td className={cn("py-3", index === 0 ? "font-bold text-ink" : "text-gray-800")}>
                {row.error}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/* E11 보정할 차이 없음 */
export function NoDifference({ onHistory }: { onHistory: () => void }) {
  return (
    <section
      aria-labelledby="no-diff-title"
      className="flex flex-col items-center gap-2 py-16 text-center"
    >
      <img src={characterDefault} alt="" className="mb-10 h-40 w-auto" />
      <h2 id="no-diff-title" className="text-lg font-bold text-ink">
        지금은 보정할 차이가 없어요
      </h2>
      <p className="text-sm text-subtle">모든 단계가 예측 범위 안이에요 · 평균 오차 1.2%p</p>
      <Button variant="secondary" className="mt-4" onClick={onHistory}>
        보정 이력 보기
      </Button>
    </section>
  );
}
