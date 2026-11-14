import { Link } from "react-router-dom";

import { buttonVariants } from "@/components/Button/buttonVariants";
import Icon from "@/components/Icon/Icon";
import { buildPath } from "@/constants/routes";
import type { ProjectOverview, ProjectRecord } from "@/types/project.type";
import { cn } from "@/utils/cn";

export default function DiagnosisLoop({
  project,
  overview,
}: {
  project: ProjectRecord;
  overview: ProjectOverview;
}) {
  const current = overview.phase - 1;
  const stages = [
    {
      title: "사전 테스트",
      description: "테스트 실행 · 리포트 · 수정 후 재테스트",
      action: "사전 테스트 시작하기",
      route: "newTest",
    },
    {
      title: "실측 분석",
      description: "실측 수집 · 예측 vs 실측 · 원인 재현",
      action: "실측 데이터 연결하기",
      route: "analytics",
    },
    {
      title: "보정",
      description: "조정안 확인 · 적용 → 다음 사전 테스트",
      action: "조정안 확인",
      route: "calibration",
    },
  ] as const;
  return (
    <section className="space-y-5">
      <h2 className="text-lg font-bold">진단 루프</h2>
      <div className="grid gap-6 lg:grid-cols-3">
        {stages.map((stage, index) => (
          <div
            key={stage.title}
            className="space-y-4 lg:border-r lg:border-line lg:pr-6 lg:last:border-0"
          >
            <div className="flex gap-1">
              {Array.from({ length: index === 2 ? 1 : 3 }, (_, step) => (
                <span
                  key={step}
                  className={cn(
                    "h-1.5 flex-1 rounded-full bg-gray-200",
                    index < current && "bg-subtle",
                    index === current && step === 0 && "border border-ink bg-highlight",
                  )}
                />
              ))}
            </div>
            <div>
              <h3 className="flex items-center gap-2 text-sm font-bold">
                <span className="text-xs font-normal text-muted">0{index + 1}</span>
                {stage.title}
                {index === current && (
                  <span className="rounded bg-highlight px-2 py-1 text-xs font-medium">
                    지금 단계
                  </span>
                )}
              </h3>
              <p className="mt-2 text-xs text-subtle">{stage.description}</p>
            </div>
            {index < current ? (
              <p className="flex items-center gap-1 text-caption">
                <Icon name="status-done" />
                완료
              </p>
            ) : index === current ? (
              <Link
                className={buttonVariants({ variant: "outline" })}
                to={buildPath(stage.route, { projectId: project.id })}
              >
                {stage.action}
              </Link>
            ) : (
              <p className="text-xs text-muted">다음</p>
            )}
          </div>
        ))}
      </div>
      {overview.connection && (
        <p className="flex items-center gap-2 text-caption text-subtle">
          <Icon name="key" />
          로그인 연결 · 연결됨 · 시작 화면 {overview.connection.startPath} ·{" "}
          {overview.connection.expiresLabel} 만료 · 샘플 연결
        </p>
      )}
    </section>
  );
}
