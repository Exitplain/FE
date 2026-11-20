import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useParams } from "react-router-dom";

import { getPublicParticipant, submitParticipantAnswer } from "@/apis/participant.api";
import { apiAssetUrl } from "@/apis/run.api";
import logoMark from "@/assets/brand/logo-mark.svg";
import Button from "@/components/Button/Button";
import { ApiError } from "@/types/api.type";
import { cn } from "@/utils/cn";

/*
  참여자 응답 링크 (PART-02·03) — 로그인 없이 열고, 타이핑 없이 누르기만 해서 답합니다.
  ① 과업 안내 → ② 사이트 열기(새 탭, 고객 사이트는 그대로) → ③ 질문 4개 → 제출 → 감사 화면.
  이름·연락처·자유 의견 칸이 없고, 같은 브라우저 중복 제출은 브라우저 임의 값(client_id)으로 막습니다.
*/
const CLIENT_KEY = "exitplain:participant-client";

function clientId() {
  const fresh = () =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  try {
    const saved = localStorage.getItem(CLIENT_KEY);
    if (saved) return saved;
    const made = fresh();
    localStorage.setItem(CLIENT_KEY, made);
    return made;
  } catch {
    return fresh();
  }
}

const NONE = "none";

export default function ParticipantPage() {
  const { token = "" } = useParams();
  const page = useQuery({
    queryKey: ["participant", token],
    queryFn: () => getPublicParticipant(token),
    retry: false,
  });
  return (
    <div className="flex min-h-full flex-col bg-surface">
      <header className="flex min-h-16 items-center gap-2 border-b border-line px-6">
        <img src={logoMark} alt="" className="h-8 w-auto" />
        <span className="font-logo text-xl text-black">EXITPLAIN</span>
        <span className="ml-2 text-xs text-muted">사용성 참여</span>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 py-10">
        {page.isPending ? (
          <p className="text-sm text-subtle">불러오는 중이에요…</p>
        ) : page.isError ? (
          <p role="alert" className="rounded-xl bg-gray-50 p-6 text-sm text-ink">
            {page.error instanceof ApiError ? page.error.message : "링크를 열 수 없어요."}
          </p>
        ) : (
          <Answer token={token} data={page.data} />
        )}
      </main>
    </div>
  );
}

