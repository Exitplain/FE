import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useEffect, useRef, useState } from "react";

import { issueMeasurement } from "@/apis/measurement.api";
import { queryKeys } from "@/apis/queryKeys";
import characterDefault from "@/assets/characters/character-default.svg";
import Button from "@/components/Button/Button";
import Icon from "@/components/Icon/Icon";
import SegmentedTabs from "@/components/SegmentedTabs/SegmentedTabs";
import { useToastStore } from "@/stores/useToastStore";

import { COLLECT_ITEMS, INSTALL_CHECKS, NOT_COLLECT_ITEMS } from "../data/analyticsMock";
import { CHECK_TIMEOUT_MS, useMeasurement } from "../hooks/useMeasurement";
import CsvImportPanel from "./CsvImportPanel";

type InstallState = "idle" | "checking" | "failed";
type Method = "script" | "csv";

const METHODS = [
  { value: "script", label: "스크립트 설치" },
  { value: "csv", label: "CSV 올리기" },
] as const;

const timeFormat = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/* E03 실측 미연결 — 스크립트 한 줄로 실측을 모으도록 안내 */
export function NotConnected({ onConnect, onCsv }: { onConnect: () => void; onCsv?: () => void }) {
  return (
    <section
      aria-labelledby="not-connected-title"
      className="flex flex-col items-center gap-2 py-16 text-center"
    >
      <img src={characterDefault} alt="" className="mb-10 h-40 w-auto" />
      <h2 id="not-connected-title" className="text-lg font-bold text-ink">
        실제 고객 데이터가 아직 없어요
      </h2>
      <p className="text-sm text-subtle">
        스크립트 한 줄로 실제 고객 데이터를 모아 예측과 비교해요
      </p>
      <Button variant="secondary" className="mt-4" onClick={onConnect}>
        실제 고객 데이터 연결하기
      </Button>
      {onCsv && (
        <Button variant="link" className="text-caption" onClick={onCsv}>
          스크립트를 넣을 수 없으면 CSV 로 올려요
        </Button>
      )}
    </section>
  );
}

/* 배포 주소가 없는 프로젝트(코드만 받은 경우 등)는 실제 방문자가 없어 실측을 모을 수 없습니다 */
export function NotDeployed({ message, onCsv }: { message?: string; onCsv?: () => void }) {
  return (
    <section
      aria-labelledby="not-deployed-title"
      className="flex flex-col items-center gap-2 py-16 text-center"
    >
      <img src={characterDefault} alt="" className="mb-10 h-40 w-auto" />
      <h2 id="not-deployed-title" className="text-lg font-bold text-ink">
        배포된 사이트가 있어야 실제 고객 데이터를 모을 수 있어요
      </h2>
      <p className="text-sm text-subtle">
        {message ?? "실제 고객 데이터 분석은 실제 방문자가 오는 배포 주소가 있어야 해요."}
      </p>
      {onCsv && (
        <>
          <p className="text-sm text-subtle">
            다른 곳에 배포한 사이트의 방문 로그가 있으면 CSV 로 올려 비교할 수 있어요
          </p>
          <Button variant="secondary" className="mt-4" onClick={onCsv}>
            CSV 로 올리기
          </Button>
        </>
      )}
    </section>
  );
}

