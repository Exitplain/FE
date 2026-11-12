import { useState } from "react";

import Button from "@/components/Button/Button";
import ChoiceChip from "@/components/ChoiceChip/ChoiceChip";
import Field from "@/components/Field/Field";
import Icon from "@/components/Icon/Icon";
import Input from "@/components/Input/Input";
import { useNewTestStore } from "@/stores/useNewTestStore";
import type { Variant } from "@/types/persona.type";

import { useDiscoverPlan } from "../hooks/useNewTestMutations";
import { validateSiteUrl } from "../utils/newTest";
import AccountModal from "./AccountModal";
import StepSection, { StatusRow, StepFooter } from "./StepSection";

const VARIANTS: { value: Variant; label: string }[] = [
  { value: "problem", label: "문제 버전" },
  { value: "fixed", label: "개선 버전" },
];

type SiteStepProps = {
  /* 만료 등으로 돌아왔을 때 위에 보여줄 안내 */
  notice: string | null;
  onNext: () => void;
};

/*
  P02 사이트 · P02b 확인 중 · P03 확인 완료 · E07 잘못된 URL · E08 접근 불가
  - "사이트 확인"은 POST /api/personas/discover 를 부릅니다. 개발 서버는 주소 대신 반찬 데모 버전만 받아
    입력한 주소는 아직 탐색에 쓰이지 않습니다(주소 모양만 확인). 응답 시간·화면 수도 응답에 없습니다.
  - 로그인 연결: 테스트 계정은 등록(P04)까지만 하고 실행에는 쓰이지 않습니다(서버 미지원).
*/
export default function SiteStep({ notice, onNext }: SiteStepProps) {
  const store = useNewTestStore();
  const discover = useDiscoverPlan();
  const [urlError, setUrlError] = useState<string | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);

  const check = () => {
    const error = validateSiteUrl(store.siteUrl);
    setUrlError(error);
    if (error) return;
    discover.mutate({ variant: store.variant }, { onSuccess: (plan) => store.setPlan(plan) });
  };

  const plan = store.plan;

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
                value={store.siteUrl}
                onChange={(event) => {
                  store.setSiteUrl(event.target.value);
                  setUrlError(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") check();
                }}
              />
            )}
          </Field>
          <Button
            variant="secondary"
            onClick={check}
            disabled={discover.isPending}
            className={urlError ? "mb-6" : undefined}
          >
            {plan ? "다시 확인" : "사이트 확인"}
          </Button>
        </div>

        <div className="flex flex-col gap-2">
          <span id="variant-label" className="text-caption font-medium text-gray-800">
            데모 사이트 버전
          </span>
          <div role="radiogroup" aria-labelledby="variant-label" className="flex gap-2">
            {VARIANTS.map((variant) => (
              <ChoiceChip
                key={variant.value}
                kind="radio"
                selected={store.variant === variant.value}
                onClick={() => store.setVariant(variant.value)}
              >
                {variant.label}
              </ChoiceChip>
            ))}
          </div>
          <p className="text-xs text-muted">
            지금 개발 서버는 반찬로드 모의 쇼핑몰만 확인해요 · 입력한 주소는 서버가 지원하면 탐색에
            씁니다
          </p>
        </div>

        {discover.isPending && (
          <StatusRow>
            <Icon name="status-running" className="size-5 animate-spin" />
            <span className="font-bold text-ink">
              사이트를 확인하는 중이에요 · 시작 화면의 링크를 읽고 있어요
            </span>
          </StatusRow>
        )}
        {!discover.isPending && discover.isError && (
          <div
            role="alert"
            className="flex items-center justify-between gap-4 rounded-lg bg-gray-50 p-3"
          >
            <p className="flex items-center gap-2 text-caption">
              <Icon name="status-error" className="size-5 text-danger" />
              <span className="font-bold text-ink">사이트에 접속하지 못했어요</span>
              <span className="text-subtle">
                {discover.error.status === 0 ? "서버에 연결할 수 없어요" : discover.error.message}
              </span>
            </p>
            <Button variant="secondary" icon="retry" onClick={check}>
              다시 시도
            </Button>
          </div>
        )}
        {!discover.isPending && plan && (
          <StatusRow>
            <Icon name="check" className="size-5" />
            <span className="font-bold text-ink">
              접근 가능 · 기능 {plan.features.length}개 · 과업 {plan.tasks.length}개를 찾았어요
            </span>
            <span className="text-subtle">{plan.note}</span>
          </StatusRow>
        )}
      </StepSection>

      <StepSection title="로그인 연결" description="로그인이 필요하면 테스트 계정만 써 주세요">
        <div role="radiogroup" aria-label="로그인 연결" className="flex flex-col gap-3">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="radio"
              name="login-mode"
              className="mt-0.5 size-5 accent-ink"
              checked={store.loginMode === "none"}
              onChange={() => store.setLoginMode("none")}
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
                checked={store.loginMode === "account"}
                onChange={() => store.setLoginMode("account")}
              />
              <span className="flex flex-col gap-1">
                <span className="text-sm text-ink">테스트 계정 로그인 상태로 테스트</span>
                <span className="text-xs text-muted">
                  {store.accounts.length > 0
                    ? `테스트 계정 ${store.accounts.length}개 등록 · 지금은 저장만 하고 실행에는 쓰지 않아요`
                    : "테스트 계정 1개 = 에이전트 1명 · 최대 20개"}
                </span>
              </span>
            </label>
            <Button
              variant="secondary"
              disabled={store.loginMode !== "account"}
              onClick={() => setAccountOpen(true)}
            >
              테스트 계정 등록
            </Button>
          </div>
        </div>
      </StepSection>

      <StepFooter>
        <Button disabled={!plan} onClick={onNext}>
          다음: 과업 · 타겟
        </Button>
      </StepFooter>

      <AccountModal
        open={accountOpen}
        initialAccounts={store.accounts}
        onClose={() => setAccountOpen(false)}
        onSave={(accounts) => {
          store.setAccounts(accounts);
          setAccountOpen(false);
        }}
      />
    </div>
  );
}
