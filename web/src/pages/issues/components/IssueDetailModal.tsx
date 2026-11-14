import { Link } from "react-router-dom";

import Button from "@/components/Button/Button";
import { buttonVariants } from "@/components/Button/buttonVariants";
import Modal from "@/components/Modal/Modal";
import { buildPath } from "@/constants/routes";
import type { WorkspaceIssue } from "@/types/workspace.type";

export default function IssueDetailModal({
  issue,
  onClose,
}: {
  issue: WorkspaceIssue | undefined;
  onClose: () => void;
}) {
  if (!issue) return null;
  return (
    <Modal
      open
      onClose={onClose}
      title={`${issue.cause} · ${issue.stage}`}
      description={`${issue.projectName} · ${issue.task} · 샘플 데이터`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            닫기
          </Button>
          <Link
            className={buttonVariants({ variant: "outline" })}
            to={buildPath("report", { projectId: issue.projectId, runId: issue.runId })}
          >
            리포트 보기
          </Link>
        </>
      }
    >
      <dl className="grid grid-cols-3 gap-4 rounded-xl bg-gray-50 p-5">
        <div>
          <dt className="text-xs text-muted">영향 (가상 세션)</dt>
          <dd className="mt-2 font-bold">{issue.impact.join("~")}개</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">처음 발견</dt>
          <dd className="mt-2 text-sm">{issue.firstSeen}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">최근 테스트</dt>
          <dd className="mt-2 text-sm">{issue.verdict}</dd>
        </div>
      </dl>
      <section className="space-y-3">
        <h3 className="font-bold">관측 근거</h3>
        <p className="text-sm leading-7 text-subtle">{issue.evidence}</p>
        <p className="text-xs text-muted">
          가상 세션의 관측 예시이며 실제 사용자 이탈률이 아니에요.
        </p>
      </section>
    </Modal>
  );
}
