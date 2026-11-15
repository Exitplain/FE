import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import Button from "@/components/Button/Button";
import Icon from "@/components/Icon/Icon";
import type { IconName } from "@/components/Icon/iconNames";
import { buildPath } from "@/constants/routes";
import { useNewTestStore } from "@/stores/useNewTestStore";
import type { ApiError } from "@/types/api.type";
import type { PanelSegment, PanelTraits } from "@/types/persona.type";
import { cn } from "@/utils/cn";

import { useGeneratePanel } from "../hooks/useNewTestMutations";
import { StatusRow, StepFooter } from "./StepSection";

type PersonaReviewStepProps = {
  projectId: string;
  /* 실행 시작(confirm) 요청 상태 — 오류 안내는 이 화면에서 보여줍니다 */
  isStarting: boolean;
  error: ApiError | null;
  /* 409 일 때 이동할 현재 실행 */
  currentRunId: string | null;
  onPrev: () => void;
  onStart: () => void;
};

/* 생성 중 단계가 넘어가는 간격. 실제 서버 진행률이 없어 시간으로 보여줍니다 */
const GEN_STEP_MS = 400;

/* Figma Card/Segment 의 견본 색 (세그먼트 순서대로) */
const SWATCHES = ["bg-ink", "bg-gray-800", "bg-subtle", "bg-gray-300"];

const TRAITS: { key: keyof PanelTraits; label: string }[] = [
  { key: "patience", label: "인내심" },
  { key: "digital", label: "디지털 숙련도" },
  { key: "price", label: "가격 민감도" },
  { key: "trust", label: "신뢰 요구" },
];

/*
  P06 페르소나 생성 중 → P07 페르소나 확인.
  들어오면 타겟 고객 설명·세그먼트 인원으로 패널을 만들고, 끝나면 세그먼트 카드를 보여줍니다.
  "실행 시작"을 누르면 그때 실행(confirm)을 시작합니다.
*/
export default function PersonaReviewStep({
  projectId,
  isStarting,
  error,
  currentRunId,
  onPrev,
  onStart,
}: PersonaReviewStepProps) {
  const generate = useGeneratePanel();
  const { mutate } = generate;

  /* 들어올 때 한 번만 만듭니다 (StrictMode 의 effect 두 번 실행에도 요청은 한 번) */
  const requested = useRef(false);
  const request = () => {
    const { targetDescription, segmentCounts } = useNewTestStore.getState();
    mutate({ context: targetDescription.trim(), segments: segmentCounts });
  };
  useEffect(() => {
    if (requested.current) return;
    requested.current = true;
    const { targetDescription, segmentCounts } = useNewTestStore.getState();
    mutate({ context: targetDescription.trim(), segments: segmentCounts });
  }, [mutate]);

  if (generate.isError) {
    return (
      <div className="flex flex-col gap-12">
        <p role="alert" className="flex items-center gap-2 text-caption">
          <Icon name="status-error" className="size-5 text-danger" />
          <span className="font-bold text-ink">페르소나를 만들지 못했어요</span>
          <span className="text-subtle">
            {generate.error.status === 0 ? "서버에 연결할 수 없어요" : generate.error.message} ·
            잠시 후 다시 시도해 주세요
          </span>
        </p>
        <StepFooter>
          <Button variant="link" onClick={onPrev}>
            이전
          </Button>
          <Button onClick={request}>다시 시도</Button>
        </StepFooter>
      </div>
    );
  }

  if (!generate.data) {
    return <Generating onPrev={onPrev} />;
  }

  return (
    <div className="flex flex-col gap-12">
      <p role="status" className="sr-only">
        페르소나 세그먼트 {generate.data.segments.length}개를 만들었어요
      </p>
      <ul aria-label="페르소나 세그먼트" className="grid grid-cols-4 gap-6">
        {generate.data.segments.map((segment, index) => (
          <SegmentCard key={segment.id} segment={segment} swatch={SWATCHES[index % 4]} />
        ))}
      </ul>

      <div className="flex flex-col gap-10">
        <p className="text-xs text-muted">행동 변수 0~100 · 타겟 고객 설명으로 생성(예시)</p>

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
        {error && error.status !== 409 && (
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
          <Button variant="link" disabled={isStarting} onClick={onPrev}>
            이전
          </Button>
          <Button disabled={isStarting} onClick={onStart}>
            {isStarting ? "시작하는 중…" : "실행 시작"}
          </Button>
        </StepFooter>
      </div>
    </div>
  );
}

/* P06 — 생성 단계 4개와 세그먼트 자리 표시 카드. 끝나기 전에는 실행을 시작할 수 없습니다 */
function Generating({ onPrev }: { onPrev: () => void }) {
  const segmentCounts = useNewTestStore((state) => state.segmentCounts);
  const panel = segmentCounts.reduce((total, count) => total + count, 0);
  const segments = segmentCounts.filter((count) => count > 0).length;

  /* 진행 중인 단계 (앞 단계는 완료). 마지막 단계에서 응답을 기다립니다 */
  const [current, setCurrent] = useState(1);
  useEffect(() => {
    const timer = window.setInterval(
      () => setCurrent((step) => Math.min(step + 1, 3)),
      GEN_STEP_MS,
    );
    return () => window.clearInterval(timer);
  }, []);

  const steps = [
    "타겟 고객 설명 분석",
    `세그먼트 ${segments}종 추출`,
    "행동 변수 분포 생성",
    `${panel}명 샘플링 · P-001~P-${String(panel).padStart(3, "0")} 코드 부여`,
  ];

  return (
    <div className="flex flex-col gap-12">
      <section aria-labelledby="generating-title" aria-busy className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <h2 id="generating-title" className="flex-1 text-lg font-bold text-ink">
            페르소나를 만들고 있어요
          </h2>
          <span className="flex items-center gap-1 rounded-full bg-gray-50 px-3 py-1 text-caption text-subtle">
            <Icon name="status-wait" className="size-5" />
            준비 중
          </span>
        </div>
        <p role="status" className="sr-only">
          {steps[current]} 진행 중
        </p>
        <ol aria-label="생성 단계" className="flex flex-col">
          {steps.map((label, index) => {
            const status = index < current ? "done" : index === current ? "running" : "waiting";
            return <GenStep key={label} label={label} status={status} />;
          })}
        </ol>
      </section>

      <div className="flex flex-col gap-10">
        <div aria-hidden className="grid grid-cols-4 gap-6">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="flex flex-col gap-4 rounded-xl bg-surface p-6">
              <div className="h-4 w-30 rounded bg-gray-200" />
              <div className="h-12 rounded bg-gray-200" />
              <div className="h-2 rounded bg-gray-200" />
              <div className="h-2 rounded bg-gray-200" />
              <div className="h-2 rounded bg-gray-200" />
              <div className="h-2 rounded bg-gray-200" />
            </div>
          ))}
        </div>
        <StepFooter>
          <Button variant="link" onClick={onPrev}>
            이전
          </Button>
          <Button disabled>실행 시작</Button>
        </StepFooter>
      </div>
    </div>
  );
}

