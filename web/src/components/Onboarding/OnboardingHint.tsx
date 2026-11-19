import { useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import Button from "@/components/Button/Button";
import { buttonVariants } from "@/components/Button/buttonVariants";
import Icon from "@/components/Icon/Icon";
import { ONBOARDING_STEPS, type OnboardingStep } from "@/constants/onboarding";
import { useAuthSession } from "@/hooks/useAuthSession";
import { useDemoSessionStore } from "@/stores/useDemoSessionStore";
import { onboardingAccountKey, useOnboardingStore } from "@/stores/useOnboardingStore";
import Coachmark from "./Coachmark";

/** Contextual help only: existing forms own validation, API calls and navigation. */
export default function OnboardingHint({
  step,
  projectId,
  report = false,
}: {
  step?: OnboardingStep;
  projectId?: string;
  report?: boolean;
}) {
  const { data: session } = useAuthSession();
  const key = onboardingAccountKey(session);
  const { tour, reportTips, dismiss, complete, dismissReport } = useOnboardingStore();
  const authDialog = useDemoSessionStore((state) => state.dialog);
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const marker = useRef<HTMLDivElement>(null);
  const active = report
    ? Boolean(key && projectId && reportTips[key] === projectId)
    : Boolean(tour && tour.accountKey === key);
  if (!active || authDialog) return null;
  const info = report
    ? {
        number: 1,
        title: "첫 리포트는 이렇게 확인하세요",
        description:
          "과업별 결과를 확인한 뒤 문제 화면과 세션별 행동 근거를 살펴보세요. AI 고객의 가상 이탈은 실제 고객 이탈률과 달라요. 실제 고객 데이터 연결과 비교는 이후에 진행해도 돼요.",
      }
    : ONBOARDING_STEPS[step ?? "intro"];
  const close = () => {
    if (report && key) dismissReport(key);
    else dismiss(key);
  };
  const params = new URLSearchParams(location.search);
  params.set("create", "1");
  return (
    <>
      <div
        ref={marker}
        className="empty:hidden"
        data-onboarding-marker={report ? "report" : step}
      />
      <Coachmark marker={marker} step={step} report={report} collapsed={collapsed}>
        <section
          aria-label={report ? "리포트 사용 안내" : "첫 테스트 준비 안내"}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              close();
            }
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted">{report ? "리포트 안내" : "첫 테스트 준비"}</p>
            <div className="flex gap-3 text-xs">
              <button
                type="button"
                className="underline"
                aria-expanded={!collapsed}
                onClick={() => setCollapsed((value) => !value)}
              >
                {collapsed ? "안내 펼치기" : "안내 접기"}
              </button>
              <button
                type="button"
                className="rounded p-1 text-muted hover:bg-gray-50"
                aria-label={report ? "확인했어요" : "안내 종료"}
                onClick={close}
              >
                <Icon name="close" />
              </button>
            </div>
          </div>
          {!collapsed && (
            <div className="mt-3 space-y-3">
              <h2 className="text-sm font-bold">{info.title}</h2>
              <p className="text-sm leading-6 text-subtle">{info.description}</p>
              {step === "intro" && (
                <Link
                  className={buttonVariants({ variant: "primary" })}
                  to={{ pathname: location.pathname, search: `?${params}`, hash: location.hash }}
                >
                  새 프로젝트 열기
                </Link>
              )}
              {step === "ready" && projectId && (
                <Button onClick={() => complete(key, projectId)}>준비 안내 마치기</Button>
              )}
              <div className="flex items-center justify-between text-xs text-muted">
                <span>{report ? "결과 확인" : `${info.number} / 7`}</span>
                <span>실제 화면에서 진행하세요</span>
              </div>
            </div>
          )}
        </section>
      </Coachmark>
    </>
  );
}
