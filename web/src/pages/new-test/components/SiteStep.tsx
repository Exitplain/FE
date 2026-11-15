import { useState } from "react";
import { useShallow } from "zustand/react/shallow";

import Button from "@/components/Button/Button";
import Field from "@/components/Field/Field";
import Icon from "@/components/Icon/Icon";
import Input from "@/components/Input/Input";
import { useNewTestStore } from "@/stores/useNewTestStore";

import { useDiscoverPlan } from "../hooks/useNewTestMutations";
import { validateSiteUrl } from "../utils/newTest";
import AccountModal from "./AccountModal";
import StepSection, { StatusRow, StepFooter } from "./StepSection";

type SiteStepProps = {
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
  - "확인"은 POST /api/personas/discover 를 부릅니다. 개발 서버는 주소 대신 반찬 데모 버전만 받아
    입력한 주소는 아직 탐색에 쓰이지 않습니다(주소 모양만 확인). 데모 버전은 Figma 에 없어 화면에서 고르지 않고
    "문제 버전"으로 확인합니다(스토어 기본값).
  - 응답 시간·화면 수는 탐색 응답의 임시 필드(response_ms, screens_read)이고 없으면 빼고 보여줍니다.
  - 확인하는 동안 주소를 잠가, 이전 요청의 응답이 바뀐 입력의 결과로 들어가지 않게 합니다.
  - 로그인 연결은 사이트 확인이 끝난 뒤(P03)에 나옵니다. 테스트 계정은 등록(P04)까지만 하고
    실행에는 쓰이지 않습니다(서버 미지원).
*/
export default function SiteStep({ notice, onDiscovered, onNext }: SiteStepProps) {
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
  const discover = useDiscoverPlan();
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
    const requested = { projectId, siteUrl, variant };
    const same = (current: typeof requested) =>
      current.projectId === requested.projectId &&
      current.siteUrl === requested.siteUrl &&
      current.variant === requested.variant;
    discover.mutate(
      { variant },
      {
        onSuccess: (result) => {
          /* 응답을 기다리는 사이 입력이 바뀌었다면 이 결과는 버립니다 */
          const current = useNewTestStore.getState();
          if (!same(current)) return;
          current.setPlan(result);
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

  /* E08 접근 불가는 서버가 사이트를 열지 못한 5xx 만. 4xx 는 서버 메시지, 0 은 서버 연결 실패 */
  const errorStatus = discover.error?.status ?? null;
  const unreachable = errorStatus != null && errorStatus >= 500;

  const reachable = [
    "접근 가능",
    plan?.response_ms != null ? `응답 ${(plan.response_ms / 1000).toFixed(1)}초` : null,
    plan?.screens_read != null ? `화면 ${plan.screens_read}개 읽음` : null,
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
          <StatusRow>
            <Icon name="search" className="size-5" />
            <span className="text-subtle">시작 화면의 메뉴와 기능을 읽는 중이에요</span>
          </StatusRow>
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
                  : `사이트를 확인하지 못했어요 · ${discover.error.message}`}
            </span>
            {errorStatus != null && errorStatus > 0 && (
              <span className="text-xs text-muted">오류 코드 {errorStatus}</span>
            )}
          </div>
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
      {(plan || unreachable) && !isChecking && (
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
                      ? `테스트 계정 ${accountCount}개 등록 · 지금은 저장만 하고 실행에는 쓰지 않아요`
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
        <Button disabled={isChecking} onClick={() => (plan ? onNext() : check(true))}>
          다음: 과업 · 타겟
        </Button>
      </StepFooter>

      <AccountModal
        open={accountOpen}
        onClose={() => setAccountOpen(false)}
        onSave={(accounts) => {
          actions.setLoginMode("account");
          actions.setAccounts(accounts);
          setAccountOpen(false);
        }}
      />
    </div>
  );
}
