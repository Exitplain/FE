import Icon from "@/components/Icon/Icon";
import { cn } from "@/utils/cn";

import { type CauseRow, formatDiff } from "../utils/compareView";

/*
  Figma P18 "원인 분포 변화" — 원인별 이탈 비율 A · B · 변화.
  같은 패널·시드로 재테스트한 결과가 아니면(comparable=false) 표 대신 안내만 둡니다.
*/
export default function CauseCompare({
  rows,
  comparable,
}: {
  rows: CauseRow[];
  comparable: boolean;
}) {
  return (
    <section aria-labelledby="cause-compare-title" className="flex flex-col gap-3">
      <h2 id="cause-compare-title" className="text-lg font-bold text-ink">
        원인 분포 변화
      </h2>
      {comparable && rows.length > 0 && (
        <table aria-labelledby="cause-compare-title" className="w-full text-left text-caption">
          <thead>
            <tr className="border-b border-line text-xs text-muted">
              <th scope="col" className="py-2 font-normal">
                원인
              </th>
              <th scope="col" className="py-2 font-normal">
                A
              </th>
              <th scope="col" className="py-2 font-normal">
                B
              </th>
              <th scope="col" className="py-2 text-right font-normal">
                변화
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.cause}>
                <th scope="row" className="py-3 font-normal text-ink">
                  {row.label}
                </th>
                <td className="py-3 text-subtle">{row.a}%</td>
                <td className="py-3 font-bold text-ink">{row.b}%</td>
                <td
                  className={cn("py-3 text-right", row.diff ? "font-bold text-ink" : "text-muted")}
                >
                  {formatDiff(row.diff, "%p")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {comparable && rows.length === 0 && (
        <p className="text-caption text-subtle">두 실행 모두 이 과업에서 이탈한 방문이 없어요</p>
      )}
      <p className="flex items-center gap-2 text-xs text-subtle">
        <Icon name="info" className="size-5" />
        {comparable
          ? "같은 패널·반복으로 재테스트한 결과만 원인 비교에 써요"
          : "패널 인원이나 반복 수가 달라 원인 분포는 비교하지 않아요"}
      </p>
    </section>
  );
}
