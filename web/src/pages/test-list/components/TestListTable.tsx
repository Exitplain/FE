import { Link } from "react-router-dom";

import StatusBadge from "@/components/StatusBadge/StatusBadge";
import { buildPath } from "@/constants/routes";

import type { TestRow, TestRowStatus } from "../utils/testRows";

/* Figma P01 상태 열: 준비 중(시계, 연회색) · 실행 중(재생, 굵게) · 완료(체크, 연회색) */
const STATUS_BADGE = {
  preparing: { icon: "status-wait", label: "준비 중", tone: "muted" },
  running: { icon: "play", label: "실행 중", tone: "strong" },
  done: { icon: "check", label: "완료", tone: "muted" },
} as const satisfies Record<TestRowStatus, object>;

type TestListTableProps = {
  projectId: string;
  rows: TestRow[];
};

/*
  P01 사전 테스트 표. 행 전체가 링크입니다:
  진행 중 → 실행 화면(P08~P10), 완료 → 리포트(P12).
  목표 달성률은 목록 API 에 없어 "—" 로 둡니다 (리포트에서 계산).
*/
export default function TestListTable({ projectId, rows }: TestListTableProps) {
  return (
    <table aria-labelledby="test-list-title" className="w-full text-left text-sm">
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
          const href =
            row.status === "done"
              ? buildPath("report", { projectId, runId: row.key })
              : buildPath("testRun", { projectId, runId: row.key });
          const badge = STATUS_BADGE[row.status];

          return (
            <tr key={row.key} className="border-b border-line last:border-b-0">
              <td className="py-3">
                <Link to={href} className="font-medium text-ink hover:underline">
                  {row.name}
                </Link>
              </td>
              <td className="py-3">
                <StatusBadge icon={badge.icon} label={badge.label} tone={badge.tone} />
              </td>
              <td className="py-3 text-gray-800">—</td>
              <td className="py-3 text-gray-800">{row.date}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
