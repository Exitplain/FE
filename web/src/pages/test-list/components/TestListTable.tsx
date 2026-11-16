import { Link } from "react-router-dom";

import StatusBadge from "@/components/StatusBadge/StatusBadge";
import { buildPath } from "@/constants/routes";

import type { TestRow, TestRowStatus } from "../utils/testRows";

/* Figma P01 상태 열: 준비 중(시계, 연회색) · 실행 중(재생, 굵게) · 완료(체크, 연회색) */
const STATUS_BADGE = {
  preparing: { icon: "status-wait", label: "준비 중", tone: "muted" },
  running: { icon: "play", label: "실행 중", tone: "strong" },
  done: { icon: "check", label: "완료", tone: "muted" },
  /* E05 로 끝난 실행 — 경고 아이콘, 굵게 */
  failed: { icon: "status-error", label: "실패", tone: "alert" },
  /* Figma 에 없음: 사용자가 멈춘 실행 — 닫기 아이콘, 연회색 */
  cancelled: { icon: "close", label: "취소됨", tone: "muted" },
} as const satisfies Record<TestRowStatus, object>;

type TestListTableProps = {
  projectId: string;
  rows: TestRow[];
  /* 표 이름이 될 제목의 id */
  labelledBy: string;
};

/*
  P01 사전 테스트 표. 테스트 이름이 링크입니다 (행 전체를 링크로 감싸면 표 의미가 깨져서):
  진행 중 → 실행 화면(P08~P10), 리포트가 있으면 → 리포트(P12), 끝났는데 리포트가 없으면 링크 없음.
  목표 달성률은 최신 리포트의 과업별 달성률이고, 없으면 "—" 입니다.
*/
export default function TestListTable({ projectId, rows, labelledBy }: TestListTableProps) {
  return (
    <table aria-labelledby={labelledBy} className="w-full text-left text-sm">
      <thead>
        <tr className="border-b border-line text-xs font-medium text-muted">
          <th className="py-4 font-medium">테스트 이름</th>
          <th className="w-32 py-4 font-medium">상태</th>
          <th className="w-48 py-4 font-medium">목표 달성률(예측 · 과업별)</th>
          <th className="w-24 py-4 font-medium">실행일</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const badge = STATUS_BADGE[row.status];

          return (
            <tr key={row.key} className="border-b border-line last:border-b-0">
              <td className="py-3">
                {row.link ? (
                  <Link
                    to={buildPath(row.link, { projectId, runId: row.key })}
                    className="font-medium text-ink hover:underline"
                  >
                    {row.name}
                  </Link>
                ) : (
                  /* 누를 수 없는 행은 링크와 구분되게 흐리게 둡니다 */
                  <span className="font-medium text-subtle">{row.name}</span>
                )}
              </td>
              <td className="py-3">
                <StatusBadge icon={badge.icon} label={badge.label} tone={badge.tone} />
              </td>
              <td className="py-3 text-gray-800">{row.completion}</td>
              <td className="py-3 text-gray-800">{row.date}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
