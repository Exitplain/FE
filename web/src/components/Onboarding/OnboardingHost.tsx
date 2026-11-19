import { useEffect } from "react";
import { matchPath, useLocation, useNavigate, useSearchParams } from "react-router-dom";

import plane from "@/assets/workspace/todo-plane.svg";
import Button from "@/components/Button/Button";
import Modal from "@/components/Modal/Modal";
import { ROUTES } from "@/constants/routes";
import { useAuthSession } from "@/hooks/useAuthSession";
import { useDemoSessionStore } from "@/stores/useDemoSessionStore";
import { onboardingAccountKey, useOnboardingStore } from "@/stores/useOnboardingStore";

import OnboardingHint from "./OnboardingHint";

export default function OnboardingHost() {
  const { data: session, isPending } = useAuthSession();
  const key = onboardingAccountKey(session);
  const { accounts, tour, start, dismiss, complete } = useOnboardingStore();
  const authDialog = useDemoSessionStore((state) => state.dialog);
  const { pathname, hash } = useLocation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const activeTour = tour?.accountKey === key ? tour : null;
  const runRoute =
    matchPath(ROUTES.testRun.path, pathname) ?? matchPath(ROUTES.report.path, pathname);
  const runProjectId = runRoute?.params.projectId;

  // Only observe successful navigation; never start a run on behalf of the user.
  useEffect(() => {
    if (activeTour && runProjectId && !authDialog && !isPending) complete(key, runProjectId);
  }, [activeTour, runProjectId, key, complete, authDialog, isPending]);

  useEffect(() => {
    if (params.get("tutorial") !== "1" || isPending) return;
    start(key);
    const next = new URLSearchParams(params);
    next.delete("tutorial");
    navigate(
      { pathname, search: next.toString() ? `?${next}` : "", hash },
      { replace: true, preventScrollReset: true },
    );
  }, [params, isPending, key, start, navigate, pathname, hash]);

  if (authDialog || params.has("create") || pathname === ROUTES.privacy.path) return null;
  const welcome = Boolean(
    key && !accounts[key] && pathname === ROUTES.dashboard.path && !isPending,
  );
  if (!activeTour && !welcome) return null;
  const close = () => dismiss(key);

  if (activeTour)
    return runRoute ||
      matchPath(ROUTES.projectDetail.path, pathname) ||
      matchPath(ROUTES.testList.path, pathname) ||
      matchPath(ROUTES.newTest.path, pathname) ? null : (
      <OnboardingHint step="intro" />
    );

  return (
    <Modal
      open
      onClose={close}
      size="sm"
      title="Exitplain이 처음이신가요?"
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            나중에
          </Button>
          <Button onClick={() => start(key)}>튜토리얼 시작</Button>
        </>
      }
    >
      <div className="flex items-center gap-6 rounded-2xl bg-gray-50 p-6">
        <img src={plane} alt="" className="hidden h-auto w-24 shrink-0 sm:block" />
        <p className="text-sm leading-6 text-subtle">
          내 사이트로 첫 테스트를 준비하는 과정을 도와드릴게요.
          <br />
          사이트 등록부터 실행 직전까지 실제 작업에 맞춰 안내해요.
        </p>
      </div>
      <p className="text-xs text-muted">
        직접 누른 등록·탐색·저장은 실제로 처리돼요. 테스트 실행은 마지막에 직접 결정해요.
      </p>
    </Modal>
  );
}
