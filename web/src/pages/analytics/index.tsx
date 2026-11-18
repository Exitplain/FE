import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import Button from "@/components/Button/Button";
import ProjectPageHeader from "@/components/ProjectPageHeader/ProjectPageHeader";
import StatusBadge from "@/components/StatusBadge/StatusBadge";
import { useCurrentProject, type CurrentProject } from "@/components/Projects/currentProject";
import { buildPath } from "@/constants/routes";

import CompareView from "./components/CompareView";
import ConnectView, { NotConnected, NotDeployed } from "./components/ConnectView";
import FunnelView from "./components/FunnelView";
import MappingStep from "./components/MappingStep";
import {
  ReproduceResult,
  ReproduceRunning,
  type ReproduceSession,
  ReproduceSetup,
} from "./components/ReproduceViews";
import {
  COMPARE_TASKS,
  type Device,
  type Period,
  REPRODUCE_OUTCOMES,
  REPRODUCE_SEGMENTS,
} from "./data/analyticsMock";
import { useAnalyticsMockStore, useConnectionStatus } from "./data/useAnalyticsMockStore";
import { useMeasurement } from "./hooks/useMeasurement";

/* 화면 안 단계 (?view=). 주소에 두어 새로고침·뒤로가기로 돌아올 수 있게 합니다 */
const VIEWS = [
  "connect",
  "mapping",
  "funnel",
  "compare",
  "reproduce",
  "reproducing",
  "result",
] as const;
type View = (typeof VIEWS)[number];

/* 재현 진행 한 단계 간격 · 동시 실행 수 (임시: 시간으로 흉내) */
const TICK_MS = 500;
const CONCURRENCY = 8;

const dayFormat = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "long",
  day: "numeric",
});

/*
  R01~R11 실측 분석 (/projects/:projectId/analytics?view=)
  설치(R01~R04)·단계 매핑(R05)은 실제 API(BE measurements)를 씁니다. 퍼널(R06) 이후는 아직 하드코딩 목데이터(data/analyticsMock.ts)입니다.
  - 배포 주소 없음: 실측 불가 안내 (코드만 받은 프로젝트 등)
  - 미연결: E03 → 연결(R01~R04) → 단계 매핑(R05) → 수집 중(E09)
  - 연결됨: 실측 퍼널(R06·R07) → 예측 vs 실측(R08) → 원인 재현(R09~R11) → 보정(K01)
*/
export default function AnalyticsPage() {
  const project = useCurrentProject();
  return <Analytics key={project.id} project={project} />;
}

