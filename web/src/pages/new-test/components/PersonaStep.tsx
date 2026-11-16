import { useState } from "react";
import { useShallow } from "zustand/react/shallow";

import Button from "@/components/Button/Button";
import Icon from "@/components/Icon/Icon";
import { useNewTestStore } from "@/stores/useNewTestStore";
import { cn } from "@/utils/cn";

import {
  agentRange,
  inRange,
  RUN_CONDITION_DETAILS,
  runConditions,
  SEED_DEFAULT,
  SEED_MAX,
  segmentTotalMessage,
  sum,
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

/*
  P05b 세그먼트 비율 (+ P05e 합계 오류, P05h 테스트 계정 8개) — Figma Wizard/Body (너비 704)
  - 에이전트(기본 10명, 4~20명 · 로그인 테스트는 계정 수만큼)를 세그먼트 4개에 나눕니다.
    합계가 서버 범위 안이어야 다음으로 갑니다.
  - 실행 조건에서 시드 횟수(기본 1회, 1~3회)를 고릅니다.
  - "다음"에서 세그먼트 인원과 바뀐 시드를 계획에 저장합니다 (PATCH segments · limits).
    서버는 세그먼트마다 1명 이상을 받습니다.
*/
export default function PersonaStep({
  calibratedLabel,
  onPrev,
  onNext,
  saving = false,
}: PersonaStepProps) {
  const { plan, segmentCounts, seedCount, loginMode, accountCount, setSegmentCount, setSeedCount } =
    useNewTestStore(
      useShallow((state) => ({
        plan: state.plan,
        segmentCounts: state.segmentCounts,
        seedCount: state.seedCount,
        loginMode: state.loginMode,
        accountCount: state.accounts.length,
        setSegmentCount: state.setSegmentCount,
        setSeedCount: state.setSeedCount,
      })),
    );
  const [showDetails, setShowDetails] = useState(false);
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
                ? `테스트 계정 ${accountCount}개 → 에이전트 ${range.total}명`
                : `에이전트 ${range.min}~${range.max}명 · 로그인 테스트는 계정 수만큼 (최대 ${range.max})`}
            </p>
            {/* 불러오는 중에는 "보정 전"으로 잘못 보이지 않게 비워 둡니다 */}
            {calibratedLabel !== undefined && (
              <p className="flex items-center gap-2 text-xs text-gray-800">
                <Icon name="status-done" />
                {calibratedLabel
                  ? `이 프로젝트 보정값으로 예측해요 · ${calibratedLabel} 적용`
                  : "아직 보정 전이라 기본 모형으로 예측해요"}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <ul aria-label="세그먼트별 인원" className="flex flex-col gap-1">
            {segmentCounts.map((count, index) => {
              const label = `세그먼트 ${index + 1}`;
              return (
                <li
                  key={label}
                  className="flex items-center justify-between border-b border-line pb-1"
                >
                  <span className="text-sm text-gray-800">{label}</span>
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
          <p className="pl-2 text-xs text-subtle">{runConditions(seedCount)}</p>
          {/* 임시 라벨: Figma 에 시드 선택이 없어 BE 범위(1~3회)만 고르게 둡니다 */}
          <div className="flex items-center justify-between border-b border-line pb-1 pl-2">
            <span className="text-sm text-gray-800">시드</span>
            <SegmentStepper
              label="시드"
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
