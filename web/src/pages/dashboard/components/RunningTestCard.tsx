import { Link } from "react-router-dom";

import Icon from "@/components/Icon/Icon";
import type { IconName } from "@/components/Icon/iconNames";
import { buildPath } from "@/constants/routes";
import type { WorkspaceSnapshot } from "@/types/workspace.type";
import { cn } from "@/utils/cn";

type ActiveRun = WorkspaceSnapshot["activeRun"];

/*
  Figma W01 "지금 실행 중" 카드 (320 · 모서리 16).
  머리: 남색 #0f1c4b · 제목 18px Bold · "실시간 보기" 14px Medium · 프로젝트·차수 16px Medium
  본문: "세션 n / N 종료" 13px Medium · 진행 막대(완료 · 이탈 · 오류 · 진행 중 · 대기) · 상태별 14px
  실행 중인 테스트가 없으면 같은 카드에 안내와 새 테스트 시작을 둡니다 (Figma 에 없는 상태).
*/
export default function RunningTestCard({
  run,
  onStart,
  partial = false,
}: {
  run: ActiveRun | null;
  onStart: () => void;
  /* 일부 프로젝트의 실행 목록을 못 받았으면 실행 중인 테스트가 없다고 단정하지 않습니다 */
  partial?: boolean;
}) {
  return (
    <section
      aria-labelledby="running-test-title"
      className="overflow-hidden rounded-2xl bg-surface shadow-[0_4px_4px_rgb(0_0_0/0.25)]"
    >
      <header className="workspace-running-heading flex flex-col gap-4 px-4 pt-8 pb-6">
        <div className="flex items-center justify-between gap-3">
          <h2 id="running-test-title" className="text-lg leading-[26px] font-bold">
            지금 실행 중
          </h2>
          {run && (
            <Link
              className="text-sm leading-5 font-medium hover:underline"
              to={buildPath("testRun", { projectId: run.projectId, runId: run.id })}
            >
              실시간 보기
            </Link>
          )}
        </div>
        <p className="text-base leading-6 font-medium">
          {run ? (
            <>
              {run.name}
              {run.seed && ` (${run.seed})`}
            </>
          ) : partial ? (
            "실행 상태를 모두 확인하지 못했어요"
          ) : (
            "실행 중인 테스트가 없어요"
          )}
        </p>
      </header>
      {run ? (
        <RunningBody run={run} />
      ) : (
        <div className="flex flex-col items-start gap-3 px-4 pt-5 pb-7">
          <p className="text-sm leading-5 text-gray-800">
            {partial
              ? "일부 프로젝트의 기록을 불러오지 못했어요. 진행 중인 테스트가 있을 수 있어요"
              : "테스트를 시작하면 방문 진행 상황을 여기서 볼 수 있어요"}
          </p>
          <button
            type="button"
            onClick={onStart}
            className="text-sm font-medium text-ink underline underline-offset-4"
          >
            새 테스트 시작하기
          </button>
        </div>
      )}
    </section>
  );
}

function RunningBody({ run }: { run: ActiveRun }) {
  /* 세션 수를 아직 모르면(0) 막대를 비워 둡니다 */
  const share = (value: number) => `${run.total ? (value / run.total) * 100 : 0}%`;
  /* Figma 진행 막대 순서·색: 완료(진회색) · 이탈 · 오류(빨강) · 진행 중(회색) · 대기(연회색) */
  const segments = [
    { value: run.completed, className: "bg-gray-800" },
    { value: run.exited, className: "bg-danger" },
    { value: run.errors, className: "bg-danger" },
    { value: run.running, className: "bg-muted" },
    { value: run.queued, className: "bg-gray-300" },
  ];
  const counts: { label: string; value: number; icon: IconName; danger?: boolean }[] = [
    { label: "진행 중", value: run.running, icon: "status-running" },
    { label: "대기", value: run.queued, icon: "status-wait" },
    { label: "완료", value: run.completed, icon: "status-done" },
    { label: "이탈", value: run.exited, icon: "status-exit", danger: true },
    { label: "오류", value: run.errors, icon: "status-error", danger: true },
  ];
  return (
    <div className="flex flex-col gap-5 px-4 pt-8 pb-7">
      <div className="flex flex-col gap-3">
        <p className="text-caption font-medium text-gray-800">
          {run.total
            ? `방문 ${run.completed + run.exited + run.errors} / ${run.total} 종료`
            : "방문 진행 상황을 불러오는 중이에요"}
        </p>
        <div
          className="flex h-[7px] overflow-hidden rounded-[4px] bg-gray-200"
          aria-label="방문 결과 분포"
        >
          {segments.map((segment, index) => (
            <span
              key={index}
              className={segment.className}
              style={{ width: share(segment.value) }}
            />
          ))}
        </div>
      </div>
      <dl className="flex flex-col gap-3">
        {counts.map((item) => (
          <div key={item.label} className="flex items-center justify-between">
            <dt className="flex items-center gap-2 text-sm text-gray-800">
              <Icon name={item.icon} className={cn("size-3.5", item.danger && "text-danger")} />
              {item.label}
            </dt>
            <dd className="text-sm font-medium text-ink">{item.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
