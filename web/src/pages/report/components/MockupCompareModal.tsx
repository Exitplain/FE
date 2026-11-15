import { artifactUrl } from "@/apis/persona.api";
import Button from "@/components/Button/Button";
import Icon from "@/components/Icon/Icon";
import Modal from "@/components/Modal/Modal";
import { CAUSE_LABELS, STAGE_LABELS } from "@/constants/persona";
import type { ReportFinding } from "@/types/persona.type";

function ImagePanel({
  title,
  note,
  artifactId,
  alt,
  empty,
}: {
  title: string;
  note: string;
  artifactId: string | null | undefined;
  alt: string;
  empty: string;
}) {
  return (
    <figure className="flex flex-1 flex-col gap-3">
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-bold text-ink">{title}</span>
        <span className="text-xs text-muted">{note}</span>
      </figcaption>
      {artifactId ? (
        <img
          src={artifactUrl(artifactId)}
          alt={alt}
          className="h-105 w-full rounded-lg border border-line object-contain"
        />
      ) : (
        /* 근거·목업 이미지가 없으면 만들어 채우지 않고 없다고 표시합니다 */
        <p className="flex h-105 items-center justify-center rounded-lg border border-dashed border-line bg-gray-50 text-xs text-muted">
          {empty}
        </p>
      )}
    </figure>
  );
}

/*
  P12b 현재 화면과 개선 가설 비교 (Figma Dialog · 960).
  왼쪽은 문제 시점의 실제 관측 화면, 오른쪽은 AI 가 만든 개선 목업(근거 아님)입니다.
  "크게 보기"는 관측 화면 원본을 새 탭으로 엽니다 (P15b 화면 크게 보기는 세션 상세 작업에서).
*/
export default function MockupCompareModal({
  finding,
  rank,
  onClose,
}: {
  finding: ReportFinding | null;
  rank: number;
  onClose: () => void;
}) {
  const evidence = finding?.evidence[0];
  const label = finding
    ? `Top 3 · ${rank} ${CAUSE_LABELS[finding.category]} · ${STAGE_LABELS[finding.stage]} 단계`
    : "";

  return (
    <Modal
      open={finding !== null}
      onClose={onClose}
      title="현재 화면과 개선 가설 비교"
      size="xl"
      footer={
        <>
          <Button
            variant="outline"
            disabled={!evidence?.artifact_id}
            onClick={() =>
              evidence?.artifact_id &&
              window.open(artifactUrl(evidence.artifact_id), "_blank", "noopener")
            }
          >
            크게 보기
          </Button>
          <Button onClick={onClose}>닫기</Button>
        </>
      }
    >
      <p className="text-sm text-subtle">{label}</p>
      <div className="flex gap-6">
        <ImagePanel
          title="현재 · 실제 관측 화면"
          note={evidence ? `스텝 ${evidence.steps_before} 캡처` : ""}
          artifactId={evidence?.artifact_id}
          alt="문제 시점의 실제 관측 화면"
          empty="캡처된 관측 화면이 없어요"
        />
        <ImagePanel
          title="개선 목업 · AI 생성 예시"
          note="근거 아님"
          artifactId={finding?.mockup?.artifact_id}
          alt="AI 가 만든 개선 목업 예시"
          empty="아직 만든 개선 목업이 없어요"
        />
      </div>
      <p className="flex items-center gap-2 rounded-lg bg-gray-50 p-3 text-caption text-subtle">
        <Icon name="image" className="size-5" />
        목업은 개선 가설을 보여주는 예시예요 · 실제 효과는 수정 후 재테스트로 확인하세요
      </p>
    </Modal>
  );
}
