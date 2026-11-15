import Icon from "@/components/Icon/Icon";
import SegmentedTabs from "@/components/SegmentedTabs/SegmentedTabs";
import { cn } from "@/utils/cn";

import {
  COLLECTING_COUNTS,
  type Device,
  funnelCounts,
  FUNNEL_STAGES,
  MIN_SAMPLE,
  type Period,
  PERIOD_RANGE,
} from "../data/analyticsMock";

const PERIODS = [
  { value: "7", label: "최근 7일" },
  { value: "14", label: "14일" },
  { value: "30", label: "30일" },
] as const;
const DEVICES = [
  { value: "all", label: "전체" },
  { value: "mobile", label: "모바일" },
  { value: "desktop", label: "데스크톱" },
] as const;

const formatCount = (n: number) => n.toLocaleString("ko-KR");
const formatPct = (value: number) => `${value.toFixed(1)}%`;

/*
  R06 실측 퍼널 · R07 디바이스별 · E09 표본 부족(수집 중).
  기간·디바이스는 화면 안 선택이라 상위(index)가 들고 있습니다.
*/
export default function FunnelView({
  collecting,
  period,
  device,
  onPeriodChange,
  onDeviceChange,
}: {
  collecting: boolean;
  period: Period;
  device: Device;
  onPeriodChange: (period: Period) => void;
  onDeviceChange: (device: Device) => void;
}) {
  const counts = collecting ? COLLECTING_COUNTS : funnelCounts("all", period);
  const filled = counts.filter((count) => count >= MIN_SAMPLE).length;

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedTabs label="기간" options={PERIODS} value={period} onChange={onPeriodChange} />
        <SegmentedTabs
          label="디바이스"
          options={DEVICES}
          value={device}
          onChange={onDeviceChange}
        />
        <p className="ml-auto text-xs text-subtle">
          {device === "all" || collecting
            ? `${PERIOD_RANGE[period]} · 세션 ${formatCount(counts[0])}`
            : "디바이스별로 나눠 보여줘요"}
        </p>
      </div>

      {collecting && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-lg bg-gray-50 p-3 text-caption font-bold text-ink"
        >
          <Icon name="more" className="size-5" />
          {FUNNEL_STAGES.length}단계 중 {filled}개만 표본을 채웠어요
        </p>
      )}

      {device === "all" || collecting ? (
        <section aria-labelledby="actual-funnel-title" className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <h2 id="actual-funnel-title" className="text-lg font-bold text-ink">
              실측 퍼널
            </h2>
            <span className="text-xs text-muted">실측(실제 사용자) · 단일값</span>
          </div>
          <FunnelBars counts={counts} labelledBy="actual-funnel-title" sampleCheck={collecting} />
        </section>
      ) : (
        <div className="grid grid-cols-1 gap-12 md:grid-cols-2">
          {(["mobile", "desktop"] as const).map((key) => {
            const deviceCounts = funnelCounts(key, period);
            const id = `device-funnel-${key}`;
            return (
              <section key={key} aria-labelledby={id} className="flex flex-col gap-2 p-4">
                <h2 id={id} className="font-bold text-ink">
                  {key === "mobile" ? "모바일" : "데스크톱"} · {formatCount(deviceCounts[0])} 세션
                </h2>
                <FunnelBars counts={deviceCounts} labelledBy={id} compact />
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* 단계별 막대 — 첫 단계 대비 너비, 오른쪽에 세션 · 도달률 · 직전 대비 이탈 */
function FunnelBars({
  counts,
  labelledBy,
  sampleCheck = false,
  compact = false,
}: {
  counts: number[];
  labelledBy: string;
  sampleCheck?: boolean;
  compact?: boolean;
}) {
  const base = counts[0] || 1;
  return (
    <table aria-labelledby={labelledBy} className="w-full text-left">
      <tbody>
        {counts.map((count, index) => {
          const reach = (count / base) * 100;
          const drop = index === 0 ? null : (1 - count / counts[index - 1]) * 100;
          const short = sampleCheck && count < MIN_SAMPLE;
          return (
            <tr key={FUNNEL_STAGES[index]} className="border-b border-line last:border-b-0">
              <th
                scope="row"
                className={cn(
                  "py-1.5 pr-4 font-medium text-ink",
                  compact ? "w-20 text-xs" : "w-24 text-caption",
                )}
              >
                {FUNNEL_STAGES[index]}
              </th>
              <td className="py-1.5">
                <div className={cn("rounded-xs bg-gray-50", compact ? "h-3" : "h-4")}>
                  {/* 너비는 도달률 값이라 style 로 둡니다 */}
                  <div
                    className={cn("h-full rounded-xs", short ? "bg-gray-300" : "bg-subtle")}
                    style={{ width: `${reach}%` }}
                  />
                </div>
              </td>
              <td
                className={cn(
                  "py-1.5 pl-3 whitespace-nowrap",
                  compact ? "w-28 text-xs" : "w-52 text-xs",
                  short ? "text-muted" : "text-ink",
                )}
              >
                {compact
                  ? `${formatCount(count)} · ${formatPct(reach)}`
                  : `${formatCount(count)} 세션 · ${formatPct(reach)}${
                      drop != null && !short ? ` · 이탈 ${formatPct(drop)}` : ""
                    }`}
              </td>
              {sampleCheck && (
                <td className="w-24 py-1.5 text-right text-xs font-bold text-ink">
                  {short && (
                    <span className="inline-flex items-center gap-1">
                      <Icon name="more" className="size-4" />
                      표본 부족
                    </span>
                  )}
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
