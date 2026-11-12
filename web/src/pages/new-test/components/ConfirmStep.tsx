import { Link } from "react-router-dom";

import Button from "@/components/Button/Button";
import Icon from "@/components/Icon/Icon";
import { buildPath } from "@/constants/routes";
import { useNewTestStore } from "@/stores/useNewTestStore";
import type { ApiError } from "@/types/api.type";
import type { DiscoverResponse } from "@/types/persona.type";

import { isPlanExpired, type StepKey } from "../utils/newTest";
import { RUN_CONDITIONS } from "./PersonaStep";
import StepSection, { StatusRow, StepFooter } from "./StepSection";

type ConfirmStepProps = {
  projectId: string;
  plan: DiscoverResponse;
  profileCount: number;
  isStarting: boolean;
  error: ApiError | null;
  /* 409 일 때 이동할 현재 실행 */
  currentRunId: string | null;
  onPrev: () => void;
  onStart: () => void;
  onExpired: () => void;
};

/*
  P05c 시작 전 확인 — 단계별 "변경" 링크, 최종 확인 후에만 실행.
  BE confirm 은 페르소나 생성과 실행 시작을 나누지 않아 버튼은 "실행 시작" 하나입니다
  (Figma 의 P06 생성 중 · P07 페르소나 확인 단계 없이 바로 실행 화면으로 갑니다).
*/
export default function ConfirmStep({
  projectId,
  plan,
  profileCount,
  isStarting,
  error,
  currentRunId,
  onPrev,
  onStart,
  onExpired,
}: ConfirmStepProps) {
  const store = useNewTestStore();
  const expired = store.discoveredAt != null && isPlanExpired(store.discoveredAt);
  const tasks = plan.tasks.filter((task) => store.taskIds.includes(task.id));
  const ageLabels = store.ages.map((age) =>
    age === "any" ? "전체" : (plan.age_options[age] ?? age),
  );

  const rows: { label: string; value: string; step?: StepKey }[] = [
    {
      label: "제품 URL",
      value: `${store.siteUrl} · ${store.variant === "problem" ? "문제 버전" : "개선 버전"} · 접근 가능`,
      step: "site",
    },
    {
      label: "로그인",
      value:
        store.loginMode === "account" && store.accounts.length > 0
          ? `테스트 계정 ${store.accounts.length}개 (저장만, 실행에는 쓰지 않음)`
          : "로그인 없이 테스트",
      step: "site",
    },
    {
      label: "과업",
      value: `${tasks.map((task) => task.name).join(" · ")} (${tasks.length}개)`,
      step: "task",
    },
    {
      label: "타겟 고객",
      value: `${store.targetDescription.trim()} · ${ageLabels.join(", ")}(문맥)`,
      step: "task",
    },
    {
      label: "추가 메모",
      value: store.memo.trim() ? `${store.memo.trim()} (실행 행동에 포함 안 됨)` : "없음",
      step: "task",
    },
    ...(store.customTasks.length > 0
      ? [
          {
            label: "직접 추가한 과업",
            value: `${store.customTasks.join(" · ")} (실행에 포함 안 됨)`,
            step: "task" as const,
          },
        ]
      : []),
    {
      label: "페르소나",
      value: `프로필 ${profileCount}개 × 과업 ${tasks.length}개 = 세션 ${profileCount * tasks.length}개`,
      step: "persona",
    },
    { label: "실행 조건", value: RUN_CONDITIONS },
  ];

  return (
    <div className="flex flex-col gap-12">
      <StepSection title="시작 전 확인" description="실행을 시작하기 전에 입력을 한 번 더 확인해요">
        <ul aria-label="입력 요약" className="flex flex-col">
          {rows.map((row) => (
            <li key={row.label} className="flex items-start gap-6 border-b border-line py-4">
              <span className="w-32 shrink-0 text-caption text-muted">{row.label}</span>
              <span className="flex-1 text-sm text-ink">{row.value}</span>
              {row.step && (
                <Link
                  to={{ search: `?step=${row.step}` }}
                  className="shrink-0 text-caption text-subtle underline underline-offset-4"
                  aria-label={`${row.label} 변경`}
                >
                  변경 · {row.step === "site" ? 1 : row.step === "task" ? 2 : 3}단계
                </Link>
              )}
            </li>
          ))}
        </ul>
      </StepSection>

      {expired && (
        <div
          role="alert"
          className="flex items-center justify-between gap-4 rounded-lg bg-gray-50 p-3"
        >
          <p className="flex items-center gap-2 text-caption font-bold text-ink">
            <Icon name="status-wait" className="size-5" />
            사이트를 확인한 지 15분이 지나 다시 확인해야 해요
          </p>
          <Button variant="secondary" onClick={onExpired}>
            사이트 다시 확인
          </Button>
        </div>
      )}

      {error && error.status === 409 && (
        <StatusRow>
          <Icon name="status-running" className="size-5" />
          <span className="font-bold text-ink">이미 실행 중인 테스트가 있어요</span>
          {currentRunId && (
            <Link
              to={buildPath("testRun", { projectId, runId: currentRunId })}
              className="text-subtle underline underline-offset-4"
            >
              실행 화면 보기
            </Link>
          )}
        </StatusRow>
      )}
      {error && error.status !== 409 && error.status !== 400 && (
        <p role="alert" className="flex items-center gap-2 text-caption">
          <Icon name="status-error" className="size-5 text-danger" />
          <span className="font-bold text-ink">실행을 시작하지 못했어요</span>
          <span className="text-subtle">
            {error.status === 0 ? "서버에 연결할 수 없어요" : error.message} · 잠시 후 다시 시도해
            주세요
          </span>
        </p>
      )}

      <StepFooter>
        <Button variant="link" onClick={onPrev}>
          이전
        </Button>
        <Button disabled={expired || isStarting} onClick={onStart}>
          {isStarting ? "시작하는 중…" : "실행 시작"}
        </Button>
      </StepFooter>
    </div>
  );
}
