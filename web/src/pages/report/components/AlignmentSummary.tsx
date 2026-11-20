import { useId } from "react";
import { Link } from "react-router-dom";

import { buttonVariants } from "@/components/Button/buttonVariants";
import Icon from "@/components/Icon/Icon";
import type { IconName } from "@/components/Icon/iconNames";
import { STAGE_LABELS } from "@/constants/persona";
import { buildPath } from "@/constants/routes";
import type { ReportActual, ReportAlignment, Stage } from "@/types/persona.type";
import { cn } from "@/utils/cn";

import { formatDay } from "../utils/reportView";
import ReportSection from "./ReportSection";

/* 예측에 이탈이 없으면(null) "이탈 없음" */
const dropText = (drop: [Stage, Stage] | null) =>
  drop ? `${STAGE_LABELS[drop[0]]}→${STAGE_LABELS[drop[1]]}` : "이탈 없음";

/* P14 실측 비교 상태 3종 (Figma Section/ActualSummary/미연결·수집 중·수집 중단) */
const WAITING: Record<
  Exclude<ReportActual["status"], "comparable">,
  { icon: IconName; badge: string; quiet: boolean; action: string }
> = {
  unconnected: {
    icon: "unlink",
    badge: "미연결",
    quiet: false,
    action: "실제 고객 데이터 연결하기",
  },
  collecting: {
    icon: "more",
    badge: "수집 중",
    quiet: true,
    action: "실제 고객 데이터 단계별 이동 보기",
  },
  stale: { icon: "pause", badge: "수집 중단", quiet: false, action: "설치 다시 확인" },
};

function waitingText(actual: Exclude<ReportActual, { status: "comparable" }>) {
  switch (actual.status) {
    case "collecting":
      return {
        title: `표본을 모으는 중이에요 · ${actual.stages_total}개 단계 중 ${actual.stages_ready}개 충족`,
        body: "단계별 최소 방문 수를 채우면 비교할 수 있어요 (기준값 확인 필요).",
      };
    case "stale":
      return {
        /* 읽을 수 없는 시각이어도 화면이 깨지지 않게 formatDay("—")를 씁니다 */
        title: `최근 24시간 동안 이벤트가 없어요 · 마지막 수신 ${formatDay(actual.last_event_at)}`,
        body: "스크립트가 빠졌거나 배포로 바뀌었는지 확인하세요.",
      };
    default:
      return {
        title: "실제 고객 데이터가 아직 없어요",
        body: "이벤트 스크립트를 설치하면 이 예측이 실제와 맞는지 비교할 수 있어요.",
      };
  }
}

function ActualWaiting({
  actual,
  projectId,
}: {
  actual: Exclude<ReportActual, { status: "comparable" }>;
  projectId?: string;
}) {
  const headingId = useId();
  const look = WAITING[actual.status];
  const text = waitingText(actual);
  return (
    <section id="alignment" aria-labelledby={headingId} className="flex scroll-mt-8 flex-col gap-4">
      <div className="flex items-center gap-3">
        <h2 id={headingId} className="flex-1 text-lg font-bold text-ink">
          실제 고객 데이터 비교 요약
        </h2>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-3 py-1 text-caption",
            look.quiet ? "bg-gray-50 text-subtle" : "font-bold text-ink",
          )}
        >
          <Icon name={look.icon} className="size-5" />
          {look.badge}
        </span>
      </div>
      <p className="flex items-center gap-2 rounded-lg bg-gray-50 p-3 text-caption font-bold text-ink">
        <Icon name={look.icon} className="size-5" />
        {text.title}
      </p>
      <p className="text-caption text-subtle">{text.body}</p>
      {projectId && (
        <Link
          to={buildPath("analytics", { projectId })}
          className={buttonVariants({ className: "self-end" })}
        >
          {look.action}
        </Link>
      )}
    </section>
  );
}

/*
  P12 실측 비교 요약 (+ P14 상태).
  실측 수치는 실측 분석(R) API 가 없어 리포트 mock 의 예시값입니다 (types ReportActual 참고).
  사람 관측은 리포트의 alignment 를 그대로 씁니다 (기술 실패 세션 관측은 비교에서 빠진 값).
*/
export default function AlignmentSummary({
  alignment,
  actual = { status: "unconnected" },
  projectId,
}: {
  alignment: ReportAlignment;
  actual?: ReportActual;
  /* 없으면(P21 공유 리포트) 앱 안 화면으로 가는 링크를 숨깁니다 */
  projectId?: string;
}) {
  if (actual.status !== "comparable")
    return <ActualWaiting actual={actual} projectId={projectId} />;

  const { outcome } = alignment.metrics;
  const sameDrop =
    actual.max_drop.predicted !== null &&
    dropText(actual.max_drop.predicted) === dropText(actual.max_drop.actual);
  const rows = [
    ["평균 오차", `${actual.mean_error_pp}%p`],
    [
      "차이 구간",
      actual.gap_stages.length > 0
        ? `${actual.gap_stages.length}곳 · ${actual.gap_stages.map((stage) => STAGE_LABELS[stage]).join(", ")}`
        : "없음",
    ],
    ["최대 이탈 구간", sameDrop ? "예측과 일치" : "예측과 불일치"],
    [
      "사람 관측",
      alignment.observations === 0
        ? "아직 없어요"
        : `${alignment.observations}건 · 결과 ${outcome.matched}/${outcome.total} 일치`,
    ],
  ];

  return (
    <ReportSection
      id="alignment"
      title="실제 고객 데이터 비교 요약"
      info="예측이 실제와 맞는지 실제 고객 데이터 단계별 이동과 사람 관측으로 확인해요."
      aside={<span className="text-caption text-subtle">비교 가능</span>}
    >
      <div className="flex flex-col gap-2">
        <dl className="flex flex-col gap-4">
          {rows.map(([term, detail]) => (
            <div key={term} className="flex items-baseline justify-between gap-4">
              <dt className="text-caption text-muted">{term}</dt>
              <dd className="text-right text-sm text-gray-800">{detail}</dd>
            </div>
          ))}
        </dl>
        <p className="text-xs text-muted">
          예측 {dropText(actual.max_drop.predicted)} · 실제 고객 데이터{" "}
          {dropText(actual.max_drop.actual)}
        </p>
      </div>
      {projectId && (
        <Link
          to={buildPath("analytics", { projectId })}
          className={buttonVariants({ variant: "link", className: "-ml-2 self-start" })}
        >
          실제 고객 데이터 분석 보기
        </Link>
      )}
    </ReportSection>
  );
}