function Answer({
  token,
  data,
}: {
  token: string;
  data: NonNullable<Awaited<ReturnType<typeof getPublicParticipant>>>;
}) {
  const [opened, setOpened] = useState(false);
  const [outcome, setOutcome] = useState<"success" | "dropout" | null>(null);
  const [screen, setScreen] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [discomfort, setDiscomfort] = useState<number | null>(null);
  const submit = useMutation({
    mutationFn: () =>
      submitParticipantAnswer(token, {
        client_id: clientId(),
        outcome: outcome ?? "success",
        ...(screen && screen !== NONE ? { pain_stage_id: screen } : {}),
        ...(reason && screen && screen !== NONE ? { pain_cause: reason } : {}),
        ...(discomfort ? { discomfort } : {}),
      }),
  });

  if (submit.isSuccess) {
    return (
      <section className="flex flex-col items-center gap-3 py-16 text-center">
        <h1 className="text-2xl font-bold text-ink">참여해 주셔서 감사해요</h1>
        <p className="text-sm text-subtle">응답이 저장됐어요 · 이 창은 닫아도 돼요</p>
      </section>
    );
  }

  const needsScreen = outcome === "dropout";
  const ready =
    outcome !== null &&
    screen !== null &&
    discomfort !== null &&
    (!needsScreen || screen !== NONE) &&
    (screen === NONE || reason !== null);

  return (
    <>
      <section className="flex flex-col gap-3">
        <p className="text-xs text-muted">{data.project_name}</p>
        <h1 className="text-2xl font-bold text-ink">“{data.task_name}”을 해 주세요</h1>
        <p className="text-sm text-subtle">
          아래 버튼으로 사이트를 새 탭에서 열고, 평소처럼 해 보세요. 끝나거나 그만두고 싶으면 이
          탭으로 돌아와 질문 4개에 답해 주세요. 이름·연락처는 묻지 않아요.
        </p>
        <a
          href={data.site_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => setOpened(true)}
          className="w-fit rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-white"
        >
          사이트 열기 ↗
        </a>
        {!opened && <p className="text-xs text-muted">사이트를 열어 해 본 뒤에 답해 주세요</p>}
      </section>

      <Question title="1. 끝까지 했나요?">
        <Choices
          name="outcome"
          value={outcome}
          options={[
            ["success", "끝까지 했어요"],
            ["dropout", "중간에 그만뒀어요"],
          ]}
          onChange={(value) => setOutcome(value as "success" | "dropout")}
        />
      </Question>

      <Question title={needsScreen ? "2. 어느 화면에서 그만뒀나요?" : "2. 가장 불편했던 화면은?"}>
        <div role="radiogroup" aria-label="화면" className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {data.screens.map((item) => {
            const src = apiAssetUrl(item.screenshot_url);
            const selected = screen === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={item.name}
                onClick={() => setScreen(item.id)}
                className={cn(
                  "flex flex-col gap-2 rounded-xl border p-2 text-left",
                  selected ? "border-ink ring-2 ring-ink" : "border-gray-200",
                )}
              >
                {src ? (
                  <img
                    src={src}
                    alt=""
                    loading="lazy"
                    className="aspect-[16/10] w-full rounded-lg object-cover object-top"
                  />
                ) : (
                  <span className="flex aspect-[16/10] w-full items-center justify-center rounded-lg bg-gray-50 text-xs text-muted">
                    캡처 없음
                  </span>
                )}
                <span className="text-caption font-bold text-ink">{item.name}</span>
              </button>
            );
          })}
          {!needsScreen && (
            <button
              type="button"
              role="radio"
              aria-checked={screen === NONE}
              onClick={() => {
                setScreen(NONE);
                setReason(null);
              }}
              className={cn(
                "flex items-center justify-center rounded-xl border p-4 text-caption font-bold text-ink",
                screen === NONE ? "border-ink ring-2 ring-ink" : "border-gray-200",
              )}
            >
              특별히 없었어요
            </button>
          )}
        </div>
      </Question>

      {screen !== NONE && (
        <Question title="3. 어떤 점이 불편했나요?">
          <Choices
            name="reason"
            value={reason}
            options={data.reasons.map((item) => [item.key, item.label] as const)}
            onChange={setReason}
            column
          />
        </Question>
      )}

      <Question title={`${screen === NONE ? 3 : 4}. 전체적으로 얼마나 불편했나요?`}>
        <p className="text-xs text-subtle">1 전혀 아니에요 · 5 매우 불편했어요</p>
        <Choices
          name="discomfort"
          value={discomfort === null ? null : String(discomfort)}
          options={[1, 2, 3, 4, 5].map((n) => [String(n), String(n)] as const)}
          onChange={(value) => setDiscomfort(Number(value))}
        />
      </Question>

      {submit.isError && (
        <p role="alert" className="text-sm text-danger">
          {submit.error.message}
        </p>
      )}
      <Button disabled={!ready || submit.isPending} onClick={() => submit.mutate()}>
        {submit.isPending ? "보내는 중…" : "응답 보내기"}
      </Button>
    </>
  );
}

function Question({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base font-bold text-ink">{title}</h2>
      {children}
    </section>
  );
}

function Choices({
  name,
  value,
  options,
  onChange,
  column = false,
}: {
  name: string;
  value: string | null;
  options: readonly (readonly [string, string])[];
  onChange: (value: string) => void;
  column?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={name}
      className={cn("flex gap-2", column ? "flex-col" : "flex-wrap")}
    >
      {options.map(([key, label]) => (
        <button
          key={key}
          type="button"
          role="radio"
          aria-checked={value === key}
          onClick={() => onChange(key)}
          className={cn(
            "min-h-11 rounded-full border px-4 text-left text-caption",
            value === key ? "border-ink bg-ink font-bold text-white" : "border-gray-200 text-ink",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
