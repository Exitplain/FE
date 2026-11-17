import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useParams, useSearchParams } from "react-router-dom";

import { queryKeys } from "@/apis/queryKeys";
import { getSharedReport } from "@/apis/report.api";
import logoMark from "@/assets/brand/logo-mark.svg";
import question from "@/assets/characters/character-question.svg";
import RangeBarChart from "@/components/RangeBarChart/RangeBarChart";
import WorkspaceState, { WorkspaceRetry } from "@/components/Workspace/WorkspaceState";
import KpiRow from "@/pages/report/components/KpiRow";
import ReportSection from "@/pages/report/components/ReportSection";
import SegmentHeatmap from "@/pages/report/components/SegmentHeatmap";
import {
  causeRowsV1,
  describeReport,
  formatMinMax,
  funnelMax,
  funnelRowsV1,
  percentRange,
  worstDropV1,
} from "@/pages/report/utils/reportData";
import { formatDay } from "@/pages/report/utils/reportView";
import { ApiError } from "@/types/api.type";
import type { ReportTaskV1, SharedReport as SharedReportData } from "@/types/report.type";

/*
  P21 공유 리포트 (읽기 전용) + E17 공유 링크 만료.
  - GET /api/v1/shared/{token} — 로그인 없이 봅니다. 없거나 취소된 링크는 404, 만료된 링크는 410 입니다.
  - 앱 안 화면으로 가는 링크(세션 상세·실측 분석)는 넣지 않습니다.
  - 개선 Top 3·실측 비교는 제품 API 리포트에 아직 데이터가 없어 넣지 않습니다.
*/
export default function SharedReportPage() {
  const { shareId } = useParams();
  return (
    <div className="flex min-h-full flex-col bg-surface">
      <header className="flex min-h-16 items-center justify-between border-b border-line px-8">
        <span className="flex items-center gap-2">
          <img src={logoMark} alt="" className="h-9 w-auto" />
          <span className="font-logo text-2xl leading-9 text-black">EXITPLAIN</span>
        </span>
        <span className="text-xs text-muted">읽기 전용</span>
      </header>
      <main className="flex flex-1 flex-col">
        {shareId ? <SharedReport shareId={shareId} /> : <ShareExpired />}
      </main>
    </div>
  );
}

function SharedReport({ shareId }: { shareId: string }) {
  const report = useQuery({
    queryKey: queryKeys.reports.shared(shareId),
    queryFn: () => getSharedReport(shareId),
    /* 없음·취소(404)·만료(410)는 다시 물어도 같습니다 */
    retry: (count, error) =>
      !(error instanceof ApiError && [404, 410].includes(error.status)) && count < 1,
  });
  const [params] = useSearchParams();
  const status = report.error instanceof ApiError ? report.error.status : null;

  if (report.isPending) {
    return (
      <Column>
        <h1 className="sr-only">공유 리포트</h1>
        <WorkspaceState kind="loading" title="공유 리포트를 불러오고 있어요" />
      </Column>
    );
  }
  /* 없거나 취소된 링크(404)·만료된 링크(410)는 받는 사람이 할 수 있는 일이 없어 다시 시도 대신 E17 로 둡니다 */
  if (report.isError && (status === 404 || status === 410)) {
    return <ShareExpired />;
  }
  if (report.isError) {
    return (
      <Column>
        <h1 className="sr-only">공유 리포트</h1>
        <WorkspaceState
          kind="error"
          title="공유 리포트를 불러오지 못했어요"
          description="잠시 뒤 다시 시도해 주세요."
          action={<WorkspaceRetry onClick={() => void report.refetch()} />}
        />
      </Column>
    );
  }

  const shared = report.data;
  /* 공유한 사람이 고른 과업(?task=)을 보여주고, 없으면 첫 과업 */
  const task =
    shared.data.tasks.find((item) => item.task_id === params.get("task")) ?? shared.data.tasks[0];
  if (!task) {
    return (
      <Column>
        <h1 className="sr-only">공유 리포트</h1>
        <WorkspaceState
          kind="empty"
          title="이 리포트에는 과업 결과가 없어요"
          description="모든 세션이 기술 실패로 끝났을 수 있어요. 공유한 사람에게 확인해 주세요."
        />
      </Column>
    );
  }
  return <SharedBody shared={shared} task={task} />;
}

function Column({ children }: { children: ReactNode }) {
  return <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-6 py-12">{children}</div>;
}

