import { Bar, BarChart, Rectangle, ResponsiveContainer, XAxis, YAxis } from "recharts";

import type { Range } from "@/types/persona.type";
import { cn } from "@/utils/cn";

export type RangeBarDatum = {
  key: string;
  /* 왼쪽 단계 이름 (예: "장바구니") */
  label: string;
  /* 단일값(실측) 또는 [최소, 최대] 범위(예측) */
  value: number | Range;
  /* 오른쪽 수치 문구 (예: "11~13명 · 이탈 2~4", "546 세션 · 44.0%") */
  valueLabel: string;
  /* 표본 부족처럼 흐리게 보여줄 행 (E09) */
  muted?: boolean;
};

type RangeBarChartProps = {
  /* 차트 이름. 화면에는 보이지 않고 표(스크린 리더) 제목으로 씁니다 */
  title: string;
  data: RangeBarDatum[];
  /* 막대 100% 기준값 (예: 랜딩 인원) */
  max: number;
  /* 행 높이 · 막대 두께 · 왼쪽 이름 칸 · 오른쪽 수치 칸 (px) */
  rowHeight?: number;
  barSize?: number;
  labelWidth?: number;
  valueWidth?: number;
  className?: string;
};

type Row = RangeBarDatum & { base: number; extra: number };

/* 막대 색: 진한 부분 = 범위 하한(또는 단일값), 연한 부분 = 범위 폭 */
const BASE_CLASS = "fill-gray-700";
const EXTRA_CLASS = "fill-gray-300";
const MUTED_CLASS = "fill-gray-300";
const TRACK_CLASS = "fill-gray-100";

type TickProps = { x?: number | string; y?: number | string; payload?: { value: string } };

/*
  가로 막대 차트 (recharts) — P12 예측 퍼널·이탈 원인, R06 실측 퍼널, R08·P18 비교, P21 공유 리포트.
  - 예측은 범위라 [최소, 최대] 를 두 겹(진한 하한 + 연한 폭)으로 그립니다. 실측은 단일값 한 겹입니다.
  - 그림은 aria-hidden 이고, 같은 내용을 화면에 보이지 않는 표로 함께 둡니다(스크린 리더·테스트).
  - 색은 SVG 에도 토큰 클래스(fill-*)를 씁니다.

  사용 예
    <RangeBarChart title="예측 퍼널" max={20}
      data={[{ key: "landing", label: "랜딩", value: [20, 20], valueLabel: "20명 (100%)" }]} />
*/
export default function RangeBarChart({
  title,
  data,
  max,
  rowHeight = 44,
  barSize = 8,
  labelWidth = 96,
  valueWidth = 160,
  className,
}: RangeBarChartProps) {
  const rows: Row[] = data.map((datum) => {
    const [min, top] = Array.isArray(datum.value) ? datum.value : [datum.value, datum.value];
    return { ...datum, base: min, extra: Math.max(0, top - min) };
  });
  const height = rows.length * rowHeight;
  /* 두 축 모두 겹치지 않는 key 로 행을 찾습니다 (같은 이름의 단계가 있어도 행이 합쳐지지 않게) */
  const rowOf = (tick: TickProps) => rows.find((row) => row.key === tick.payload?.value);

  /* 왼쪽 이름은 칸의 왼쪽 끝, 오른쪽 수치는 칸의 오른쪽 끝에 맞춥니다 */
  const renderLabel = (tick: TickProps) => (
    <text
      x={Number(tick.x ?? 0) - labelWidth}
      y={tick.y}
      dy={4}
      textAnchor="start"
      className="fill-gray-800 text-caption"
    >
      {rowOf(tick)?.label}
    </text>
  );
  const renderValue = (tick: TickProps) => (
    <text
      x={Number(tick.x ?? 0) + valueWidth}
      y={tick.y}
      dy={4}
      textAnchor="end"
      className="fill-subtle text-xs"
    >
      {rowOf(tick)?.valueLabel}
    </text>
  );

  return (
    <figure className={cn("w-full", className)}>
      <div aria-hidden className="w-full" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 640, height }}>
          <BarChart
            layout="vertical"
            data={rows}
            margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
            barCategoryGap={0}
          >
            <XAxis type="number" domain={[0, Math.max(max, 1)]} hide />
            <YAxis
              yAxisId="label"
              type="category"
              dataKey="key"
              width={labelWidth}
              axisLine={false}
              tickLine={false}
              tick={renderLabel}
              interval={0}
            />
            <YAxis
              yAxisId="value"
              orientation="right"
              type="category"
              dataKey="key"
              width={valueWidth}
              axisLine={false}
              tickLine={false}
              tick={renderValue}
              interval={0}
            />
            <Bar
              yAxisId="label"
              dataKey="base"
              stackId="range"
              barSize={barSize}
              isAnimationActive={false}
              background={{ className: TRACK_CLASS }}
              shape={(props) => (
                <Rectangle
                  {...props}
                  className={(props.payload as Row).muted ? MUTED_CLASS : BASE_CLASS}
                />
              )}
            />
            <Bar
              yAxisId="label"
              dataKey="extra"
              stackId="range"
              barSize={barSize}
              isAnimationActive={false}
              shape={(props) => <Rectangle {...props} className={EXTRA_CLASS} />}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <th scope="row">{row.label}</th>
              <td>{row.valueLabel}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