const GEN_STATUS: Record<
  "done" | "running" | "waiting",
  { icon: IconName; label: string; strong: boolean }
> = {
  done: { icon: "check", label: "완료", strong: true },
  running: { icon: "play", label: "진행 중", strong: true },
  waiting: { icon: "circle", label: "대기", strong: false },
};

/* Figma Row/GenStep — 마지막 줄만 아래 선이 없습니다 */
function GenStep({ label, status }: { label: string; status: keyof typeof GEN_STATUS }) {
  const { icon, label: statusLabel, strong } = GEN_STATUS[status];
  return (
    <li
      className={cn(
        "flex min-h-12 items-center gap-3 border-b border-line pt-3 pb-4 last:border-b-0 last:pt-4 last:pb-3",
        strong ? "font-bold text-ink" : "text-subtle",
      )}
    >
      <Icon name={icon} className="size-5" />
      <span className="flex-1 text-sm">{label}</span>
      <span className="text-caption">{statusLabel}</span>
    </li>
  );
}

/* Figma Card/Segment — 이름·인원, 대표 에이전트, 행동 변수 4개 막대 */
function SegmentCard({ segment, swatch }: { segment: PanelSegment; swatch: string }) {
  const [first, last] = segment.codes;
  return (
    <li aria-label={segment.name} className="flex flex-col gap-4 rounded-xl bg-surface p-6">
      <div className="flex items-center gap-2">
        <span aria-hidden className={cn("size-3 shrink-0 rounded-xs", swatch)} />
        <h3 className="flex-1 font-medium text-ink">{segment.name}</h3>
        <span className="text-caption text-subtle">{segment.count}명</span>
      </div>
      <div className="flex flex-col gap-1 rounded-lg bg-gray-50 p-3">
        <p className="text-sm font-bold text-ink">대표 {segment.representative}</p>
        {/* Figma "P-001~005" — 끝 코드는 숫자만 */}
        <p className="text-xs text-muted">
          {first}~{last.replace(/^P-/, "")}
        </p>
      </div>
      <ul aria-label="행동 변수" className="flex flex-col">
        {TRAITS.map(({ key, label }) => (
          <li
            key={key}
            className="flex flex-col gap-2 border-b border-line py-3 first:pt-0 last:border-b-0 last:pb-0"
          >
            <div className="flex items-center gap-2">
              <span className="flex-1 text-caption text-subtle">{label}</span>
              <span className="text-sm font-bold text-ink">{segment.traits[key]}</span>
            </div>
            <div
              role="meter"
              aria-label={`${label} ${segment.traits[key]}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={segment.traits[key]}
              className="h-2 overflow-hidden rounded-full bg-gray-200"
            >
              {/* 0~100 값이라 너비 비율로 그립니다 (고정 단계 클래스로 표현할 수 없는 동적 값) */}
              <div className="h-full bg-subtle" style={{ width: `${segment.traits[key]}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </li>
  );
}
