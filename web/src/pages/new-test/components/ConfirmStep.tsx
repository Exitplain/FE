import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";

import Button from "@/components/Button/Button";
import Icon from "@/components/Icon/Icon";
import { useNewTestStore } from "@/stores/useNewTestStore";
import type { DiscoverResponse } from "@/types/persona.type";

import {
  ageSummary,
  isPlanExpired,
  panelSize,
  PLAN_TTL_MS,
  RUN_CONDITIONS,
  type StepKey,
  STEPS,
} from "../utils/newTest";
import { StepFooter } from "./StepSection";

type ConfirmStepProps = {
  plan: DiscoverResponse;
  /* 적용된 보정 날짜 ("11월 5일"). 보정 전이면 null, 불러오는 중이면 undefined */
  calibratedLabel: string | null | undefined;
  onPrev: () => void;
  /* "페르소나 생성" → P06 생성 중 · P07 확인 */
  onNext: () => void;
  onExpired: () => void;
};

/*
  P05c 시작 전 확인 (Figma Section/CheckAnswers) — 단계별 "변경 · n단계", 마지막에 "페르소나 생성".
  "페르소나 생성"은 P06 생성 중으로 넘어가고, 실행 시작은 P07 페르소나 확인에서 합니다.
*/
export default function ConfirmStep({
  plan,
  calibratedLabel,
  onPrev,
  onNext,
  onExpired,
}: ConfirmStepProps) {
  const store = useNewTestStore(
    useShallow((state) => ({
      discoveredAt: state.discoveredAt,
      taskIds: state.taskIds,
      ages: state.ages,
      siteUrl: state.siteUrl,
      variant: state.variant,
      loginMode: state.loginMode,
      accounts: state.accounts,
      targetDescription: state.targetDescription,
      memo: state.memo,
      customTasks: state.customTasks,
    })),
  );

  /* 이 화면에 머무는 동안 15분이 지나면 다시 그려 만료 안내를 띄웁니다 */
  const [, setTick] = useState(0);
  useEffect(() => {
    if (store.discoveredAt == null) return;
    const remaining = store.discoveredAt + PLAN_TTL_MS - Date.now();
    if (remaining <= 0) return;
    /* 타이머가 조금 일찍 울려 아직 만료 전으로 판정되지 않게 여유를 둡니다 */
    const timer = window.setTimeout(() => setTick((tick) => tick + 1), remaining + 100);
    return () => window.clearTimeout(timer);
  }, [store.discoveredAt]);

  const expired = store.discoveredAt != null && isPlanExpired(store.discoveredAt);
  const tasks = plan.tasks.filter((task) => store.taskIds.includes(task.id));
  const panel = panelSize(store.loginMode, store.accounts.length);
  const stages = Math.max(0, ...tasks.map((task) => task.funnel_stages ?? 0));

  const rows: { label: string; value: string; step?: StepKey }[] = [
    { label: "제품 URL", value: `${store.siteUrl} · 접근 가능`, step: "site" },
    {
      label: "로그인",
      value:
        store.loginMode === "account" && store.accounts.length > 0
          ? `테스트 계정 ${store.accounts.length}개 · 에이전트 ${panel}명`
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
      value: `${store.targetDescription.trim()} · ${ageSummary(store.ages, plan.age_options)}(문맥)`,
      step: "task",
    },
    {
      label: "추가 메모",
      value: store.memo.trim() ? `${store.memo.trim()} (실행에 자동 포함 안 됨)` : "없음",
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
      label: "퍼널 단계",
      /* 사이트 분석으로 정해져 사용자가 바꾸는 값이 아니라 변경 링크가 없습니다 */
      value: `사이트 분석으로 자동 결정${stages > 0 ? ` · 과업별 ${stages}단계` : ""}`,
    },
    {
      label: "페르소나",
      value: `에이전트 ${panel}명 · 과업 ${tasks.length}개 · ${calibratedLabel ? `보정 ${calibratedLabel}` : calibratedLabel === null ? "보정 전" : "보정 확인 중"}`,
      step: "persona",
    },
    { label: "실행 조건", value: RUN_CONDITIONS, step: "persona" },
  ];

  return (
    <div className="flex flex-col gap-12">
      <section aria-labelledby="confirm-title" className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="confirm-title" className="text-lg font-bold text-ink">
            시작 전 확인
          </h2>
          <p className="text-xs text-muted">페르소나를 만들기 전에 입력을 한 번 더 확인해요</p>
        </div>
        <ul aria-label="입력 요약" className="flex flex-col">
          {rows.map((row) => (
            <li key={row.label} className="flex items-start gap-6 border-b border-line py-3.5">
              <span className="w-24 shrink-0 text-caption text-muted">{row.label}</span>
              <span className="flex-1 text-caption text-gray-800">{row.value}</span>
              {row.step && (
                <Link
                  to={{ search: `?step=${row.step}` }}
                  className="shrink-0 text-caption font-bold text-ink hover:underline"
                  aria-label={`${row.label} 변경`}
                >
                  변경 · {STEPS.indexOf(row.step) + 1}단계
                </Link>
              )}
            </li>
          ))}
        </ul>
      </section>

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

      <StepFooter>
        <Button variant="link" onClick={onPrev}>
          이전
        </Button>
        <Button disabled={expired || tasks.length === 0} onClick={onNext}>
          페르소나 생성
        </Button>
      </StepFooter>
    </div>
  );
}
