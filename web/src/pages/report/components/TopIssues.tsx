import { useId, useState } from "react";
import { Link } from "react-router-dom";

import { artifactUrl } from "@/apis/persona.api";
import Button from "@/components/Button/Button";
import { buttonVariants } from "@/components/Button/buttonVariants";
import Icon from "@/components/Icon/Icon";
import InfoTip from "@/components/InfoTip/InfoTip";
import { CAUSE_LABELS, STAGE_LABELS } from "@/constants/persona";
import { buildPath } from "@/constants/routes";
import type { ReportFinding } from "@/types/persona.type";

import MockupCompareModal from "./MockupCompareModal";

const TOP = 3;

function IssueDetail({
  finding,
  projectId,
  runId,
  onMockup,
}: {
  finding: ReportFinding;
  projectId: string;
  runId: string;
  onMockup: () => void;
}) {
  const evidence = finding.evidence[0];
  if (!evidence) return <p className="text-xs text-muted">이 문제의 근거 세션이 없어요.</p>;

  const rows = [
    [
      "어디에서",
      `${STAGE_LABELS[finding.stage]} 단계${evidence.path ? ` · ${evidence.path}` : ""}`,
    ],
    ["관측", evidence.annotation ?? evidence.observations[0] ?? "—"],
    ["모형 판단", `좌절 점수 ${evidence.score} > 임계치 ${evidence.threshold}`],
  ];

  return (
    <div className="flex flex-col gap-3">
      <dl className="flex flex-col gap-2.5">
        {rows.map(([term, detail]) => (
          <div key={term} className="grid grid-cols-4 items-baseline gap-x-2">
            <dt className="text-xs text-muted">{term}</dt>
            <dd className="col-span-3 text-caption text-gray-800">{detail}</dd>
          </div>
        ))}
      </dl>
      {/* 근거 화면이 없으면 이미지를 만들어 채우지 않고 없다고 표시합니다 (명세 6.1) */}
      {evidence.artifact_id ? (
        <img
          src={artifactUrl(evidence.artifact_id)}
          alt={`${STAGE_LABELS[finding.stage]} 단계에서 문제가 생긴 화면`}
          className="w-full rounded-lg border border-gray-300"
        />
      ) : (
        <p className="flex h-30 items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-surface text-xs text-muted">
          <Icon name="image" />
          캡처된 근거 화면이 없어요
        </p>
      )}
      <div className="-ml-2 flex gap-4">
        <Link
          to={buildPath("sessionDetail", { projectId, runId, sessionId: evidence.session_id })}
          className={buttonVariants({ variant: "link" })}
        >
          세션 {finding.evidence.length}개 전체 보기
        </Link>
        <Button variant="link" onClick={onMockup}>
          목업 비교
        </Button>
      </div>
    </div>
  );
}

/*
  P12 개선 우선순위 Top 3 — 영향(겪은 세션 수)이 큰 순서. 첫 문제는 펼쳐 두고 나머지는 눌러서 펼칩니다.
  Figma: 연회색 카드(테두리 · 모서리 16) · 번호 16px Bold · 제목 14px Medium · 개선안 13px · 항목 사이 구분선
*/
export default function TopIssues({
  findings,
  projectId,
  runId,
}: {
  findings: ReportFinding[];
  projectId: string;
  runId: string;
}) {
  const headingId = useId();
  const top = findings.slice(0, TOP);
  const [openId, setOpenId] = useState<string | null>(top[0]?.id ?? null);
  /* P12b 목업 비교 모달에 띄울 문제 */
  const [mockupId, setMockupId] = useState<string | null>(null);
  const mockupIndex = top.findIndex((finding) => finding.id === mockupId);

  return (
    <section
      id="issues"
      aria-labelledby={headingId}
      className="flex scroll-mt-8 flex-col gap-4 rounded-2xl border border-line bg-gray-50 p-6"
    >
      <div className="flex items-center gap-2">
        <h2 id={headingId} className="text-lg font-bold text-ink">
          개선 우선순위 Top {TOP}
        </h2>
        <InfoTip text="문제를 겪은 세션 수(영향)가 많은 순서예요. 개선안은 가설이라 재테스트로 확인해야 해요." />
        <span className="ml-auto text-xs text-muted">영향 인원 순</span>
      </div>

      {top.length === 0 ? (
        <p className="text-sm text-subtle">이 과업에서는 이탈 문제를 찾지 못했어요.</p>
      ) : (
        <ol className="flex flex-col">
          {top.map((finding, index) => {
            const open = finding.id === openId;
            const panelId = `${headingId}-${finding.id}`;
            return (
              <li key={finding.id} className="border-line py-5 not-first:border-t first:pt-2">
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={panelId}
                  onClick={() => setOpenId(open ? null : finding.id)}
                  className="flex w-full items-start gap-3 text-left focus-visible:outline-2 focus-visible:outline-ink"
                >
                  <span className="w-4 text-base font-bold text-ink">{index + 1}</span>
                  <span className="flex flex-1 flex-col gap-1">
                    <span className="text-sm font-medium text-ink">
                      {CAUSE_LABELS[finding.category]} · {STAGE_LABELS[finding.stage]} 단계
                    </span>
                    <span className="text-caption text-subtle">{finding.recommendation}</span>
                  </span>
                  <span className="text-caption font-medium whitespace-nowrap text-ink">
                    영향 {finding.affected_sessions}명
                  </span>
                </button>
                <div id={panelId} hidden={!open} className="mt-5 pl-7">
                  {open && (
                    <IssueDetail
                      finding={finding}
                      projectId={projectId}
                      runId={runId}
                      onMockup={() => setMockupId(finding.id)}
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <MockupCompareModal
        finding={top[mockupIndex] ?? null}
        rank={mockupIndex + 1}
        onClose={() => setMockupId(null)}
      />
    </section>
  );
}
