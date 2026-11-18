import { useEffect, useRef, useState } from "react";

import { createGitSnapshot, createZipSnapshot, getSourceSnapshot } from "@/apis/source.api";
import Button from "@/components/Button/Button";
import Field from "@/components/Field/Field";
import Icon from "@/components/Icon/Icon";
import Input from "@/components/Input/Input";
import { useNewTestStore } from "@/stores/useNewTestStore";
import { ApiError } from "@/types/api.type";
import type { DiscoveryProgressEvent } from "@/types/plan.type";
import type { SourceSnapshot } from "@/types/source.type";

import {
  MAX_ZIP_BYTES,
  SOURCE_POLL_LIMIT_MS,
  SOURCE_POLL_MS,
  sourceNote,
  sourceSummary,
} from "../utils/source";
import { StatusRow } from "./StepSection";

/*
  P02 "코드만 있어요" — 공개 git 저장소 또는 zip 으로 코드를 받아 고정·분석합니다 (Figma 시안 C 보완).
  - 받기는 서버에서 이어지고, 이 화면은 1초마다 진행을 묻습니다. 결과(준비됨·실패)는 위저드 store 에 남겨
    다른 화면에 갔다 와도 보입니다.
  - 코드는 서버에서 실행하지 않습니다. 비밀값으로 보이는 파일(.env 등)은 서버가 저장하지 않고 개수만 알려 줍니다.
*/
export default function CodeSourcePanel({ projectId }: { projectId: number }) {
  const source = useNewTestStore((state) => state.source);
  const [kind, setKind] = useState<"git" | "zip">(source?.provider ?? "git");
  const [gitUrl, setGitUrl] = useState(source?.repository_url ?? "");
  const [ref, setRef] = useState(source?.ref ?? "");
  const [subdirectory, setSubdirectory] = useState(source?.subdirectory ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState<DiscoveryProgressEvent[]>([]);
  const [error, setError] = useState<ApiError | null>(null);
  /* StrictMode 는 효과를 정리했다가 다시 실행하므로 다시 붙을 때 true 로 돌려 둡니다 */
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = async (start: () => Promise<SourceSnapshot>) => {
    setPending(true);
    setError(null);
    setProgress([]);
    try {
      let snapshot = await start();
      const until = Date.now() + SOURCE_POLL_LIMIT_MS;
      while (snapshot.state === "running" && Date.now() < until) {
        if (mounted.current) setProgress(snapshot.progress);
        await new Promise((resolve) => setTimeout(resolve, SOURCE_POLL_MS));
        snapshot = await getSourceSnapshot(snapshot.id);
      }
      useNewTestStore.getState().setSource(snapshot);
      if (snapshot.state === "running") {
        throw new ApiError({
          status: 503,
          code: "SOURCE_TIMEOUT",
          message: "코드 받기가 너무 오래 걸려요",
        });
      }
    } catch (cause) {
      if (mounted.current) {
        setError(
          cause instanceof ApiError ? cause : new ApiError({ status: 0, message: String(cause) }),
        );
      }
    } finally {
      if (mounted.current) setPending(false);
    }
  };

  const submit = () => {
    if (pending) return;
    if (kind === "git") {
      if (!/^https:\/\/\S+$/.test(gitUrl.trim())) {
        setInputError("https 로 시작하는 공개 저장소 주소를 입력해주세요");
        return;
      }
      setInputError(null);
      void run(() =>
        createGitSnapshot(projectId, {
          git_url: gitUrl.trim(),
          ...(ref.trim() ? { ref: ref.trim() } : {}),
          ...(subdirectory.trim() ? { subdirectory: subdirectory.trim() } : {}),
        }),
      );
    } else {
      if (!file) {
        setInputError("zip 파일을 골라주세요");
        return;
      }
      if (file.size > MAX_ZIP_BYTES) {
        setInputError("zip 파일은 30MB 까지 올릴 수 있어요");
        return;
      }
      setInputError(null);
      void run(() => createZipSnapshot(projectId, file, subdirectory.trim()));
    }
  };

  const failed = !pending && (error || source?.state === "failed");
  const failMessage = error?.message ?? source?.error?.message ?? "코드를 받지 못했어요";
  const latest = progress.at(-1);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 rounded-xl border border-gray-200 p-5">
        <div
          role="group"
          aria-label="코드 가져오는 방법"
          className="flex w-fit gap-1 rounded-lg bg-gray-100 p-1"
        >
          {(
            [
              ["git", "공개 git 저장소"],
              ["zip", "zip 업로드"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={kind === value}
              disabled={pending}
              onClick={() => {
                setKind(value);
                setInputError(null);
              }}
              className={
                kind === value
                  ? "rounded-md bg-white px-3.5 py-2 text-caption font-bold text-ink shadow-sm"
                  : "rounded-md px-3.5 py-2 text-caption text-subtle hover:text-ink"
              }
            >
              {label}
            </button>
          ))}
        </div>

        {kind === "git" ? (
          <>
            <div className="flex items-end gap-3">
              <Field
                label="저장소 주소"
                hint="공개 https · GitHub·GitLab"
                error={inputError ?? undefined}
                className="flex-1"
              >
                {(control) => (
                  <Input
                    {...control}
                    type="url"
                    inputMode="url"
                    placeholder="https://github.com/owner/repo"
                    disabled={pending}
                    value={gitUrl}
                    onChange={(event) => setGitUrl(event.target.value)}
                  />
                )}
              </Field>
              <Button
                variant="secondary"
                onClick={submit}
                disabled={pending}
                className={inputError ? "mb-6" : undefined}
              >
                {pending ? "받는 중…" : "코드 받기"}
              </Button>
            </div>
            <div className="flex gap-3">
              <Field label="브랜치" hint="선택" className="flex-1">
                {(control) => (
                  <Input
                    {...control}
                    placeholder="main"
                    disabled={pending}
                    value={ref}
                    onChange={(event) => setRef(event.target.value)}
                  />
                )}
              </Field>
              <Field label="하위 폴더" hint="선택 · 모노레포" className="flex-1">
                {(control) => (
                  <Input
                    {...control}
                    placeholder="web"
                    disabled={pending}
                    value={subdirectory}
                    onChange={(event) => setSubdirectory(event.target.value)}
                  />
                )}
              </Field>
            </div>
          </>
        ) : (
          <div className="flex items-end gap-3">
            <Field
              label="zip 파일"
              hint="최대 30MB"
              error={inputError ?? undefined}
              className="flex-1"
            >
              {(control) => (
                <input
                  {...control}
                  type="file"
                  accept=".zip,application/zip"
                  disabled={pending}
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                  className="h-10 rounded-lg bg-gray-50 px-3 py-2 text-caption text-ink file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1 file:text-caption"
                />
              )}
            </Field>
            <Field label="하위 폴더" hint="선택" className="w-56">
              {(control) => (
                <Input
                  {...control}
                  placeholder="web"
                  disabled={pending}
                  value={subdirectory}
                  onChange={(event) => setSubdirectory(event.target.value)}
                />
              )}
            </Field>
            <Button
              variant="secondary"
              onClick={submit}
              disabled={pending}
              className={inputError ? "mb-6" : undefined}
            >
              {pending ? "받는 중…" : "코드 받기"}
            </Button>
          </div>
        )}
      </div>

      {pending ? (
        <StatusRow>
          <Icon name="status-running" className="size-5 text-subtle motion-safe:animate-spin" />
          <span className="font-bold text-ink">{latest?.message ?? "코드를 받는 중이에요"}</span>
        </StatusRow>
      ) : failed ? (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg bg-gray-50 p-3 text-caption"
        >
          <Icon name="status-error" className="size-5 text-danger" />
          <span className="flex-1 font-bold text-ink">{failMessage}</span>
          {error && error.status > 0 && (
            <span className="text-xs text-muted">오류 코드 {error.status}</span>
          )}
        </div>
      ) : source?.state === "ready" ? (
        <>
          <StatusRow>
            <Icon name="check" className="size-5" />
            <span className="font-bold text-ink">{sourceSummary(source)}</span>
          </StatusRow>
          <p className="text-caption text-subtle">{sourceNote(source)}</p>
        </>
      ) : (
        <p className="text-caption text-subtle">
          코드는 읽기만 하고 서버에서 실행하지 않아요 · .env 같은 비밀값 파일은 저장하지 않아요
        </p>
      )}
    </div>
  );
}
