import { useEffect, useState } from "react";

import Icon from "@/components/Icon/Icon";

import type { DiscoverPhase } from "../hooks/useNewTestMutations";

/* 이 시간이 지나면 "평소보다 오래 걸려요" 로 바꿉니다 (보통 1~2분) */
const SLOW_AFTER_SECONDS = 120;

const PHASE_TEXT: Record<DiscoverPhase, string> = {
  check: "사이트 주소에 접속하는 중이에요",
  /* Figma P02b 문구 */
  discover: "시작 화면의 메뉴와 기능을 읽는 중이에요",
  plan: "테스트 계획을 만드는 중이에요",
};

/* "0:42" */
const formatElapsed = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

/*
  P02b 사이트 확인 중 상태 띠 (Figma: 회색 띠 · 아이콘 + 13px 문구).
  탐색이 1~2분 걸려 멈춘 것처럼 보이지 않게
  - 회전하는 로딩 아이콘과 흐르는 진행 막대 (동작 줄이기 설정이면 멈춤)
  - 실제 단계(주소 확인 → 기능 탐색 → 계획 만들기) 문구
  - 지난 시간, 2분이 넘으면 오래 걸린다는 안내
  를 보여 줍니다. 단계가 바뀌면 화면 읽기 도구에도 알립니다(role=status).
  확인을 시작할 때 그려지고 끝나면 사라져, 시간은 그릴 때부터 셉니다.
*/
export default function SiteCheckProgress({ phase }: { phase: DiscoverPhase | null }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const startedAt = Date.now();
    const timer = window.setInterval(
      () => setElapsed(Math.floor((Date.now() - startedAt) / 1000)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, []);
  const slow = elapsed >= SLOW_AFTER_SECONDS;

  return (
    <div className="overflow-hidden rounded-lg bg-gray-50">
      <div className="flex items-center gap-2 p-3 text-caption">
        <Icon
          name="status-running"
          className="size-5 shrink-0 text-subtle motion-safe:animate-spin"
        />
        <span role="status" className="flex-1 font-bold text-ink">
          {PHASE_TEXT[phase ?? "check"]}
          {/* 2분이 넘으면 읽기 도구에도 한 번 알립니다 (보이는 문구는 오른쪽에) */}
          {slow && <span className="sr-only"> · 평소보다 오래 걸려요</span>}
        </span>
        <span className="shrink-0 text-xs text-muted tabular-nums">
          {formatElapsed(elapsed)} 지남 · {slow ? "평소보다 오래 걸려요" : "보통 1~2분 걸려요"}
        </span>
      </div>
      {slow && (
        <p className="px-3 pb-3 pl-10 text-xs text-muted">
          메뉴가 많거나 사이트 응답이 느리면 더 걸릴 수 있어요. 이 화면을 그대로 두면 이어서
          진행돼요.
        </p>
      )}
      {/* 끝을 알 수 없는 작업이라 흐르는 막대로 진행 중임만 보여 줍니다 */}
      <div aria-hidden className="relative h-0.5 bg-gray-200">
        <span className="absolute inset-y-0 left-0 w-1/3 bg-subtle motion-safe:animate-[site-check-progress_1.6s_ease-in-out_infinite]" />
      </div>
    </div>
  );
}
