import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/*
  꺾은선 추이 (보정 오차 추이 · 사람 관측 일치율 추이).
  - 그림은 aria-hidden 이고, 같은 내용을 화면에 보이지 않는 표로 함께 둡니다 (RangeBarChart 와 같은 방식).
  - 값이 없는 점(null)은 선을 끊지 않고 건너뜁니다 (connectNulls).
*/
export type TrendSeries = {
  key: string;
  label: string;
  /* 선 색 (CSS 색 문자열). 기본은 진한 회색 */
  color?: string;
  dashed?: boolean;
};

export type TrendPoint = { x: string } & Record<string, number | string | null>;

export default function TrendLineChart({
  title,
  data,
  series,
  unit = "",
  domain,
  height = 200,
}: {
  title: string;
  data: TrendPoint[];
  series: TrendSeries[];
  unit?: string;
  domain?: [number, number];
  height?: number;
}) {
  const format = (value: unknown) =>
    typeof value === "number"
      ? `${Number.isInteger(value) ? value : value.toFixed(1)}${unit}`
      : "—";
  return (
    <figure className="flex flex-col gap-2">
      <div aria-hidden className="w-full" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 640, height }}>
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="#e5e5e5" vertical={false} />
            <XAxis dataKey="x" tick={{ fontSize: 12, fill: "#737373" }} tickLine={false} />
            <YAxis
              width={44}
              domain={domain ?? ["auto", "auto"]}
              tick={{ fontSize: 12, fill: "#737373" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value: number) => `${value}${unit}`}
            />
            <Tooltip formatter={(value) => format(value)} />
            {series.map((item) => (
              <Line
                key={item.key}
                type="monotone"
                dataKey={item.key}
                name={item.label}
                stroke={item.color ?? "#262626"}
                strokeWidth={2}
                strokeDasharray={item.dashed ? "4 4" : undefined}
                dot={{ r: 3 }}
                connectNulls
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="flex flex-wrap gap-4 text-xs text-subtle">
        {series.map((item) => (
          <span key={item.key} className="flex items-center gap-1">
            <span
              aria-hidden
              className="inline-block h-0.5 w-5"
              style={{
                background: item.dashed ? "transparent" : (item.color ?? "#262626"),
                borderTop: item.dashed ? `2px dashed ${item.color ?? "#262626"}` : undefined,
              }}
            />
            {item.label}
          </span>
        ))}
      </figcaption>
      <table aria-label={title} className="sr-only">
        <thead>
          <tr>
            <th scope="col">구간</th>
            {series.map((item) => (
              <th key={item.key} scope="col">
                {item.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((point) => (
            <tr key={point.x}>
              <th scope="row">{point.x}</th>
              {series.map((item) => (
                <td key={item.key}>{format(point[item.key])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
