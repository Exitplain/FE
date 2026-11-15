import type { ReactNode } from "react";
import { useParams, useSearchParams } from "react-router-dom";

import logoMark from "@/assets/brand/logo-mark.svg";
import question from "@/assets/characters/character-question.svg";
import RangeBarChart from "@/components/RangeBarChart/RangeBarChart";
import WorkspaceState, { WorkspaceRetry } from "@/components/Workspace/WorkspaceState";
import { CAUSE_LABELS } from "@/constants/persona";
import AlignmentSummary from "@/pages/report/components/AlignmentSummary";
import KpiRow from "@/pages/report/components/KpiRow";
import ReportSection from "@/pages/report/components/ReportSection";
import SegmentHeatmap from "@/pages/report/components/SegmentHeatmap";
import { usePersonaReport } from "@/pages/report/hooks/usePersonaReport";
import {
  causeShares,
  completion,
  dropLabel,
  formatDay,
  formatRange,
  funnelRows,
  taskFindings,
  worstDrop,
} from "@/pages/report/utils/reportView";
import { ApiError } from "@/types/api.type";
import type { PersonaReport, ReportTask } from "@/types/persona.type";

const TOP_ISSUES = 3;

/*
  P21 공유 리포트 (읽기 전용) + E17 공유 링크 만료.
  임시: 공유 API(토큰·만료·해제)가 아직 없어 shareId 는 실행 ID 이고(P20 ShareModal 과 같음),
  리포트 API 로 내용을 받습니다. 없는 실행(404)은 만료·해제된 링크(E17)로 봅니다.
  - 로그인 없이 보는 화면이라 앱 안 화면으로 가는 링크(세션 상세·목업·실측 분석)는 빼고,
    실행 목록(차수)은 부르지 않습니다. 차수는 서버가 공유 응답에 넣어 주면 붙입니다.
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
  /*
    TODO(API): 공유 API 가 생기면 P12 리포트와 캐시를 나눠 공유 전용 키·응답으로 바꿉니다.
    (지금은 같은 키라 같은 탭에서 P12 를 봤다면 공유 해제 직후에도 다시 받기 전까지 내용이 보일 수 있습니다)
  */
  const report = usePersonaReport(shareId);
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
  /*
    없음(404)·아직 끝나지 않음(409)·권한 없음(401·403)은 받는 사람이 할 수 있는 일이 없어
    다시 시도 대신 만료 안내(E17)로 둡니다. 임시: 공유 API 가 없어 인증이 걸린 리포트 API 를 씁니다.
  */
  if (report.isError && status != null && [401, 403, 404, 409].includes(status)) {
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

  const data = report.data;
  /* 공유한 사람이 고른 과업(?task=)을 보여주고, 없으면 첫 과업 */
  const task = data.tasks.find((item) => item.id === params.get("task")) ?? data.tasks[0];
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
  return <SharedBody report={data} task={task} />;
}

function Column({ children }: { children: ReactNode }) {
  return <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-6 py-12">{children}</div>;
}

/* "11월 7일 · AI 고객 20명 × 시드 3회 · 과업 2개 (첫 주문 완료 외 1개)" */
function sharedMeta(report: PersonaReport) {
  const parts = [formatDay(report.created_at)];
  if (report.conditions) {
    parts.push(`AI 고객 ${report.conditions.panel_size}명 × 시드 ${report.conditions.seeds}회`);
  }
  const names = report.tasks.map((task) => task.name);
  if (names.length > 1) parts.push(`과업 ${names.length}개 (${names[0]} 외 ${names.length - 1}개)`);
  else if (names.length === 1) parts.push(`과업 1개 (${names[0]})`);
  return parts.join(" · ");
}

