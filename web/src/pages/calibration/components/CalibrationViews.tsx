import type { ReactNode } from "react";

import characterDefault from "@/assets/characters/character-default.svg";
import Button from "@/components/Button/Button";
import Icon from "@/components/Icon/Icon";
import Modal from "@/components/Modal/Modal";
import TrendLineChart from "@/components/TrendLineChart/TrendLineChart";
import type {
  CalibrationCompare,
  CalibrationProposal,
  CalibrationRecord,
  ProposalItem,
} from "@/types/calibration.type";
import { cn } from "@/utils/cn";

import { formatApplied, formatScale } from "../utils/format";

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

function basisText(proposal: CalibrationProposal) {
  const basis = proposal.basis;
  if (!basis) return "";
  const run = basis.run_sequence ? `${basis.run_sequence}차` : "사전 테스트";
  if (basis.evidence === "mixed") {
    return `${run} vs 실제 고객 데이터 ${basis.measurement_count ?? 0}회 방문 + 사람 관측 ${basis.observation_count ?? 0}명 (합 ${basis.count}건)`;
  }
  if (basis.evidence === "observations") {
    const picks = (basis.picks ?? []).map((pick) => pick.stage_name).join(" · ");
    return `${run} vs 사람 관측 ${basis.count}명 · 가장 불편했던 화면 기준${picks ? ` · 많이 고른 화면 ${picks}` : ""}`;
  }
  const gaps = basis.gaps.map((gap) => gap.stage_name).join(" · ");
  return `${run} vs 실제 고객 데이터 ${basis.days}일 (${basis.count}회 방문) · 오차 ${basis.mean_error ?? "—"}%p${gaps ? ` · 차이 구간 ${gaps}` : ""}`;
}

