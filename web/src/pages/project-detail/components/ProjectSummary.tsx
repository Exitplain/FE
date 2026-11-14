import { Link } from "react-router-dom";

import RunStatus from "@/components/Workspace/RunStatus";
import { buildPath } from "@/constants/routes";
import type { ProjectOverview, ProjectRecord } from "@/types/project.type";

export default function ProjectSummary({
  project,
  overview,
}: {
  project: ProjectRecord;
  overview: ProjectOverview;
}) {
  const comparable = overview.analytics.status === "comparable";
  const proposal = overview.calibration.status === "proposal";
  const format = (value: number | null) => (value === null ? "—" : value.toLocaleString("ko-KR"));
  const groups = [
    {
      title: "최근 사전 테스트",
      status: overview.test.status ? <RunStatus status={overview.test.status} /> : "테스트 전",
      rows: [
        { label: "테스트", value: overview.test.title ?? "—" },
        {
          label: "목표 달성률 (예측)",
          value: overview.test.prediction ? `${overview.test.prediction.join("~")}%` : "—",
        },
        { label: "최대 이탈 구간", value: overview.test.maxDropOff ?? "—" },
        { label: "실행일", value: overview.test.dateLabel ?? "—" },
      ],
      link: "사전 테스트 보기",
      route: "testList",
    },
    {
      title: "실측 데이터",
      status: comparable
        ? "비교 가능"
        : overview.analytics.status === "collecting"
          ? "수집 중"
          : "미연결",
      rows: comparable
        ? [
            {
              label: "최근 7일 랜딩",
              value:
                overview.analytics.landingSessions === null
                  ? "—"
                  : `${format(overview.analytics.landingSessions)} 세션`,
            },
            {
              label: "완료 (실측)",
              value:
                overview.analytics.completedSessions === null ||
                overview.analytics.completionRate === null
                  ? "—"
                  : `${format(overview.analytics.completedSessions)} 세션 · ${overview.analytics.completionRate.toFixed(1)}%`,
            },
            { label: "최대 이탈 구간 (실측)", value: overview.analytics.maxDropOff ?? "—" },
          ]
        : [
            {
              label: "상태",
              value:
                overview.analytics.status === "collecting" ? "표본 수집 중" : "스크립트 미설치",
            },
            { label: "최근 퍼널", value: "—" },
          ],
      link: "실측 분석 보기",
      route: "analytics",
    },
    {
      title: "보정",
      status: proposal ? "조정안 있음" : "보정 전",
      rows: proposal
        ? [
            {
              label: "현재 예측 오차",
              value:
                overview.calibration.meanErrorPp === null
                  ? "—"
                  : `평균 ${overview.calibration.meanErrorPp}%p`,
            },
            {
              label: "조정안",
              value:
                overview.calibration.segments === null || overview.calibration.values === null
                  ? "—"
                  : `세그먼트 ${overview.calibration.segments}개 · ${overview.calibration.values}개 값`,
            },
          ]
        : [
            { label: "현재 예측 오차", value: "실측 연결 후 계산" },
            { label: "적용일", value: overview.calibration.appliedLabel ?? "—" },
          ],
      link: "보정 보기",
      route: "calibration",
    },
  ] as const;
  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">요약</h2>
        <p className="text-xs text-muted">예측 = 시뮬레이션 · 실측 = 실제 사용자 · 샘플 데이터</p>
      </header>
      <div className="grid gap-6 lg:grid-cols-3">
        {groups.map((group) => (
          <section
            key={group.title}
            className="project-summary-column flex flex-col gap-6 lg:border-r lg:border-line lg:pr-6 lg:last:border-0"
          >
            <header className="flex items-center justify-between gap-3">
              <h3 className="text-base font-medium">{group.title}</h3>
              <span className="text-caption text-subtle">{group.status}</span>
            </header>
            <dl className="space-y-4">
              {group.rows.map((row) => (
                <div key={row.label} className="flex flex-wrap justify-between gap-2 text-caption">
                  <dt className="text-muted">{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
            <Link
              className="mt-auto self-end text-sm font-medium underline"
              to={buildPath(group.route, { projectId: project.id })}
            >
              {group.link}
            </Link>
          </section>
        ))}
      </div>
    </section>
  );
}
