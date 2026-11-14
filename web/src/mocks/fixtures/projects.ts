import type { ProjectOverview } from "@/types/project.type";

/* C05/C06의 예시 수치. 화면 컴포넌트에는 값이나 샘플 프로젝트 ID를 넣지 않습니다. */
export function emptyProjectOverview(): ProjectOverview {
  return {
    phase: 1,
    connection: null,
    test: { status: null, title: null, prediction: null, maxDropOff: null, dateLabel: null },
    analytics: {
      status: "unconnected",
      landingSessions: null,
      completedSessions: null,
      completionRate: null,
      maxDropOff: null,
    },
    calibration: {
      status: "before",
      meanErrorPp: null,
      segments: null,
      values: null,
      appliedLabel: null,
    },
  };
}

export const projectOverviewFixtures: Record<string, ProjectOverview> = {
  banchan: {
    phase: 3,
    connection: { startPath: "/cart", expiresLabel: "11월 15일" },
    test: {
      status: "completed",
      title: "첫 주문 완료 · 3차",
      prediction: [20, 30],
      maxDropOff: "장바구니 → 가입",
      dateLabel: "11월 7일",
    },
    analytics: {
      status: "comparable",
      landingSessions: 1240,
      completedSessions: 298,
      completionRate: 24,
      maxDropOff: "상세 → 장바구니",
    },
    calibration: {
      status: "proposal",
      meanErrorPp: 4.5,
      segments: 4,
      values: 6,
      appliedLabel: null,
    },
  },
  studio: {
    ...emptyProjectOverview(),
    test: {
      status: "running",
      title: "예약 완료 · 1차",
      prediction: null,
      maxDropOff: null,
      dateLabel: "14:40",
    },
  },
  phone: {
    ...emptyProjectOverview(),
    phase: 2,
    test: {
      status: "failed",
      title: "매입 신청 · 1차",
      prediction: null,
      maxDropOff: null,
      dateLabel: "11월 2일",
    },
    analytics: { ...emptyProjectOverview().analytics, status: "collecting" },
  },
};
