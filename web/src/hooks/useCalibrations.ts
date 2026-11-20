import { useQuery } from "@tanstack/react-query";

import { getCalibrations } from "@/apis/calibration.api";
import { queryKeys } from "@/apis/queryKeys";

/* 보정 이력 (최신순) — P05b·P05c "보정 n월 n일 적용", K03b 이력에서 함께 씁니다 */
export function useCalibrations(projectId: string) {
  return useQuery({
    queryKey: queryKeys.calibration.history(projectId),
    queryFn: () => getCalibrations(projectId),
  });
}
