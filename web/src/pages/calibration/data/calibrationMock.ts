import { create } from "zustand";

/*
  ─── 임시: 보정(K01~K04) 하드코딩 목데이터 ───
  보정 API 명세가 아직 없어 Figma 화면 값을 그대로 옮겼습니다. 실제 계산값이 아닙니다.
  (새 테스트 위저드가 쓰는 보정 이력 GET /api/v1/projects/{id}/calibrations mock 과는 따로입니다)
  API 명세가 나오면 이 파일을 지우고 apis/·hooks/ 로 옮깁니다.
*/

/* 조정안이 있는 프로젝트 (그 밖은 E11 보정할 차이 없음) */
export const PROPOSAL_PROJECTS = ["1"];

export const PROPOSAL_BASIS = "3차 vs 실제 고객 데이터 7일 · 오차 4.5%p · 차이 구간 장바구니";

export const ERROR_SUMMARY = {
  before: 4.5,
  after: 2.1,
  stagesBefore: 1,
  stagesAfter: 0,
  stageCount: 6,
};

/* K01 조정안 표 · K02 바뀌는 값 */
export type Adjustment = {
  segment: string;
  item: string;
  current: string;
  proposed: string;
  reason: string;
};

export const ADJUSTMENTS: Adjustment[] = [
  {
    segment: "빠른 구매형",
    item: "인내심 임계치",
    current: "70",
    proposed: "62",
    reason: "실제 고객 데이터 장바구니 이탈이 예측보다 큼",
  },
  {
    segment: "신중한 첫 방문형",
    item: "인내심 임계치",
    current: "72",
    proposed: "66",
    reason: "실제 고객 데이터 장바구니 이탈이 예측보다 큼",
  },
  {
    segment: "전체",
    item: "불편한 점 가중치 · 긴 탐색",
    current: "1.0",
    proposed: "1.4",
    reason: "차이 구간 재현에서 탐색 실패가 가장 많음",
  },
  {
    segment: "전체",
    item: "불편한 점 가중치 · 비용 변화",
    current: "1.0",
    proposed: "1.1",
    reason: "재현에서 비용 충격 일부 확인",
  },
  {
    segment: "가격 민감형",
    item: "불편한 점 가중치 · 비용 변화",
    current: "1.2",
    proposed: "1.3",
    reason: "재현에서 비용 충격 일부 확인",
  },
  {
    segment: "꼼꼼한 비교형",
    item: "—",
    current: "—",
    proposed: "",
    reason: "실제 고객 데이터와 예측이 범위 안",
  },
];

/* K03 단계별 오차 · 보정 전 vs 후 (%p) */
export const STAGE_ERRORS: { stage: string; before: number; after: number; change: string }[] = [
  { stage: "탐색", before: -1.0, after: -0.8, change: "개선" },
  { stage: "상세", before: 0.0, after: 0.6, change: "비슷" },
  { stage: "장바구니", before: -16.0, after: -4.2, change: "차이 구간 해소" },
  { stage: "가입", before: -5.0, after: -2.1, change: "개선" },
  { stage: "결제 정보", before: -4.0, after: -2.0, change: "개선" },
  { stage: "완료", before: -1.0, after: -1.0, change: "같음" },
];

/* K03b 보정 이력 (적용하면 맨 위에 새 줄이 붙습니다) */
export type HistoryRow = { date: string; change: string; basis: string; error: string };

export const HISTORY: HistoryRow[] = [
  {
    date: "11월 5일",
    change: "빠른 구매형 인내심 75→70 · 입력 부담 불편한 점 1.0→1.2 · 비용 변화 0.9→1.0 (예시)",
    basis: "2차 vs 실제 고객 데이터 최근 7일",
    error: "7.8 → 4.5%p",
  },
  { date: "11월 1일", change: "첫 예측 맞추기 전 (기본 모델)", basis: "—", error: "—" },
];

/* K04 사람 관측 */
export const OBSERVATION_STAGES = ["랜딩", "탐색", "상세", "장바구니", "가입", "결제 정보", "완료"];
export const OBSERVATION_CAUSES = [
  "입력 부담",
  "탐색 실패",
  "비용 충격",
  "신뢰 부족",
  "기술 오류",
  "흥미 상실",
  "알 수 없음",
];
export const OBSERVATION_TASKS = ["첫 주문 완료", "쿠폰으로 주문"];