/* "11월 7일 · AI 고객 20명 × 시드 3회 · 과업 2개 (첫 주문 완료 외 1개)" */
function sharedMeta(shared: SharedReportData) {
  const parts = [describeReport(shared.created_at, shared.data)];
  const names = shared.data.tasks.map((task) => task.name);
  if (names.length > 1) parts.push(`과업 ${names.length}개 (${names[0]} 외 ${names.length - 1}개)`);
  else if (names.length === 1) parts.push(`과업 1개 (${names[0]})`);
  return parts.join(" · ");
}

function SharedBody({ shared, task }: { shared: SharedReportData; task: ReportTaskV1 }) {
  const drop = worstDropV1(task);
  const rate = percentRange(task.seed_ranges.achievement_rate);
  const causes = causeRowsV1(task);
  const funnel = funnelRowsV1(task);
  const max = funnelMax(task);

  const glance = [
    task.valid_sessions > 0 && {
      title: `목표 달성률 ${formatMinMax(rate, "%")} (예측)`,
      note: `유효 세션 ${task.valid_sessions}개 중 ${task.success}개가 목표에 도달했어요`,
    },
    drop && {
      title: `가장 많이 떠난 구간 · ${drop.label}`,
      note: `이 구간 이탈 ${drop.dropouts}명${drop.percent == null ? "" : ` · ${drop.percent}%`}`,
    },
    causes[0] && {
      title: `가장 많은 이탈 원인 · ${causes[0].name}`,
      note: `가상 이탈의 ${causes[0].percent}%`,
    },
  ].filter((item): item is { title: string; note: string } => Boolean(item));

  return (
    <Column>
      <header className="flex flex-col gap-2">
        <p className="text-xs text-muted">사전 테스트 리포트 · 예측</p>
        <h1 className="text-2xl font-bold text-ink">
          {shared.project.name} · {task.name}
        </h1>
        <p className="text-caption text-subtle">{sharedMeta(shared)}</p>
      </header>

      {glance.length > 0 && (
        <section
          aria-labelledby="glance-title"
          className="flex flex-col gap-3 border-y border-line py-6"
        >
          <h2 id="glance-title" className="text-base font-bold text-ink">
            한눈에 보기
          </h2>
          <ol className="flex flex-col gap-3">
            {glance.map((item, index) => (
              <li key={item.title} className="flex gap-4">
                <span className="text-caption font-bold text-ink">{index + 1}</span>
                <span className="flex flex-col gap-1">
                  <span className="text-caption font-bold text-ink">{item.title}</span>
                  <span className="text-xs text-subtle">{item.note}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section aria-labelledby="shared-summary">
        <h2 id="shared-summary" className="sr-only">
          요약
        </h2>
        <KpiRow task={task} />
      </section>

      <ReportSection id="funnel" title="1. 예측 퍼널" aside="도달 인원 · 범위 = 시드 반복">
        {funnel.length > 0 && max > 0 ? (
          <RangeBarChart title="예측 퍼널" data={funnel} max={max} valueWidth={180} />
        ) : (
          <p className="text-sm text-subtle">이 과업은 단계별 예측 기록이 없어요.</p>
        )}
      </ReportSection>

      <ReportSection id="causes" title="2. 이탈 원인 분포">
        {causes.length > 0 ? (
          <RangeBarChart
            title="이탈 원인 분포"
            max={100}
            rowHeight={32}
            valueWidth={120}
            valueTone="strong"
            data={causes.map((item) => ({
              key: item.key,
              label: item.name,
              value: item.percent,
              valueLabel: `${item.percent}%`,
            }))}
          />
        ) : (
          <p className="text-sm text-subtle">이 과업에서는 가상 이탈이 없었어요.</p>
        )}
      </ReportSection>

      <SegmentHeatmap task={task} alwaysOpen />

      <footer className="flex flex-col gap-1 border-t border-line pt-6 text-xs text-muted">
        {shared.data.notes.map((text) => (
          <p key={text}>{text}</p>
        ))}
        <p>Exitplain · 읽기 전용 공유 리포트 · {formatDay(shared.expires_at)}까지</p>
      </footer>
    </Column>
  );
}

/* E17 — 만료·해제된 링크. 리포트 내용은 남기지 않습니다 */
function ShareExpired() {
  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
      <img src={question} alt="" className="max-w-full" />
      <div className="flex flex-col gap-2">
        <h1 className="text-lg font-bold text-ink">공유 링크가 만료됐거나 해제됐어요</h1>
        <p className="text-sm text-subtle">공유한 사람에게 새 링크를 요청하세요</p>
      </div>
    </section>
  );
}
