import { useState } from "react";

import Button from "@/components/Button/Button";
import Modal from "@/components/Modal/Modal";
import SegmentedTabs from "@/components/SegmentedTabs/SegmentedTabs";

import type { StepRow } from "../utils/sessionView";

import StepThumb from "./StepThumb";

/* Figma P15b "진단 시점의 화면 · 스텝 n" — 화면에 맞춤 / 원본 크기 */
export default function ScreenModal({
  step,
  issueFields,
  onClose,
}: {
  step: StepRow | null;
  /* 이탈 원인이 입력 부담이면 관측한 필수 입력 칸 수 */
  issueFields: number | null;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"fit" | "original">("fit");

  return (
    <Modal
      open={step != null}
      onClose={onClose}
      size="xl"
      title={step ? `진단 시점의 화면 · 스텝 ${step.step}` : ""}
      description="AI 고객 실행 중 저장한 실제 브라우저 화면이에요 · 합성 테스트 데이터예요"
      footer={
        <div className="flex flex-1 items-center gap-4">
          <SegmentedTabs
            label="화면 크기"
            value={mode}
            onChange={setMode}
            options={[
              { value: "fit", label: "화면에 맞춤" },
              { value: "original", label: "원본 크기" },
            ]}
          />
          {step?.exit && (
            <p className="flex-1 text-xs text-muted">
              박스 = 문제가 된 요소 위치
              {issueFields ? ` (필수 입력 ${issueFields}칸)` : ""}
            </p>
          )}
          <Button className="ml-auto" onClick={onClose}>
            닫기
          </Button>
        </div>
      }
    >
      {step && <StepThumb step={step} large fit={mode === "fit"} />}
    </Modal>
  );
}