export type Observation = {
  participant: string;
  task: string;
  outcome: "success" | "dropout";
  stage: string | null;
  cause: string | null;
  /* 예측과 비교 (결과·단계·원인 각각). 표의 "예측과" 열은 결과 일치입니다 */
  matches: { outcome: boolean; stage: boolean; cause: boolean };
};

export const OBSERVATIONS: Observation[] = [
  {
    participant: "H-001",
    task: "첫 주문 완료",
    outcome: "dropout",
    stage: "가입",
    cause: "입력 부담",
    matches: { outcome: true, stage: true, cause: true },
  },
  {
    participant: "H-002",
    task: "첫 주문 완료",
    outcome: "success",
    stage: null,
    cause: null,
    matches: { outcome: true, stage: true, cause: false },
  },
  {
    participant: "H-003",
    task: "첫 주문 완료",
    outcome: "dropout",
    stage: "상세",
    cause: "탐색 실패",
    matches: { outcome: false, stage: false, cause: false },
  },
];

/* 임시 예측: 이탈 · 가입 · 입력 부담 (새 관측의 일치 판정용) */
export const PREDICTED = { outcome: "dropout", stage: "가입", cause: "입력 부담" } as const;

export function matchObservation(
  outcome: Observation["outcome"],
  stage: string | null,
  cause: string | null,
): Observation["matches"] {
  return {
    outcome: outcome === PREDICTED.outcome,
    stage: outcome === "dropout" && stage === PREDICTED.stage,
    cause: cause === PREDICTED.cause,
  };
}

/*
  화면 상태 — 보정 적용 여부·관측 목록을 기억해 화면을 오가도 남게 합니다 (새로고침하면 처음으로)
*/
type CalibrationMockState = {
  /* 모두 프로젝트 ID 별 (없으면 위 예시값) */
  appliedAt: Record<string, string>;
  history: Record<string, HistoryRow[]>;
  observations: Record<string, Observation[]>;
  apply: (projectId: string, at: Date) => void;
  saveObservation: (projectId: string, observation: Observation) => void;
};

/* 명세 5.2 처럼 같은 참여자라도 과업이 다르면 다른 관측입니다 */
export const sameObservation = (a: Observation, participant: string, task: string) =>
  a.participant === participant && a.task === task;

export const historyOf = (state: CalibrationMockState, projectId: string) =>
  state.history[projectId] ?? HISTORY;
export const observationsOf = (state: CalibrationMockState, projectId: string) =>
  state.observations[projectId] ?? OBSERVATIONS;

const dateLabel = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "long",
  day: "numeric",
});
const timeLabel = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function formatApplied(iso: string) {
  const date = new Date(iso);
  return `${dateLabel.format(date)} ${timeLabel.format(date)}`;
}

export const useCalibrationMockStore = create<CalibrationMockState>()((set) => ({
  appliedAt: {},
  history: {},
  observations: {},
  apply: (projectId, at) =>
    set((state) => ({
      appliedAt: { ...state.appliedAt, [projectId]: at.toISOString() },
      history: {
        ...state.history,
        [projectId]: [
          {
            date: dateLabel.format(at),
            change: ADJUSTMENTS.filter((row) => row.proposed)
              .map((row) => `${row.segment} ${row.item} ${row.current}→${row.proposed}`)
              .join(" · "),
            basis: "3차 vs 실제 고객 데이터 최근 7일",
            error: `${ERROR_SUMMARY.before} → ${ERROR_SUMMARY.after}%p`,
          },
          ...historyOf(state, projectId),
        ],
      },
    })),
  saveObservation: (projectId, observation) =>
    set((state) => {
      const list = observationsOf(state, projectId);
      const index = list.findIndex((item) =>
        sameObservation(item, observation.participant, observation.task),
      );
      const next =
        index < 0
          ? [...list, observation]
          : list.map((item, i) => (i === index ? observation : item));
      return { observations: { ...state.observations, [projectId]: next } };
    }),
}));