/* K01 보정 조정안 — 바뀌는 행과, 바뀌지 않는 세그먼트("변화 없음")를 함께 보여줍니다 */
export function ProposalView({ proposal }: { proposal: CalibrationProposal }) {
  const segments = new Set(
    proposal.items.map((item) => item.segment_id).filter((id) => id !== "*"),
  );
  return (
    <div className="flex flex-col gap-10">
      <p className="flex items-center gap-2 rounded-lg bg-gray-50 p-3 text-caption font-bold text-ink">
        <Icon name="settings" className="size-5" />
        {basisText(proposal)}
      </p>
      <KpiTrio
        items={[
          {
            label: "지금 예측 오차",
            value: proposal.basis?.mean_error == null ? "—" : `${proposal.basis.mean_error}%p`,
            note: "평균 · 비교한 단계",
          },
          {
            label: "예측 맞추기 후 오차",
            value: "다음 테스트 후",
            note: "적용한 뒤 새 사전 테스트 결과로 확인해요",
          },
          proposal.basis?.evidence === "observations"
            ? {
                label: "사람이 많이 고른 화면",
                value: `${proposal.basis.picks?.length ?? 0}곳`,
                note: "모델이 본 불편한 점이 낮았던 화면",
              }
            : {
                label: "차이 구간",
                value: `${proposal.basis?.gaps.length ?? 0}곳`,
                note: "실제 고객 데이터가 예측 범위 밖",
              },
        ]}
      />
      <section aria-labelledby="adjust-title" className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 id="adjust-title" className="text-lg font-bold text-ink">
            조정안
          </h2>
          <span className="text-xs font-bold text-ink">
            세그먼트 {segments.size}개 · 값 {proposal.items.length}개 변경
          </span>
        </div>
        <table aria-labelledby="adjust-title" className="w-full text-left text-caption">
          <thead>
            <tr className="border-b border-line text-xs text-muted">
              <th className="w-32 py-3 font-medium">세그먼트</th>
              <th className="w-48 py-3 font-medium">항목</th>
              <th className="w-20 py-3 font-medium">현재 값</th>
              <th className="w-20 py-3 font-medium">제안 값</th>
              <th className="py-3 font-medium">근거</th>
            </tr>
          </thead>
          <tbody>
            {proposal.items.map((item) => (
              <tr key={item.key} className="border-b border-line last:border-b-0">
                <th scope="row" className="py-3 font-bold text-ink">
                  {item.segment_name}
                </th>
                <td className="py-3 text-gray-800">{item.label}</td>
                <td className="py-3 text-gray-800 tabular-nums">{formatScale(item.current)}</td>
                <td className="py-3 font-bold text-ink tabular-nums">
                  {formatScale(item.proposed)}
                </td>
                <td className="py-3 text-gray-800">{item.reason}</td>
              </tr>
            ))}
            {(proposal.unchanged_segments ?? []).map((segment) => (
              <tr key={segment.segment_id} className="border-b border-line last:border-b-0">
                <th scope="row" className="py-3 font-bold text-ink">
                  {segment.segment_name}
                </th>
                <td className="py-3 text-gray-800">—</td>
                <td className="py-3 text-gray-800">—</td>
                <td className="py-3 font-bold text-ink">변화 없음</td>
                <td className="py-3 text-gray-800">이 세그먼트는 차이 구간의 근거가 아니에요</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-muted">
          값은 배율이에요 (×1.00 = 기본 모형). 실제 고객 데이터 숫자를 넣지 않고 배율만 바꿔요 ·
          가설값이에요
        </p>
      </section>
    </div>
  );
}

/* K02 보정 적용 확인 */
export function ApplyModal({
  open,
  items,
  pending,
  error,
  onClose,
  onApply,
}: {
  open: boolean;
  items: ProposalItem[];
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onApply: () => void;
}) {
  const segments = new Set(items.map((item) => item.segment_id).filter((id) => id !== "*")).size;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="예측 맞추기를 적용할까요?"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button disabled={pending} onClick={onApply}>
            {pending ? "적용하는 중…" : "예측 맞추기 적용"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-caption font-bold text-ink">바뀌는 값 · 현재 → 제안</p>
        <ul className="flex flex-col text-caption">
          {items.map((item) => (
            <li
              key={item.key}
              className="flex items-center gap-4 border-b border-line py-2.5 last:border-b-0"
            >
              <span className="w-28 font-bold text-ink">{item.segment_name}</span>
              <span className="flex-1 text-gray-800">{item.label}</span>
              <span className="font-bold text-ink tabular-nums">
                {formatScale(item.current)} → {formatScale(item.proposed)}
              </span>
            </li>
          ))}
        </ul>
        <ul className="flex flex-col">
          {[
            [`값 ${items.length}개가 바뀌어요`, `세그먼트 ${segments}개 + 전체 값`],
            ["다음 사전 테스트부터 자동으로 써요", "실행 화면·리포트에 예측 맞추기 번호가 남아요"],
            ["이미 끝난 테스트 결과는 바뀌지 않아요", "비교하려면 새 사전 테스트를 돌려요"],
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
        {error && (
          <p role="alert" className="text-caption text-danger">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

/* K03 보정 적용됨 — 보정 전·후 단계별 오차 (CAL-15). 추정하지 않고, 이 보정으로 돈 사전 테스트가 끝나야 숫자가 나와요 */
export function CompareSection({ compare }: { compare: CalibrationCompare }) {
  const ready = compare.status === "ready";
  const pp = (value: number | null | undefined) =>
    value == null
      ? "—"
      : `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toFixed(1)}%p`;
  return (
    <section aria-labelledby="compare-title" className="flex flex-col gap-6">
      <h2 id="compare-title" className="sr-only">
        예측 맞추기 전·후 오차
      </h2>
      <KpiTrio
        items={[
          {
            label: "예측 맞추기 전 오차",
            value: compare.before?.mean_error == null ? "—" : `${compare.before.mean_error}%p`,
            note: "평균 · 같은 실제 고객 데이터 기간",
          },
          {
            label: "예측 맞추기 후 오차",
            value: ready
              ? compare.after?.mean_error == null
                ? "—"
                : `${compare.after.mean_error}%p`
              : "다음 테스트 후",
            note: ready
              ? `${compare.after?.run_sequence}차 결과로 다시 계산`
              : "새 사전 테스트가 끝나면 같은 실제 고객 데이터 기간으로 비교해요",
          },
          {
            label: "차이 구간",
            value: ready
              ? `${compare.before?.gaps ?? 0}곳 → ${compare.after?.gaps ?? 0}곳`
              : `${compare.before?.gaps ?? 0}곳`,
          },
        ]}
      />
      {compare.status === "waiting" && (
        <p className="flex items-center gap-2 rounded-lg bg-gray-50 p-3 text-caption text-ink">
          <Icon name="more" className="size-5" />
          {compare.message}
        </p>
      )}
      {compare.stages.length > 0 && (
        <table
          aria-label="단계별 오차 · 예측 맞추기 전 vs 후"
          className="w-full text-left text-caption"
        >
          <thead>
            <tr className="border-b border-line text-xs text-muted">
              <th className="py-3 font-medium">단계</th>
              <th className="w-24 py-3 font-medium">예측 맞추기 전</th>
              <th className="w-24 py-3 font-medium">예측 맞추기 후</th>
              <th className="w-32 py-3 font-medium">변화</th>
            </tr>
          </thead>
          <tbody>
            {compare.stages.map((row) => {
              const strong = row.change === "차이 구간 해소";
              return (
                <tr
                  key={`${row.task_id}${row.stage_id}`}
                  className="border-b border-line last:border-b-0"
                >
                  <th scope="row" className="py-3 font-bold text-ink">
                    {row.stage_name}
                    <span className="block text-xs font-medium text-muted">{row.task_name}</span>
                  </th>
                  <td className={cn("py-3", row.gap ? "font-bold text-ink" : "text-gray-800")}>
                    {pp(row.before ?? row.error)}
                  </td>
                  <td className={cn("py-3", strong ? "font-bold text-ink" : "text-gray-800")}>
                    {ready ? pp(row.after) : "—"}
                  </td>
                  <td className={cn("py-3", strong ? "font-bold text-ink" : "text-gray-800")}>
                    {row.change ?? "대기"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

/* K03b 보정 이력 — 되돌리기는 그 값을 복사한 새 기록으로 남아요 (지우지 않음) */
export function HistoryTable({
  history,
  pending,
  onRestore,
  onReset,
}: {
  history: CalibrationRecord[];
  pending: boolean;
  onRestore: (record: CalibrationRecord) => void;
  onReset: () => void;
}) {
  return (
    <section aria-labelledby="history-title" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 id="history-title" className="text-lg font-bold text-ink">
          예측 맞추기 이력
        </h2>
        {history.length > 0 && history[0].restored_from !== 0 && (
          <Button variant="secondary" disabled={pending} onClick={onReset}>
            기본 모형으로 되돌리기
          </Button>
        )}
      </div>
      <table aria-labelledby="history-title" className="w-full text-left text-caption">
        <thead>
          <tr className="border-b border-line text-xs text-muted">
            <th className="w-36 py-3 font-medium">일시</th>
            <th className="py-3 font-medium">변경 값</th>
            <th className="w-40 py-3 font-medium">기준 비교</th>
            <th className="w-28 py-3 font-medium">오차 변화</th>
            <th className="w-28 py-3" aria-label="되돌리기" />
          </tr>
        </thead>
        <tbody>
          {history.map((row, index) => (
            <tr key={row.id} className="border-b border-line last:border-b-0">
              <th scope="row" className="py-3 font-bold text-ink">
                {formatApplied(row.applied_at)}
                <span className="block text-xs font-medium text-muted">r{row.revision}</span>
              </th>
              <td className="py-3 pr-6 text-gray-800">{row.changes_summary}</td>
              <td className="py-3 text-gray-800">{row.base_comparison ?? "—"}</td>
              <td className={cn("py-3", index === 0 ? "font-bold text-ink" : "text-gray-800")}>
                {row.error_before_pp == null
                  ? "—"
                  : `${row.error_before_pp} → ${row.error_after_pp ?? "다음 테스트 후"}`}
              </td>
              <td className="py-3 text-right">
                {index > 0 && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => onRestore(row)}
                    className="text-caption font-bold text-ink underline underline-offset-4 disabled:text-muted"
                  >
                    이 값으로 되돌리기
                  </button>
                )}
              </td>
            </tr>
          ))}
          <tr>
            <th scope="row" className="py-3 font-bold text-ink">
              처음
            </th>
            <td className="py-3 text-gray-800" colSpan={4}>
              첫 예측 맞추기 전 (기본 모형)
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}

/* E11 보정할 차이 없음 · 그 밖의 "아직 조정안을 만들 수 없음" 상태 */
export function NoProposal({
  title,
  message,
  action,
  aside,
}: {
  title: string;
  message: string;
  action?: ReactNode;
  /* 위에 함께 보여 줄 것 (직전 보정의 전·후 비교 등) */
  aside?: ReactNode;
}) {
  return (
    <>
      {aside}
      <section
        aria-labelledby="no-proposal-title"
        className="flex flex-col items-center gap-2 py-16 text-center"
      >
        <img src={characterDefault} alt="" className="mb-10 h-40 w-auto" />
        <h2 id="no-proposal-title" className="text-lg font-bold text-ink">
          {title}
        </h2>
        <p className="text-sm text-subtle">{message}</p>
        {action && <div className="mt-4">{action}</div>}
      </section>
    </>
  );
}

/* 보정 이력별 예측 오차 추이 (꺾은선). 보정 전 = 조정안 기준 오차, 보정 후 = 그 보정으로 돈 첫 테스트 오차 */
export function ErrorTrend({ history }: { history: CalibrationRecord[] }) {
  const points = [...history]
    .filter((row) => row.restored_from === null && row.error_before_pp !== null)
    .sort((a, b) => a.revision - b.revision)
    .map((row) => ({
      x: `r${row.revision}`,
      before: row.error_before_pp,
      after: row.error_after_pp,
    }));
  if (points.length === 0) return null;
  return (
    <section aria-labelledby="error-trend-title" className="flex flex-col gap-3">
      <h2 id="error-trend-title" className="text-lg font-bold text-ink">
        예측 오차 추이
      </h2>
      <TrendLineChart
        title="예측 맞추기별 예측 오차 추이"
        unit="%p"
        data={points}
        series={[
          { key: "before", label: "예측 맞추기 전 오차", color: "#a3a3a3", dashed: true },
          { key: "after", label: "예측 맞추기 후 오차", color: "#171717" },
        ]}
      />
      <p className="text-xs text-muted">
        낮을수록 예측이 실제와 가까워요 · 예측 맞추기 후 오차는 그 예측 맞추기로 돈 첫 테스트가
        끝나야 생겨요
      </p>
    </section>
  );
}
