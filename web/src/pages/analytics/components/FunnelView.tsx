import ChoiceChip from "@/components/ChoiceChip/ChoiceChip";
import Icon from "@/components/Icon/Icon";
import SegmentedTabs from "@/components/SegmentedTabs/SegmentedTabs";
import type {
  FunnelDays,
  FunnelDevice,
  FunnelTaskCompare,
  MeasurementFunnel,
} from "@/types/measurement.type";
import { cn } from "@/utils/cn";

import { useMeasurementFunnel } from "../hooks/useMeasurement";
import { formatCount, formatPct, PERIODS, periodText } from "../utils/funnel";

/* Figma R06·R07: 모바일·데스크톱 중 하나를 고르면 둘을 나란히 보여줍니다 */
const DEVICES = [
  { value: "all", label: "전체" },
  { value: "mobile", label: "모바일" },
  { value: "desktop", label: "데스크톱" },
] as const;

/* 과업 고르기 (R06·R08 공통). 실행 퍼널은 과업마다 단계가 달라 과업별로 봅니다 */
export function TaskChips({
  tasks,
  taskId,
  onChange,
}: {
  tasks: FunnelTaskCompare[];
  taskId: string;
  onChange: (taskId: string) => void;
}) {
  return (
    <>
      <span className="text-xs text-subtle">과업</span>
      <div role="radiogroup" aria-label="과업" className="flex flex-wrap gap-2">
        {tasks.map((item) => (
          <ChoiceChip
            key={item.task_id}
            kind="radio"
            selected={item.task_id === taskId}
            onClick={() => onChange(item.task_id)}
          >
            {item.name}
          </ChoiceChip>
        ))}
      </div>
    </>
  );
}

/*
  R06 실측 퍼널 · R07 기기별 · E09 표본 부족(수집 중).
  단계는 사전 테스트 실행 퍼널 단계이고, 매핑(R05)으로 연결된 실측 화면에 온 고유 세션을 셉니다.
  기간·과업은 화면 안 선택이라 상위(index)가 들고 있습니다.
*/
export default function FunnelView({
  projectId,
  funnel,
  task,
  period,
  device,
  onTaskChange,
  onPeriodChange,
  onDeviceChange,
}: {
  projectId: number;
  funnel: MeasurementFunnel;
  task: FunnelTaskCompare;
  period: FunnelDays;
  device: FunnelDevice;
  onTaskChange: (taskId: string) => void;
  onPeriodChange: (period: FunnelDays) => void;
  onDeviceChange: (device: FunnelDevice) => void;
}) {
  const byDevice = device !== "all";
  const mobile = useMeasurementFunnel(projectId, period, "mobile", byDevice);
  const desktop = useMeasurementFunnel(projectId, period, "desktop", byDevice);
  const mapped = task.stages.filter((stage) => stage.actual);
  const filled = mapped.filter((stage) => !stage.short_sample).length;

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
        <TaskChips tasks={funnel.tasks} taskId={task.task_id} onChange={onTaskChange} />
        <p className="ml-auto text-xs text-subtle">
          {byDevice
            ? "디바이스별로 나눠 보여줘요"
            : `${periodText(funnel)} · 방문 ${formatCount(task.base_sessions)}`}
        </p>
      </div>

      {task.collecting && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-lg bg-gray-50 p-3 text-caption font-bold text-ink"
        >
          <Icon name="more" className="size-5" />
          {mapped.length}단계 중 {filled}개만 표본을 채웠어요
        </p>
      )}

      {!byDevice ? (
        <section aria-labelledby="actual-funnel-title" className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <h2 id="actual-funnel-title" className="text-lg font-bold text-ink">
              실제 고객 데이터 단계별 이동
            </h2>
            <span className="text-xs text-muted">실제 고객 데이터 · 단일값</span>
          </div>
          <FunnelBars task={task} labelledBy="actual-funnel-title" sampleCheck={task.collecting} />
        </section>
      ) : (
        <div className="grid grid-cols-1 gap-12 md:grid-cols-2">
          {(
            [
              ["mobile", "모바일", mobile.data],
              ["desktop", "데스크톱", desktop.data],
            ] as const
          ).map(([key, label, data]) => {
            const id = `device-funnel-${key}`;
            const deviceTask = data?.tasks.find((item) => item.task_id === task.task_id);
            return (
              <section key={key} aria-labelledby={id} className="flex flex-col gap-2 p-4">
                <h2 id={id} className="font-bold text-ink">
                  {label} · {formatCount(deviceTask?.base_sessions ?? 0)}회 방문
                </h2>
                {deviceTask ? (
                  <FunnelBars task={deviceTask} labelledBy={id} compact />
                ) : (
                  <p className="text-caption text-subtle">불러오는 중이에요…</p>
                )}
              </section>
            );
          })}
        </div>
      )}
      <p className="text-xs text-muted">
        단계는 사전 테스트 실행 단계별 이동과 같아요 · 화면 너비 767px 이하는 모바일로 봐요
      </p>
    </div>
  );
}

/* 단계별 막대 — 첫 단계 대비 너비, 오른쪽에 세션 · 도달률 · 직전 단계 대비 이탈 */
function FunnelBars({
  task,
  labelledBy,
  sampleCheck = false,
  compact = false,
}: {
  task: FunnelTaskCompare;
  labelledBy: string;
  sampleCheck?: boolean;
  compact?: boolean;
}) {
  const mapped = task.stages.filter((stage) => stage.actual);
  return (
    <table aria-labelledby={labelledBy} className="w-full text-left">
      <tbody>
        {task.stages.map((stage) => {
          const actual = stage.actual;
          const reach = actual?.rate ?? 0;
          const before = mapped[mapped.indexOf(stage) - 1]?.actual;
          const drop =
            actual && before && before.sessions
              ? (1 - actual.sessions / before.sessions) * 100
              : null;
          const short = sampleCheck && stage.short_sample;
          return (
            <tr key={stage.id} className="border-b border-line last:border-b-0">
              <th
                scope="row"
                className={cn(
                  "py-1.5 pr-4 font-medium text-ink",
                  compact ? "w-24 text-xs" : "w-32 text-caption",
                )}
              >
                {stage.name}
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
                  short || !actual ? "text-muted" : "text-ink",
                )}
              >
                {!actual
                  ? "매핑 안 됨"
                  : compact
                    ? `${formatCount(actual.sessions)} · ${formatPct(reach)}`
                    : `${formatCount(actual.sessions)}회 방문 · ${formatPct(reach)}${
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
