import { useState } from "react";

import Icon from "@/components/Icon/Icon";
import { cn } from "@/utils/cn";

import type { StepRow } from "../utils/sessionView";

/*
  스텝 화면 캡처 (P15c 썸네일 · P15b 크게 보기 공용).
  캡처가 없거나 불러오지 못하면 이미지 아이콘 자리표시를 그립니다.
  임시: 문제 요소 위치(좌표) 필드가 아직 없어, 이탈 스텝에는 가운데에 빨간 박스만 표시합니다.
*/
export default function StepThumb({
  step,
  large = false,
  fit = true,
}: {
  step: StepRow;
  large?: boolean;
  fit?: boolean;
}) {
  /* 실패한 주소를 기억해 두어, 다른 스텝(주소)으로 바뀌면 다시 불러옵니다 */
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const src = step.screenshotUrl !== failedUrl ? step.screenshotUrl : null;
  return (
    <span
      className={cn(
        "relative flex items-center-safe justify-center-safe overflow-auto rounded-lg border border-dashed border-gray-300 bg-gray-50",
        large ? "h-120 w-full" : "h-25 w-40",
      )}
    >
      {src ? (
        <img
          src={src}
          onError={() => setFailedUrl(src)}
          alt={`스텝 ${step.step} 화면`}
          className={cn(fit || !large ? "size-full object-contain" : "max-w-none")}
        />
      ) : (
        <span className="flex flex-col items-center gap-1 text-xs text-muted">
          <Icon name="image" className={large ? "size-6" : "size-4"} />
          캡처 없음
        </span>
      )}
      {step.exit && (
        <span
          aria-hidden
          className={cn(
            "absolute border-2 border-danger",
            large ? "h-1/4 w-1/3" : "bottom-2 h-1/5 w-1/2",
          )}
        />
      )}
    </span>
  );
}
