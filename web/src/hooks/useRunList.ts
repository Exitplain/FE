import { useInfiniteQuery } from "@tanstack/react-query";

import { queryKeys } from "@/apis/queryKeys";
import { getRuns } from "@/apis/run.api";
import { ACTIVE_RUN_STATUSES, type RunItem } from "@/types/run.type";

import { POLLING_INTERVAL_MS } from "@/constants/polling";

const PAGE_SIZE = 20;

export function hasActiveRun(items: readonly RunItem[]) {
  return items.some((item) => ACTIVE_RUN_STATUSES.includes(item.status));
}

/*
  프로젝트 실행 목록 (GET /api/v1/projects/{id}/runs). 20개씩 받고 next_cursor 로 이어 받습니다.
  진행 중인 실행이 있을 때만 주기적으로 다시 받습니다. BE 에 SSE·WebSocket 은 없습니다.
  v1Id 가 없으면(제품 API 에 없는 프로젝트) 조회하지 않습니다.
*/
export function useRunList(v1Id: number | undefined) {
  return useInfiniteQuery({
    queryKey: queryKeys.runs.list(v1Id ?? -1),
    queryFn: ({ pageParam }) => getRuns(v1Id!, { cursor: pageParam, limit: PAGE_SIZE }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    enabled: v1Id !== undefined,
    refetchInterval: (query) =>
      hasActiveRun(query.state.data?.pages.flatMap((page) => page.items) ?? [])
        ? POLLING_INTERVAL_MS
        : false,
  });
}
