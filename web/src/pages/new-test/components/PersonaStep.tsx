import { useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import Button from "@/components/Button/Button";
import SegmentedTabs from "@/components/SegmentedTabs/SegmentedTabs";
import Icon from "@/components/Icon/Icon";
import { useNewTestStore } from "@/stores/useNewTestStore";
import type { SegmentProfile } from "@/types/plan.type";
import { cn } from "@/utils/cn";

import { useInferSegments } from "../hooks/useNewTestMutations";

import {
  ACCOUNT_MAX,
  agentRange,
  inRange,
  needsSegmentInference,
  RUN_CONDITION_DETAILS,
  runConditions,
  SEED_DEFAULT,
  SEED_MAX,
  segmentTotalMessage,
  sum,
  VIEWPORTS,
} from "../utils/newTest";
import { StepFooter } from "./StepSection";

type PersonaStepProps = {
  /* 적용된 보정 날짜 ("11월 5일"). 보정 전이면 null, 아직 불러오는 중이면 undefined */
  calibratedLabel: string | null | undefined;
  onPrev: () => void;
  onNext: () => void;
  /* 다음 단계로 가기 전에 계획을 저장하는 중 (PATCH) */
  saving?: boolean;
};

/* Figma Stepper — 연회색 pill(너비 136) 안 − 인원 + (시드 횟수에도 씁니다) */
function SegmentStepper({
  label,
  value,
  min = 1,
  max,
  unit = "명",
  valueName = "인원",
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max: number;
  unit?: string;
  valueName?: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex w-34 items-center justify-between rounded-full bg-gray-50 px-4 py-2">
      <button
        type="button"
        aria-label={`${label} 1${unit} 줄이기`}
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
        className="rounded text-ink focus-visible:outline-2 focus-visible:outline-ink disabled:text-gray-400"
      >
        <Icon name="minus" />
      </button>
      <output aria-label={`${label} ${valueName}`} className="text-sm font-medium text-ink">
        {value}
        {unit}
      </output>
      <button
        type="button"
        aria-label={`${label} 1${unit} 늘리기`}
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
        className="rounded text-ink focus-visible:outline-2 focus-visible:outline-ink disabled:text-gray-400"
      >
        <Icon name="plus" />
      </button>
    </div>
  );
}

/* 능력치 한 줄 (높을수록: 인내심 길게 버팀 · 숙련도 익숙함 · 가격 민감 · 신뢰 요구 큼) */
function traitLine(variables: NonNullable<SegmentProfile["variables"]>) {
  return `인내심 ${variables.patience} · 숙련도 ${variables.digital_literacy} · 가격 민감 ${variables.price_sensitivity} · 신뢰 요구 ${variables.trust_need}`;
}

/*
  P05b 세그먼트 비율 (+ P05e 합계 오류, P05h 테스트 계정 8개) — Figma Wizard/Body (너비 704)
  - 에이전트(기본 10명, 4~20명 · 로그인 테스트는 계정 수만큼)를 세그먼트 4개에 나눕니다.
    합계가 서버 범위 안이어야 다음으로 갑니다.
  - 실행 조건에서 시드 횟수(기본 1회, 1~3회)를 고릅니다.
  - "다음"에서 세그먼트 인원과 바뀐 시드를 계획에 저장합니다 (PATCH segments · limits).
    서버는 세그먼트마다 1명 이상을 받습니다.
  - 세그먼트 유형(이름·상황·능력치)은 이 단계에 들어오면 서비스 설명으로 한 번 추론합니다 (segment-inferences).
    인원을 바꿔도 다시 추론하지 않고, 같은 유형 안에서 사람마다 능력치를 조금씩 다르게 만듭니다(서버).
    추론에 실패해도 다음으로 갈 수 있고, 시작 전 확인에서 페르소나를 만들 때 정합니다.
*/
export default function PersonaStep({
  calibratedLabel,
  onPrev,
  onNext,
  saving = false,
}: PersonaStepProps) {
  const {
    plan,
    segmentCounts,
    seedCount,
    viewportWidth,
    loginMode,
    accountCount,
    setSegmentCount,
    setSeedCount,
    setViewportWidth,
  } = useNewTestStore(
    useShallow((state) => ({
      plan: state.plan,
      segmentCounts: state.segmentCounts,
      seedCount: state.seedCount,
      viewportWidth: state.viewportWidth,
      setViewportWidth: state.setViewportWidth,
      loginMode: state.loginMode,
      accountCount: state.accounts.length,
      setSegmentCount: state.setSegmentCount,
      setSeedCount: state.setSeedCount,
    })),
  );
  const [showDetails, setShowDetails] = useState(false);
  const infer = useInferSegments();
  const needsInference = needsSegmentInference(plan);
  /* 계획마다 자동 추론은 한 번만 (실패하면 "다시 시도" 버튼으로) */
  const triedFor = useRef<string | null>(null);
  const planId = plan?.planId ?? null;
  const { mutate: inferNow } = infer;
  useEffect(() => {
    if (!planId || !needsInference || triedFor.current === planId) return;
    triedFor.current = planId;
    inferNow();
  }, [planId, needsInference, inferNow]);
  const profiles = plan?.segmentProfiles ?? [];
  const inferring = infer.isPending;
  const range = agentRange(plan, loginMode, accountCount);
  const seedRange = plan?.seedRange ?? { min: SEED_DEFAULT, max: SEED_MAX };
  const total = sum(segmentCounts);
  const mismatch = !inRange(total, range);
  const fromAccounts = loginMode === "account" && accountCount > 0;

  return (
    <div className="flex flex-col gap-12">
      <section
        aria-labelledby="segment-title"
        className="flex w-176 max-w-full flex-col gap-7 pl-2"
      >
        <div className="flex flex-col gap-6">
          <h2 id="segment-title" className="text-lg font-bold text-ink">
            세그먼트 비율
          </h2>
          <div className="flex flex-col gap-5">
            <p className="text-caption text-subtle">
              {fromAccounts
                ? `테스트 계정 ${accountCount}개 → AI 고객 ${range.total}명`
                : `AI 고객 ${range.min === range.max ? range.min : `${range.min}~${range.max}`}명 · 로그인 테스트는 계정 수만큼 (최대 ${ACCOUNT_MAX})`}
            </p>
            {/* 불러오는 중에는 "보정 전"으로 잘못 보이지 않게 비워 둡니다 */}
            <div className="flex items-center gap-3 text-xs">
              {inferring ? (
                <p role="status" className="text-subtle">
                  서비스 설명으로 세그먼트 유형을 정하는 중이에요…
                </p>
              ) : infer.isError && needsInference ? (
                <p role="alert" className="text-danger">
                  세그먼트 유형을 정하지 못했어요. 시작 전 확인에서 페르소나를 만들 때 다시 정해요.
                  {/* 서버가 준 이유 (생성기 실패·타겟 설명 없음 등) — 원인을 화면에서 바로 볼 수 있게 */}
                  {infer.error?.message && (
                    <span className="block text-subtle">
                      {infer.error.message}
                      {infer.error.code && ` · ${infer.error.code}`}
                    </span>
                  )}
                </p>
              ) : (
                <p className="text-subtle">
                  서비스 설명으로 정한 세그먼트예요 · 사람마다 능력치는 조금씩 달라요
                </p>
              )}
              <Button
                variant="link"
                disabled={inferring || !plan}
                onClick={() => infer.mutate()}
                className="text-xs"
              >
                {infer.isError && needsInference ? "다시 시도" : "다시 정하기"}
              </Button>
            </div>
            {calibratedLabel !== undefined && (
              <p className="flex items-center gap-2 text-xs text-gray-800">
                <Icon name="status-done" />
                {calibratedLabel
                  ? `이 프로젝트에 맞춘 값으로 예측해요 · ${calibratedLabel} 적용`
                  : "아직 예측 맞추기 전이라 기본 모형으로 예측해요"}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <ul aria-label="세그먼트별 인원" className="flex flex-col gap-1">
            {segmentCounts.map((count, index) => {
              const label = `세그먼트 ${index + 1}`;
              const profile = profiles[index];
              return (
                <li
                  key={label}
                  className="flex items-center justify-between gap-4 border-b border-line pb-1"
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    {profile?.name ? (
                      <span className="text-sm font-medium text-gray-800">{profile.name}</span>
                    ) : inferring ? (
                      <span
                        aria-label={`${label} 유형 정하는 중`}
                        className="h-4 w-28 animate-pulse rounded bg-gray-100"
                      />
                    ) : (
                      <span className="text-sm text-gray-800">{label}</span>
                    )}
                    {profile?.situation && (
                      <span className="truncate text-xs text-subtle" title={profile.situation}>
                        {profile.situation}
                      </span>
                    )}
                    {profile?.variables && (
                      <span className="text-xs text-muted">{traitLine(profile.variables)}</span>
                    )}
                  </div>
                  <SegmentStepper
                    label={label}
                    value={count}
                    max={range.max}
                    onChange={(value) => setSegmentCount(index, value)}
                  />
                </li>
              );
            })}
          </ul>
          <div className="flex flex-col gap-2">
            <p className="flex items-center justify-between text-sm">
              <span className="font-medium text-ink">합계</span>
              <span className={cn("font-bold", mismatch ? "text-danger" : "text-ink")}>
                {total}명
              </span>
            </p>
            {mismatch && (
              <p role="alert" className="text-xs text-danger">
                {segmentTotalMessage(total, range)}
              </p>
            )}
          </div>
        </div>
      </section>

      <section aria-labelledby="run-conditions-title" className="flex flex-col gap-5">
        <h2 id="run-conditions-title" className="pl-2 text-base font-medium text-ink">
          실행 조건
        </h2>
        <div className="flex flex-col gap-3">
          <p className="pl-2 text-xs text-subtle">{runConditions(seedCount, viewportWidth)}</p>
          <div className="flex items-center justify-between border-b border-line pb-1 pl-2">
            <span className="text-sm text-gray-800">기기</span>
            <SegmentedTabs
              label="기기"
              options={VIEWPORTS}
              value={String(viewportWidth)}
              onChange={(value) => setViewportWidth(Number(value))}
            />
          </div>
          <p className="pl-2 text-xs text-subtle">
            모바일 전용 사이트면 모바일 390 을 골라요 (데스크톱용 화면은 390 에서 깨질 수 있어요)
          </p>
          {/* 임시 라벨: Figma 에 시드 선택이 없어 BE 범위(1~3회)만 고르게 둡니다 */}
          <div className="flex items-center justify-between border-b border-line pb-1 pl-2">
            <span className="text-sm text-gray-800">반복</span>
            <SegmentStepper
              label="반복"
              value={seedCount}
              min={seedRange.min}
              max={seedRange.max}
              unit="회"
              valueName="횟수"
              onChange={setSeedCount}
            />
          </div>
          {showDetails && (
            <ul className="flex flex-col gap-1 pl-2 text-xs text-subtle">
              {RUN_CONDITION_DETAILS.map((item) => (
                <li key={item}>· {item}</li>
              ))}
            </ul>
          )}
          <Button
            variant="link"
            aria-expanded={showDetails}
            onClick={() => setShowDetails((value) => !value)}
            className="self-start"
          >
            {showDetails ? "접기" : `항목 ${RUN_CONDITION_DETAILS.length}개 더 보기`}
          </Button>
        </div>
      </section>

      <StepFooter>
        <Button variant="link" onClick={onPrev}>
          이전
        </Button>
        <Button disabled={mismatch || saving} onClick={onNext}>
          다음: 시작 전 확인
        </Button>
      </StepFooter>
    </div>
  );
}
