import { useEffect, useState } from "react";

import characterDefault from "@/assets/characters/character-default.svg";
import Button from "@/components/Button/Button";
import Icon from "@/components/Icon/Icon";
import { useToastStore } from "@/stores/useToastStore";

import {
  COLLECT_ITEMS,
  INSTALL_CHECKS,
  NOT_COLLECT_ITEMS,
  SCRIPT_SNIPPET,
} from "../data/analyticsMock";
import { useAnalyticsMockStore } from "../data/useAnalyticsMockStore";

/* 설치 확인에 걸리는 시간 (임시: 실제로는 첫 이벤트가 올 때까지 기다립니다) */
const CHECK_MS = 1500;

type InstallState = "idle" | "checking" | "done" | "failed";

/* E03 실측 미연결 — 스크립트 한 줄로 실측을 모으도록 안내 */
export function NotConnected({ onConnect }: { onConnect: () => void }) {
  return (
    <section
      aria-labelledby="not-connected-title"
      className="flex flex-col items-center gap-2 py-16 text-center"
    >
      <img src={characterDefault} alt="" className="mb-10 h-40 w-auto" />
      <h2 id="not-connected-title" className="text-lg font-bold text-ink">
        실측 데이터가 아직 없어요
      </h2>
      <p className="text-sm text-subtle">스크립트 한 줄로 실측을 모아 예측과 비교해요</p>
      <Button variant="secondary" className="mt-4" onClick={onConnect}>
        실측 데이터 연결하기
      </Button>
    </section>
  );
}

/*
  R01~R04 실측 데이터 연결 — 1. 스크립트 설치 · 2. 설치 확인 · 3. 단계 매핑(설치 확인 뒤 열림).
  임시: 반찬로드·스튜디오 예약은 바로 성공(R03), 그 밖의 프로젝트는 처음 한 번 실패(R04)를 보여줍니다.
*/
export default function ConnectView({
  projectId,
  onMapping,
}: {
  projectId: string;
  onMapping: () => void;
}) {
  const [install, setInstall] = useState<InstallState>("idle");
  const [showAll, setShowAll] = useState(false);
  const failedOnce = useAnalyticsMockStore((state) => state.failedOnce[projectId] ?? false);

  useEffect(() => {
    if (install !== "checking") return;
    const timer = window.setTimeout(() => {
      const fails = !["banchan", "studio"].includes(projectId) && !failedOnce;
      if (fails) useAnalyticsMockStore.getState().markFailed(projectId);
      setInstall(fails ? "failed" : "done");
    }, CHECK_MS);
    return () => window.clearTimeout(timer);
  }, [install, projectId, failedOnce]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(SCRIPT_SNIPPET);
      useToastStore.getState().show("코드를 복사했어요");
    } catch {
      useToastStore.getState().show("복사하지 못했어요 · 코드를 직접 선택해 주세요", "info");
    }
  };

  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="install-title" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <h2 id="install-title" className="text-lg font-bold text-ink">
            1. 스크립트 설치
          </h2>
          <Button onClick={() => void copy()}>코드 복사</Button>
        </div>
        <p className="text-caption text-subtle">
          모든 페이지 &lt;head&gt;에 아래 한 줄을 넣어주세요
        </p>
        <code className="block overflow-x-auto rounded-lg bg-gray-50 p-3 text-caption text-ink">
          {SCRIPT_SNIPPET}
        </code>
        <div className="flex flex-col gap-2 text-caption">
          <p className="flex items-center gap-2 text-subtle">
            <span className="font-bold text-ink">모으는 것 · 모으지 않는 것</span>
            단계 진입만 익명 수집 · 개인정보·에이전트 제외
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
          <Button disabled={install === "checking"} onClick={() => setInstall("checking")}>
            {install === "checking" ? "확인 중…" : "설치 확인"}
          </Button>
        </div>
        <p className="text-caption text-subtle">설치 후 사이트를 열고 확인을 누르세요</p>
        <p role="status" className="flex items-center gap-2 rounded-lg bg-gray-50 p-3 text-caption">
          {install === "idle" && (
            <>
              <Icon name="circle" className="size-5 text-subtle" />
              <span className="text-subtle">아직 확인하지 않았어요</span>
            </>
          )}
          {install === "checking" && (
            <span className="font-bold text-ink">
              ··· 첫 이벤트 대기 중 · 사이트를 새 탭에서 열어보세요
            </span>
          )}
          {install === "done" && (
            <>
              <Icon name="status-done" className="size-5" />
              <span className="font-bold text-ink">첫 이벤트를 받았어요 · step_landing 14:38</span>
            </>
          )}
          {install === "failed" && (
            <>
              <Icon name="status-error" className="size-5 text-danger" />
              <span className="font-bold text-ink">5분 동안 이벤트가 오지 않았어요</span>
            </>
          )}
        </p>
        {install === "failed" && (
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

      <section
        aria-labelledby="mapping-title"
        className="flex items-center justify-between gap-4 rounded-xl bg-gray-50 p-4"
      >
        <div className="flex flex-col gap-2">
          <h2
            id="mapping-title"
            className={install === "done" ? "font-bold text-ink" : "text-subtle"}
          >
            3. 단계 매핑
          </h2>
          <p className="flex items-center gap-2 text-caption text-subtle">
            <Icon name={install === "done" ? "status-done" : "status-wait"} className="size-5" />
            {install === "done"
              ? "수집된 단계를 사전 테스트 퍼널에 연결해요"
              : "설치를 확인하면 열려요"}
          </p>
        </div>
        {install === "done" && <Button onClick={onMapping}>단계 매핑하기</Button>}
      </section>
    </div>
  );
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