function Analytics({ project }: { project: CurrentProject }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const status = useConnectionStatus(project.id);
  /* 미연결 프로젝트는 배포 주소가 있는지(실측 가능 여부)를 먼저 봅니다 */
  const measurement = useMeasurement(project.v1Id, { enabled: status === "unconnected" });
  const requested = searchParams.get("view");
  const parsed = (VIEWS as readonly string[]).includes(requested ?? "")
    ? (requested as View)
    : null;
  /* 미연결 프로젝트는 연결·매핑 말고는 데이터가 없어 E03 으로 보냅니다 */
  const view: View | null =
    status === "unconnected"
      ? parsed === "connect" || parsed === "mapping"
        ? parsed
        : null
      : (parsed ?? "funnel");

  const [period, setPeriod] = useState<Period>("7");
  const [device, setDevice] = useState<Device>("all");
  const [taskId, setTaskId] = useState(COMPARE_TASKS[0].id);
  const [gapStage, setGapStage] = useState("장바구니");
  const [segments, setSegments] = useState(REPRODUCE_SEGMENTS.map((segment) => segment.id));
  const [sessions, setSessions] = useState<ReproduceSession[]>([]);

  const goTo = (next: View | null) => {
    setSearchParams(next ? { view: next } : {});
    window.scrollTo({ top: 0 });
  };

  /* R10: 대기 → 진행 중 → 결과 순으로 바꾸고, 모두 끝나면 결과(R11)로 넘어갑니다 */
  useEffect(() => {
    if (view !== "reproducing") return;
    const timer = window.setInterval(() => {
      setSessions((current) => {
        const next = current.map((session, index): ReproduceSession => {
          if (session.status === "running") {
            return { ...session, status: REPRODUCE_OUTCOMES[index % REPRODUCE_OUTCOMES.length] };
          }
          return session;
        });
        let slots = CONCURRENCY - next.filter((session) => session.status === "running").length;
        return next.map((session) => {
          if (session.status !== "queued" || slots <= 0) return session;
          slots -= 1;
          return { ...session, status: "running" };
        });
      });
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [view]);

  const reproduceDone =
    sessions.length > 0 &&
    sessions.every((session) => session.status === "success" || session.status === "dropout");
  useEffect(() => {
    if (view !== "reproducing" || !reproduceDone) return;
    const timer = window.setTimeout(
      () => setSearchParams({ view: "result" }, { replace: true }),
      TICK_MS,
    );
    return () => window.clearTimeout(timer);
  }, [view, reproduceDone, setSearchParams]);

  const startReproduce = () => {
    let code = 0;
    setSessions(
      REPRODUCE_SEGMENTS.filter((segment) => segments.includes(segment.id)).flatMap((segment) =>
        Array.from({ length: segment.count }, () => {
          code += 1;
          return {
            code: `P-${String(code).padStart(3, "0")}`,
            segment: segment.name,
            status: "queued" as const,
          };
        }),
      ),
    );
    goTo("reproducing");
  };

  const compareTask = COMPARE_TASKS.find((task) => task.id === taskId) ?? COMPARE_TASKS[0];
  const gapRow = compareTask.rows.find((row) => row.stage === gapStage);
  const gapText = gapRow
    ? `${gapRow.stage} · 실측 ${gapRow.actual.toFixed(1)}% · 예측 ${gapRow.predicted[0]}~${gapRow.predicted[1]}% (${(gapRow.actual - (gapRow.predicted[0] + gapRow.predicted[1]) / 2).toFixed(1).replace("-", "−")}%p)`
    : gapStage;
  const panel = sessions.length || 20;

  const unlinkBadge = <StatusBadge icon="unlink" label="미연결" tone="strong" />;
  const crumb = `${project.name} / 실측 분석 · 테스트`;
  const reproduceCrumb = `${project.name} / 실측 분석 / 예측 vs 실측 · 테스트`;

  if (view === null) {
    return (
      <div className="flex flex-col gap-12">
        <ProjectPageHeader
          projectId={project.id}
          breadcrumb={`${project.name} · 테스트`}
          title={project.name}
          description={project.url}
          actions={unlinkBadge}
          activeTab="analytics"
        />
        {measurement.data && !measurement.data.available ? (
          <NotDeployed message={measurement.data.message} />
        ) : (
          <NotConnected onConnect={() => goTo("connect")} />
        )}
      </div>
    );
  }

  if (view === "connect") {
    return (
      <div className="flex flex-col gap-12">
        <ProjectPageHeader
          projectId={project.id}
          breadcrumb={crumb}
          title="실측 데이터 연결"
          description="실제 사용자 퍼널로 예측이 맞았는지 확인해요"
          actions={unlinkBadge}
          activeTab="analytics"
        />
        <ConnectView projectId={project.v1Id} onMapping={() => goTo("mapping")} />
      </div>
    );
  }

  if (view === "mapping") {
    return (
      <MappingStep
        projectId={project.v1Id}
        breadcrumb={crumb}
        onCancel={() => goTo(status === "unconnected" ? "connect" : "funnel")}
        onSaved={() => {
          useAnalyticsMockStore.getState().connect(project.id);
          goTo("funnel");
        }}
      />
    );
  }

  if (view === "funnel") {
    const collecting = status !== "comparable";
    return (
      <div className="flex flex-col gap-12">
        <ProjectPageHeader
          projectId={project.id}
          breadcrumb={crumb}
          title="실측 퍼널"
          description={
            collecting
              ? "설치 3일째 · 마지막 수신 14:38"
              : device === "all"
                ? "실제 사용자 · 에이전트 제외 · 마지막 수신 14:38"
                : "실제 사용자 · 최근 7일"
          }
          actions={
            <>
              {collecting ? (
                <StatusBadge icon="more" label="수집 중" tone="muted" />
              ) : (
                <StatusBadge icon="activity" label="비교 가능" tone="muted" />
              )}
              <Button onClick={() => goTo("compare")}>예측과 비교하기</Button>
            </>
          }
          activeTab="analytics"
        />
        <FunnelView
          collecting={collecting}
          period={period}
          device={device}
          onPeriodChange={setPeriod}
          onDeviceChange={setDevice}
        />
      </div>
    );
  }

  if (view === "compare") {
    return (
      <div className="flex flex-col gap-12">
        <ProjectPageHeader
          projectId={project.id}
          breadcrumb={crumb}
          title="예측 vs 실측"
          description="오차 = 실측 − 예측 범위 중앙값"
          activeTab="analytics"
        />
        <CompareView
          period={period}
          onPeriodChange={setPeriod}
          taskId={taskId}
          onTaskChange={setTaskId}
          onReproduce={(stage) => {
            setGapStage(stage);
            goTo("reproduce");
          }}
        />
      </div>
    );
  }

  if (view === "reproduce") {
    return (
      <div className="flex flex-col gap-12">
        <ProjectPageHeader
          projectId={project.id}
          breadcrumb={reproduceCrumb}
          title={`원인 재현 · ${gapStage}`}
          actions={
            <>
              <Button variant="secondary" onClick={() => goTo("compare")}>
                취소
              </Button>
              <Button disabled={segments.length === 0} onClick={startReproduce}>
                재현 시작
              </Button>
            </>
          }
          activeTab="analytics"
        />
        <ReproduceSetup
          stage={gapStage}
          gapText={gapText}
          selected={segments}
          onToggle={(id) =>
            setSegments((current) =>
              current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
            )
          }
        />
      </div>
    );
  }

  if (view === "reproducing") {
    return (
      <div className="flex flex-col gap-12">
        <ProjectPageHeader
          projectId={project.id}
          breadcrumb={reproduceCrumb}
          title={`원인 재현 · ${gapStage}`}
          description={`상세 → ${gapStage}만 실행 · ${panel}명 × 시드 3회 (1/3)`}
          actions={<StatusBadge icon="play" label="실행 중" tone="strong" />}
          activeTab="analytics"
        />
        {sessions.length > 0 ? (
          <ReproduceRunning sessions={sessions} />
        ) : (
          /* 새로고침 등으로 진행 상태를 잃으면 설정부터 다시 */
          <div className="flex flex-col items-start gap-4 rounded-xl bg-gray-50 p-6">
            <p className="text-sm text-subtle">
              재현 진행 상태가 없어요. 설정에서 다시 시작해 주세요.
            </p>
            <Button variant="secondary" onClick={() => goTo("reproduce")}>
              재현 설정
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-12">
      <ProjectPageHeader
        projectId={project.id}
        breadcrumb={reproduceCrumb}
        title={`원인 재현 · ${gapStage}`}
        description={`${dayFormat.format(new Date())} · 상세 → ${gapStage} 구간 · ${panel}명 × 시드 3회`}
        actions={
          <>
            <Button variant="secondary" onClick={() => goTo("reproduce")}>
              다시 재현
            </Button>
            <Button onClick={() => navigate(buildPath("calibration", { projectId: project.id }))}>
              조정안 확인
            </Button>
          </>
        }
        activeTab="analytics"
      />
      <ReproduceResult />
    </div>
  );
}
