import { useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import Button from "@/components/Button/Button";
import Field from "@/components/Field/Field";
import Icon from "@/components/Icon/Icon";
import Input from "@/components/Input/Input";
import { useNewTestStore } from "@/stores/useNewTestStore";

import type { ApiError } from "@/types/api.type";

import {
  useDiscoverPlan,
  useSaveTestAccounts,
  useTestAccounts,
} from "../hooks/useNewTestMutations";
import { validateSiteUrl } from "../utils/newTest";
import AccountModal from "./AccountModal";
import SiteCheckProgress from "./SiteCheckProgress";
import StepSection, { StatusRow, StepFooter } from "./StepSection";

type SiteStepProps = {
  /* 제품 API 프로젝트 id */
  projectId: number;
  /* 만료 등으로 돌아왔을 때 위에 보여줄 안내 */
  notice: string | null;
  /* 사이트 확인이 성공했을 때 */
  onDiscovered: () => void;
  onNext: () => void;
};

/* E08 접속 시각 "14:21" (서울 시간) */
const timeFormat = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/*
  P02 사이트 · P02b 확인 중 · P03 확인 완료 · E07 잘못된 URL · E08 접근 불가 (Figma Section/Site)
  - "확인"은 주소 확인(check) → 기능 탐색(discoveries) → 계획 만들기(plans) 순서로 부릅니다.
    탐색은 서버가 브라우저로 시작 화면을 읽어 수 초 걸립니다. 주소는 프로젝트에 등록한 사이트여야 합니다.
    데모 버전(variant)은 Figma 에 없어 화면에서 고르지 않고 "문제 버전"으로 확인합니다(스토어 기본값).
  - 주소 확인이 실패해도 탐색은 진행하고 경고만 보여 줍니다 (응답 시간은 주소 확인 결과).
  - 로그인 방식·계정 수를 바꾸면 탐색(login_mode)과 에이전트 수가 달라져, "다음"에서 다시 확인합니다.
  - 확인하는 동안 주소를 잠가, 이전 요청의 응답이 바뀐 입력의 결과로 들어가지 않게 합니다.
  - 로그인 연결은 사이트 확인이 끝난 뒤(P03)에 나옵니다. 테스트 계정과 로그인 화면 주소를 서버에 저장(P04)하면
    에이전트가 그 화면에서 로그인한 뒤 사이트를 확인하고 실행합니다.
*/
export default function SiteStep({
  projectId: v1ProjectId,
  notice,
  onDiscovered,
  onNext,
}: SiteStepProps) {
  const { projectId, siteUrl, variant, loginMode, accountCount, plan } = useNewTestStore(
    useShallow((state) => ({
      projectId: state.projectId,
      siteUrl: state.siteUrl,
      variant: state.variant,
      loginMode: state.loginMode,
      accountCount: state.accounts.length,
      plan: state.plan,
    })),
  );
  const actions = useNewTestStore.getState();
  /*
    서버에 이미 저장된 테스트 계정을 한 번 받아 둡니다 (비밀번호는 없음).
    에이전트 수를 서버와 맞추고, 계정 저장(목록 전체 교체)이 기존 계정을 지우지 않게 하려는 것입니다.
    화면의 계정이 모두 서버에 저장된 것(id 있음)이면 새로 받은 목록으로 바꿉니다
    (확정 직전 다른 곳에서 계정이 바뀌어 다시 받는 경우 — 저장된 비밀번호는 서버가 유지합니다).
    아직 저장하지 않은 계정(id 없음)이 있으면 입력을 지우지 않게 건드리지 않습니다.
  */
  const savedAccounts = useTestAccounts(v1ProjectId);
  const accountsLoaded = useRef(false);
  useEffect(() => {
    /* 캐시가 store 보다 오래됐을 수 있어 들어올 때 새로 받은 응답으로만 맞춥니다 */
    if (accountsLoaded.current || !savedAccounts.isSuccess || savedAccounts.isFetching) return;
    accountsLoaded.current = true;
    const items = savedAccounts.data?.items ?? [];
    const local = useNewTestStore.getState().accounts;
    if (!local.every((account) => account.id)) return;
    if (items.length === 0 && local.length === 0) return;
    useNewTestStore
      .getState()
      .setAccounts(
        [...items]
          .sort((a, b) => a.position - b.position)
          .map((item) => ({ id: item.id, username: item.username, password: "" })),
      );
  }, [savedAccounts.isSuccess, savedAccounts.isFetching, savedAccounts.data]);
  const discover = useDiscoverPlan();
  const saveAccounts = useSaveTestAccounts();
  const [urlError, setUrlError] = useState<string | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [failedAt, setFailedAt] = useState<Date | null>(null);
  const isChecking = discover.isPending;

  /* thenNext: "다음"을 눌렀는데 아직 확인 전이면 확인이 끝난 뒤 바로 다음 단계로 갑니다 */
  const check = (thenNext = false) => {
    if (isChecking) return;
    const error = validateSiteUrl(siteUrl);
    setUrlError(error);
    if (error) return;
    /* 프로젝트가 바뀐 뒤 같은 주소로 돌아온 결과가 새 프로젝트에 들어가지 않게 프로젝트도 비교합니다 */
    const requested = { projectId, siteUrl, variant, loginMode, accountCount };
    const same = (current: ReturnType<typeof useNewTestStore.getState>) =>
      current.projectId === requested.projectId &&
      current.siteUrl === requested.siteUrl &&
      current.variant === requested.variant &&
      current.loginMode === requested.loginMode &&
      current.accounts.length === requested.accountCount;
    discover.mutate(
      { projectId: v1ProjectId, entryUrl: siteUrl.trim(), loginMode, variant },
      {
        onSuccess: (result) => {
          /* 응답을 기다리는 사이 입력이 바뀌었다면 이 결과는 버립니다 */
          const current = useNewTestStore.getState();
          if (!same(current)) return;
          current.setPlan(result.plan, result.server);
          onDiscovered();
          if (thenNext) onNext();
        },
        /* 다시 확인이 실패하면 이전 결과로 다음 단계에 가지 않도록 지웁니다 */
        onError: () => {
          setFailedAt(new Date());
          const current = useNewTestStore.getState();
          if (same(current)) current.clearPlan();
        },
      },
    );
  };

  /*
    E08 접근 불가는 서버가 사이트를 열지 못한 5xx(503 SITE_UNREACHABLE) 만.
    401 은 로그인, 403 은 이 프로젝트 권한(샘플 프로젝트 등), 그 밖의 4xx 는 서버 메시지, 0 은 서버 연결 실패
  */
  const errorStatus = discover.error?.status ?? null;
  const unreachable = errorStatus != null && errorStatus >= 500;
  const errorText =
    errorStatus === 401
      ? "로그인이 필요해요"
      : errorStatus === 403
        ? "이 프로젝트에서는 실행할 수 없어요"
        : `사이트를 확인하지 못했어요 · ${discover.error?.message ?? ""}`;

  /*
    로그인 방식이 탐색할 때와 달라졌거나, 테스트 계정 모드에서 계정 수가 서버 총원과 달라지면
    "다음"에서 다시 확인합니다 (서버는 저장된 계정 수로 에이전트 수를 정함).
  */
  const desiredLoginMode = loginMode === "account" ? "test_account" : "none";
  const stale =
    plan != null &&
    (plan.loginMode !== desiredLoginMode ||
      (desiredLoginMode === "test_account" && plan.personaTotal !== accountCount));
  /* 테스트 계정이 모자라 탐색하지 못했을 때도 로그인 연결을 바꿀 수 있게 둡니다 */
  const accountsRequired = discover.error?.code === "TEST_ACCOUNTS_REQUIRED";

  const checkFailed = plan?.check?.status === "failed";
  const reachable = [
    "접근 가능",
    plan?.check?.elapsed_ms != null ? `응답 ${(plan.check.elapsed_ms / 1000).toFixed(1)}초` : null,
    plan ? `기능 ${plan.features.length}개 찾음` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-col gap-12">
      {notice && (
        <StatusRow>
          <Icon name="info" className="size-5" />
          <span className="font-bold text-ink">{notice}</span>
        </StatusRow>
      )}

      <StepSection title="대상 사이트">
        <div className="flex items-end gap-3">
          <Field label="제품 URL" hint="필수" error={urlError ?? undefined} className="flex-1">
            {(control) => (
              <Input
                {...control}
                type="url"
                inputMode="url"
                disabled={isChecking}
                value={siteUrl}
                onChange={(event) => {
                  actions.setSiteUrl(event.target.value);
                  setUrlError(null);
                  /* 새 주소는 아직 확인 전이라 이전 실패 안내를 지웁니다 */
                  if (discover.isError) {
                    discover.reset();
                    setFailedAt(null);
                  }
                }}
                onKeyDown={(event) => {
                  /* 한글 조합 중 Enter(Safari 는 keyCode 229)는 글자 확정이라 무시합니다 */
                  if (
                    event.key !== "Enter" ||
                    event.nativeEvent.isComposing ||
                    event.keyCode === 229
                  ) {
                    return;
                  }
                  check();
                }}
              />
            )}
          </Field>
          <Button
            variant="secondary"
            onClick={() => check()}
            disabled={isChecking}
            className={urlError ? "mb-6" : undefined}
          >
            {isChecking ? "확인 중…" : plan || discover.isError ? "다시 확인" : "확인"}
          </Button>
        </div>

        {/* 상태 띠: 확인 전 안내 → 확인 중 → 접근 가능 / 접근 불가(E08) */}
        {isChecking ? (
          <SiteCheckProgress phase={discover.phase} />
        ) : discover.isError ? (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-lg bg-gray-50 p-3 text-caption"
          >
            <Icon name="status-error" className="size-5 text-danger" />
            <span className="flex-1 font-bold text-ink">
              {unreachable
                ? `사이트 응답 없음 · 점검·방화벽 가능성${failedAt ? ` · ${timeFormat.format(failedAt)}` : ""}`
                : errorStatus === 0
                  ? "서버에 연결할 수 없어요"
                  : errorText}
            </span>
            {errorStatus != null && errorStatus > 0 && (
              <span className="text-xs text-muted">오류 코드 {errorStatus}</span>
            )}
          </div>
        ) : plan && checkFailed ? (
          /* 주소 확인은 실패했지만 탐색은 됐습니다 — 경고만 보여 주고 진행할 수 있게 둡니다 */
          <StatusRow>
            <Icon name="status-error" className="size-5" />
            <span className="font-bold text-ink">
              {`접근 확인 실패 · ${plan.check?.message ?? "사이트에 접속할 수 없어요"}`}
            </span>
          </StatusRow>
        ) : plan ? (
          <StatusRow>
            <Icon name="check" className="size-5" />
            <span className="font-bold text-ink">{reachable}</span>
          </StatusRow>
        ) : (
          <StatusRow>
            <Icon name="search" className="size-5" />
            <span className="text-subtle">URL 형식과 사이트 접근 여부를 먼저 확인해요</span>
          </StatusRow>
        )}
        {unreachable && !isChecking && (
          <p className="text-caption text-subtle">
            로그인이 필요하면 아래 ‘로그인 연결’을 써보세요
          </p>
        )}
      </StepSection>

      {/* 확인이 끝났거나, 사이트가 열리지 않아(E08) 로그인이 필요할 수 있을 때만 */}
      {(plan || unreachable || accountsRequired) && !isChecking && (
        <StepSection
          title="로그인 연결"
          description="로그인이 필요해 보여요 · 테스트 계정만 써 주세요"
        >
          <fieldset className="flex flex-col gap-3">
            <legend className="sr-only">로그인 연결 방식</legend>
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="radio"
                name="login-mode"
                className="mt-0.5 size-5 accent-ink"
                checked={loginMode === "none"}
                onChange={() => actions.setLoginMode("none")}
              />
              <span className="flex flex-col gap-1">
                <span className="text-sm font-bold text-ink">로그인 없이 테스트</span>
                <span className="text-xs text-muted">비회원 흐름 그대로 진행</span>
              </span>
            </label>
            <div className="flex items-start justify-between gap-4">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="radio"
                  name="login-mode"
                  className="mt-0.5 size-5 accent-ink"
                  checked={loginMode === "account"}
                  onChange={() => actions.setLoginMode("account")}
                />
                <span className="flex flex-col gap-1">
                  <span
                    className={
                      loginMode === "account" ? "text-sm font-bold text-ink" : "text-sm text-ink"
                    }
                  >
                    테스트 계정 로그인 상태로 테스트
                  </span>
                  <span className="text-xs text-muted">
                    {accountCount > 0
                      ? `테스트 계정 ${accountCount}개 등록${savedAccounts.data?.login_url ? "" : " · 로그인 화면 주소를 등록해주세요"}`
                      : "테스트 계정 1개 = 에이전트 1명 · 최대 20개"}
                  </span>
                </span>
              </label>
              {/* 모드는 계정을 저장할 때 바꿉니다 (모달을 닫으면 그대로) */}
              <Button variant="secondary" onClick={() => setAccountOpen(true)}>
                테스트 계정 등록
              </Button>
            </div>
          </fieldset>
        </StepSection>
      )}

      <StepFooter>
        {/* 테스트 계정 모드에서 서버 계정을 다시 받는 중이면 기다립니다 (옛 계정 수로 넘어가지 않게) */}
        <Button
          disabled={isChecking || (loginMode === "account" && savedAccounts.isFetching)}
          onClick={() => (plan && !stale ? onNext() : check(true))}
        >
          다음: 과업 · 타겟
        </Button>
      </StepFooter>

      <AccountModal
        open={accountOpen}
        onClose={() => {
          saveAccounts.reset();
          setAccountOpen(false);
        }}
        saving={saveAccounts.isPending}
        error={saveAccounts.error ? accountSaveError(saveAccounts.error) : null}
        retentionDays={savedAccounts.data?.retention_days}
        loginUrl={savedAccounts.data?.login_url}
        siteUrl={siteUrl}
        onSave={(accounts, loginUrl) =>
          saveAccounts.mutate(
            { projectId: v1ProjectId, loginUrl, accounts },
            {
              onSuccess: (saved) => {
                actions.setLoginMode("account");
                actions.setAccounts(saved);
                setAccountOpen(false);
              },
            },
          )
        }
      />
    </div>
  );
}

/* 계정 저장 실패 문구 — 401 로그인 · 403 권한 · 0 연결 실패, 그 밖은 서버 message */
function accountSaveError(error: ApiError) {
  if (error.status === 0) return "서버에 연결할 수 없어요";
  if (error.status === 401) return "로그인이 필요해요";
  if (error.status === 403) return "이 프로젝트에서는 실행할 수 없어요";
  /* 로그인 화면 주소가 프로젝트 사이트가 아닌 경우 등 — 서버가 칸별 안내를 줍니다 */
  const loginUrlMessage = error.fields?.login_url;
  if (Array.isArray(loginUrlMessage) && typeof loginUrlMessage[0] === "string") {
    return loginUrlMessage[0];
  }
  return error.message;
}