function SharedBody({ report, task }: { report: PersonaReport; task: ReportTask }) {
  const findings = taskFindings(report.findings, task.id);
  const goal = completion(task);
  const drop = worstDrop(task);
  const causes = causeShares(findings, task.dropout);
  const funnel = funnelRows(task);
  const top = findings.slice(0, TOP_ISSUES);

  const glance = [
    {
      title: `목표 달성률 ${formatRange(goal.rate, "%")} (예측)`,
      note: `${goal.base}명 중 ${formatRange(goal.completed)}명이 ${task.name}을 끝냈어요`,
    },
    drop && {
      title: `가장 많이 떠난 구간 · ${dropLabel(drop)}`,
      note: `이 구간 이탈 ${formatRange(drop.rate, "%")}`,
    },
    top[0] && {
      title: `1순위 개선 · ${top[0].title}`,
      note: top[0].recommendation,
    },
  ].filter((item): item is { title: string; note: string } => Boolean(item));

  return (
    <Column>
      <header className="flex flex-col gap-2">
        <p className="text-xs text-muted">사전 테스트 리포트 · 예측</p>
        <h1 className="text-2xl font-bold text-ink">
          {report.target} · {task.name}
        </h1>
        <p className="text-caption text-subtle">{sharedMeta(report)}</p>
      </header>

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

      <section aria-labelledby="shared-summary">
        <h2 id="shared-summary" className="sr-only">
          요약
        </h2>
        <KpiRow task={task} findings={findings} />
      </section>

      <ReportSection
        id="funnel"
        title="1. 예측 퍼널"
        aside="랜딩 대비 도달 비율 · 범위 = 시드 반복"
      >
        {funnel.length > 0 ? (
          <RangeBarChart
            title="예측 퍼널"
            data={funnel}
            max={task.funnel?.[0]?.reached[1] ?? 0}
            valueWidth={180}
          />
        ) : (
          <p className="text-sm text-subtle">이 과업은 단계별 예측 기록이 없어요.</p>
        )}
      </ReportSection>

      <ReportSection id="issues" title="2. 개선 우선순위 Top 3" aside="영향 인원 순">
        {top.length > 0 ? (
          <ol className="flex flex-col">
            {top.map((finding, index) => (
              <li key={finding.id} className="flex gap-4 border-b border-line py-3 last:border-b-0">
                <span className="text-caption font-bold text-ink">{index + 1}</span>
                <span className="flex flex-1 flex-col gap-1">
                  <span className="text-caption font-bold text-ink">{finding.title}</span>
                  <span className="text-xs text-subtle">{finding.recommendation}</span>
                </span>
                <span className="text-caption font-bold text-ink">
                  영향 {finding.affected_sessions}명
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-subtle">이 과업에서 찾은 문제가 없어요.</p>
        )}
      </ReportSection>

      <ReportSection id="causes" title="3. 이탈 원인 분포">
        {causes.length > 0 ? (
          <RangeBarChart
            title="이탈 원인 분포"
            max={100}
            rowHeight={32}
            valueWidth={120}
            valueTone="strong"
            data={causes.map((item) => ({
              key: item.cause,
              label: CAUSE_LABELS[item.cause],
              value: item.share,
              valueLabel: `${item.share}%`,
            }))}
          />
        ) : (
          <p className="text-sm text-subtle">이 과업에서는 가상 이탈이 없었어요.</p>
        )}
      </ReportSection>

      <SegmentHeatmap task={task} alwaysOpen />

      {/*
        실측과 비교할 수 있을 때만 보여줍니다. 대기 상태 문구(스크립트 설치 등)는
        받는 사람이 할 수 없는 운영자용 안내라 공유 화면에서는 뺍니다.
      */}
      {task.actual?.status === "comparable" && (
        <AlignmentSummary alignment={report.alignment} actual={task.actual} />
      )}

      <footer className="flex flex-col gap-1 border-t border-line pt-6 text-xs text-muted">
        <p>가상 이탈은 실제 고객 이탈률이 아니에요 · 예측은 범위, 실측은 단일값이에요</p>
        <p>Exitplain · 읽기 전용 공유 리포트</p>
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