/*
  R01~R04 실측 데이터 연결 — 1. 스크립트 설치 · 2. 설치 확인 · 3. 단계 매핑(설치 확인 뒤 열림).
  키는 화면을 열 때 발급합니다 (이미 있으면 같은 키). 설치 확인은 첫 수집이 올 때까지 상태를 다시 받습니다.
  스크립트를 넣을 수 없으면 "CSV 올리기"로 방문 로그를 올립니다 (배포 주소가 없어도 됩니다). 올린 기록이 있으면
  단계 매핑이 열립니다.
*/
export default function ConnectView({
  projectId,
  siteUrl,
  onMapping,
  initialMethod,
}: {
  projectId: number;
  /* 처음 보여 줄 방법 (?method=csv). 배포 주소가 없으면 CSV 만 됩니다 */
  initialMethod?: Method;
  /* 프로젝트 사이트 주소. 설치 확인 때 새 탭으로 열 수 있게 링크로 둡니다 */
  siteUrl?: string;
  onMapping: () => void;
}) {
  const queryClient = useQueryClient();
  const [install, setInstall] = useState<InstallState>("idle");
  const [showAll, setShowAll] = useState(false);
  const status = useMeasurement(projectId, { polling: install === "checking" });
  const data = status.data;
  const installed = Boolean(data?.installed);
  const imported = (data?.imports?.count ?? 0) > 0;
  const [picked, setPicked] = useState<Method>(initialMethod ?? "script");
  const method: Method = data && !data.available ? "csv" : picked;
  const ready = installed || imported;

  const { mutate: issue, error: issueError } = useMutation({
    mutationFn: () => issueMeasurement(projectId),
    onSuccess: (next) => queryClient.setQueryData(queryKeys.measurement(projectId), next),
  });
  const issued = useRef(false);
  useEffect(() => {
    if (!data || !data.available || data.key || issued.current) return;
    issued.current = true;
    issue();
  }, [data, issue]);

  useEffect(() => {
    if (install !== "checking" || installed) return;
    const timer = window.setTimeout(() => setInstall("failed"), CHECK_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [install, installed]);

  const snippet = data?.snippet ?? null;
  const copy = async () => {
    if (!snippet) return;
    try {
      await navigator.clipboard.writeText(snippet);
      useToastStore.getState().show("코드를 복사했어요");
    } catch {
      useToastStore.getState().show("복사하지 못했어요 · 코드를 직접 선택해 주세요", "info");
    }
  };

  if (status.isError) {
    return (
      <div className="flex flex-col items-start gap-4 rounded-xl bg-gray-50 p-6">
        <p role="alert" className="text-sm text-subtle">
          {status.error.message}
        </p>
        <Button variant="secondary" onClick={() => void status.refetch()}>
          다시 불러오기
        </Button>
      </div>
    );
  }
  const checking = install === "checking" && !installed;

  return (
    <div className="flex flex-col gap-10">
      {data && !data.available ? (
        <p className="rounded-lg bg-gray-50 p-3 text-caption text-subtle">
          배포 주소가 없어 스크립트는 쓸 수 없어요 · 방문 로그를 CSV 로 올려 주세요
        </p>
      ) : (
        <SegmentedTabs
          label="연결 방법"
          options={METHODS}
          value={method}
          onChange={setPicked}
          className="self-start"
        />
      )}
      {method === "csv" ? (
        <CsvImportPanel projectId={projectId} />
      ) : (
        <ScriptSteps>
          <section aria-labelledby="install-title" className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-4">
              <h2 id="install-title" className="text-lg font-bold text-ink">
                1. 스크립트 설치
              </h2>
              <Button disabled={!snippet} onClick={() => void copy()}>
                코드 복사
              </Button>
            </div>
            <p className="text-caption text-subtle">
              모든 페이지 &lt;head&gt;에 아래 한 줄을 넣어주세요
            </p>
            <code className="block overflow-x-auto rounded-lg bg-gray-50 p-3 text-caption text-ink">
              {snippet ?? issueError?.message ?? "코드를 만드는 중이에요…"}
            </code>
            {data && data.origins.length > 0 && (
              <p className="text-caption text-subtle">
                {data.origins.join(", ")} 에서 온 수집만 받아요
              </p>
            )}
            <div className="flex flex-col gap-2 text-caption">
              <p className="flex items-center gap-2 text-subtle">
                <span className="font-bold text-ink">모으는 것 · 모으지 않는 것</span>
                화면 이동만 익명 수집 · 개인정보·AI 고객 제외
                <button
                  type="button"
                  aria-expanded={showAll}
                  onClick={() => setShowAll((open) => !open)}
                  className="text-ink underline underline-offset-4"
                >
                  {showAll ? "접기" : "항목 3개 더 보기"}
                </button>
              </p>
              {showAll && (
                <div className="grid grid-cols-2 gap-4">
                  <ItemList title="모으는 것" icon="check" items={COLLECT_ITEMS} />
                  <ItemList title="모으지 않는 것" icon="minus" items={NOT_COLLECT_ITEMS} />
                </div>
              )}
            </div>
          </section>

          <section aria-labelledby="verify-title" className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-4">
              <h2 id="verify-title" className="text-lg font-bold text-ink">
                2. 설치 확인
              </h2>
              <Button
                disabled={!snippet || checking}
                onClick={() => {
                  setInstall("checking");
                  void status.refetch();
                }}
              >
                {checking ? "확인 중…" : "설치 확인"}
              </Button>
            </div>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-subtle">
              코드를 넣고 사이트를 배포한 뒤, 사이트를 열고 확인을 누르세요
              {siteUrl && (
                <a
                  href={siteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-ink underline underline-offset-4"
                >
                  사이트 열기 ↗
                </a>
              )}
            </p>
            <p
              role="status"
              className="flex items-center gap-2 rounded-lg bg-gray-50 p-3 text-caption"
            >
              {installed && data ? (
                <>
                  <Icon name="status-done" className="size-5" />
                  <span className="font-bold text-ink">
                    수집을 받고 있어요 · {data.last_origin}{" "}
                    {data.last_received_at && timeFormat.format(new Date(data.last_received_at))}
                  </span>
                  <span className="text-subtle">
                    최근 24시간 {data.sessions_24h}회 방문 · {data.events_24h}건
                  </span>
                </>
              ) : checking ? (
                <span className="font-bold text-ink">
                  ··· 첫 수집 대기 중 · 코드를 넣고 배포한 사이트를 새 탭에서 열어보세요
                </span>
              ) : install === "failed" ? (
                <>
                  <Icon name="status-error" className="size-5 text-danger" />
                  <span className="font-bold text-ink">5분 동안 수집이 오지 않았어요</span>
                </>
              ) : (
                <>
                  <Icon name="circle" className="size-5 text-subtle" />
                  <span className="text-subtle">아직 받은 수집이 없어요</span>
                </>
              )}
            </p>
            {install === "failed" && !installed && (
              <ul aria-label="확인할 것" className="flex flex-col">
                {INSTALL_CHECKS.map((item) => (
                  <li
                    key={item}
                    className="flex items-center gap-2 border-b border-line py-3 text-caption text-gray-800 last:border-b-0"
                  >
                    <Icon name="circle" className="size-5 text-subtle" />
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </ScriptSteps>
      )}

      <section
        aria-labelledby="mapping-title"
        className="flex items-center justify-between gap-4 rounded-xl bg-gray-50 p-4"
      >
        <div className="flex flex-col gap-2">
          <h2 id="mapping-title" className={ready ? "font-bold text-ink" : "text-subtle"}>
            3. 단계 매핑
          </h2>
          <p className="flex items-center gap-2 text-caption text-subtle">
            <Icon name={ready ? "status-done" : "status-wait"} className="size-5" />
            {ready
              ? "수집된 단계를 사전 테스트 단계별 이동에 연결해요"
              : "설치를 확인하거나 CSV 를 올리면 열려요"}
          </p>
        </div>
        {ready && <Button onClick={onMapping}>단계 매핑하기</Button>}
      </section>
    </div>
  );
}

/* 스크립트 설치·설치 확인 두 단계를 한 묶음으로 (CSV 올리기와 바꿔 보여 줍니다) */
function ScriptSteps({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-10">{children}</div>;
}

function ItemList({
  title,
  icon,
  items,
}: {
  title: string;
  icon: "check" | "minus";
  items: string[];
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg bg-gray-50 p-3">
      <p className="font-bold text-ink">{title}</p>
      <ul className="flex flex-col gap-1">
        {items.map((item) => (
          <li key={item} className="flex items-center gap-2 text-gray-800">
            <Icon name={icon} className="size-4" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
