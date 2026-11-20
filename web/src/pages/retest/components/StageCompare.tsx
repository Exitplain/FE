import { formatRange } from "@/pages/report/utils/reportView";
import { cn } from "@/utils/cn";

import { formatDiff, midpoint, type StageRow } from "../utils/compareView";

/*
  Figma P18 "단계별 도달 (A → B)" — 한 줄에 A(회색 얇은 막대)와 B(진한 막대)를 겹쳐 그리고
  A · B 범위와 차이를 붙입니다. 막대 길이는 범위 가운데값이라 style 로 둡니다.
*/
export default function StageCompare({ rows }: { rows: StageRow[] }) {
  return (
    <section aria-labelledby="stage-compare-title" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 id="stage-compare-title" className="text-lg font-bold text-ink">
          단계별 도달 (A → B)
        </h2>
        <p className="text-xs text-muted">A 회색 · B 진한색</p>
      </div>
      <table aria-labelledby="stage-compare-title" className="w-full text-left text-caption">
        <thead>
          <tr className="border-b border-line text-xs text-muted">
            <th scope="col" className="py-2 font-normal">
              단계
            </th>
            <th scope="col" className="w-2/5 py-2 font-normal">
              <span className="sr-only">막대</span>
            </th>
            <th scope="col" className="py-2 pl-4 font-normal">
              A
            </th>
            <th scope="col" className="py-2 font-normal">
              B
            </th>
            <th scope="col" className="py-2 text-right font-normal">
              차이
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.stage}>
              <th scope="row" className="py-3 font-normal text-ink">
                {row.label}
              </th>
              <td aria-hidden className="py-3">
                <span className="flex flex-col gap-1">
                  <span className="h-1.5 rounded-full bg-gray-100">
                    <span
                      className="block h-full rounded-full bg-gray-300"
                      style={{ width: `${row.a ? midpoint(row.a) : 0}%` }}
                    />
                  </span>
                  <span className="h-1.5 rounded-full bg-gray-100">
                    <span
                      className="block h-full rounded-full bg-ink"
                      style={{ width: `${row.b ? midpoint(row.b) : 0}%` }}
                    />
                  </span>
                </span>
              </td>
              <td className="py-3 pl-4 text-subtle">{row.a ? formatRange(row.a, "%") : "—"}</td>
              <td className="py-3 font-bold text-ink">{row.b ? formatRange(row.b, "%") : "—"}</td>
              <td className={cn("py-3 text-right", row.diff ? "font-bold text-ink" : "text-muted")}>
                {row.diff == null ? "—" : formatDiff(row.diff, "%p")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
