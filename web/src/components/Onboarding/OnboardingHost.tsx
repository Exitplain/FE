import { useEffect } from "react";
import { matchPath, useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { ROUTES } from "@/constants/routes";
import { useAuthSession } from "@/hooks/useAuthSession";
import { useDemoSessionStore } from "@/stores/useDemoSessionStore";
import { onboardingAccountKey, useOnboardingStore } from "@/stores/useOnboardingStore";

import OnboardingHint from "./OnboardingHint";

export default function OnboardingHost() {
  const { data: session, isPending } = useAuthSession();
  const key = onboardingAccountKey(session);
  const { tour, start, complete } = useOnboardingStore();
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
    if (pathname !== ROUTES.guide.path || params.get("tutorial") !== "1" || isPending) return;
    start(key);
    const next = new URLSearchParams(params);
    next.delete("tutorial");
    navigate(
      { pathname, search: next.toString() ? `?${next}` : "", hash },
      { replace: true, preventScrollReset: true },
    );
  }, [params, isPending, key, start, navigate, pathname, hash]);

  if (authDialog || params.has("create") || pathname === ROUTES.privacy.path) return null;
  if (!activeTour) return null;

  return runRoute ||
    matchPath(ROUTES.projectDetail.path, pathname) ||
    matchPath(ROUTES.testList.path, pathname) ||
    matchPath(ROUTES.newTest.path, pathname) ? null : (
    <OnboardingHint step="intro" />
  );
}
