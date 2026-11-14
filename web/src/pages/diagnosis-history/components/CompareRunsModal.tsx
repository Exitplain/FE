import { Link } from "react-router-dom";

import Button from "@/components/Button/Button";
import { buttonVariants } from "@/components/Button/buttonVariants";
import Modal from "@/components/Modal/Modal";
import { buildPath } from "@/constants/routes";
import type { WorkspaceRun } from "@/types/workspace.type";

export default function CompareRunsModal({
  open,
  onClose,
  runs,
}: {
  open: boolean;
  onClose: () => void;
  runs: WorkspaceRun[];
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="선택한 실행 비교"
      description="샘플 데이터의 과업별 예측 범위예요. 실제 고객의 목표 달성률과 구분해 주세요."
      footer={
        <Button variant="secondary" onClick={onClose}>
          닫기
        </Button>
      }
    >
      <div className="grid gap-6 sm:grid-cols-2">
        {runs.map((run) => (
          <section key={run.id} className="space-y-5 rounded-xl border border-line p-5">
            <div>
              <p className="text-xs text-muted">
                {run.projectName} · {run.dateLabel}
              </p>
              <h3 className="mt-2 text-base font-bold">{run.title}</h3>
            </div>
            {run.predictions.map((range, index) => (
              <div key={index} className="space-y-2">
                <p className="text-caption">
                  과업 {index + 1} · {range.join("~")}%
                </p>
                <div className="relative h-2 rounded bg-gray-100">
                  <span
                    className="absolute h-full rounded bg-subtle"
                    style={{ left: `${range[0]}%`, width: `${range[1] - range[0]}%` }}
                  />
                </div>
              </div>
            ))}
            <Link
              className={buttonVariants({ variant: "outline" })}
              to={buildPath("report", { projectId: run.projectId, runId: run.id })}
            >
              리포트 보기
            </Link>
          </section>
        ))}
      </div>
    </Modal>
  );
}
