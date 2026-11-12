import { useState } from "react";

import Button from "@/components/Button/Button";
import ChoiceChip from "@/components/ChoiceChip/ChoiceChip";
import Field from "@/components/Field/Field";
import IconButton from "@/components/IconButton/IconButton";
import Input from "@/components/Input/Input";
import Modal from "@/components/Modal/Modal";
import TextArea from "@/components/TextArea/TextArea";

import {
  ACCOUNT_MAX,
  findDuplicateUsernames,
  parseAccountsText,
  type TestAccount,
} from "../utils/newTest";

type AccountModalProps = {
  open: boolean;
  initialAccounts: TestAccount[];
  onClose: () => void;
  onSave: (accounts: TestAccount[]) => void;
};

const EMPTY_ROW: TestAccount = { username: "", password: "" };
const isFilled = (row: TestAccount) => row.username.trim() !== "" && row.password !== "";
const isBlank = (row: TestAccount) => row.username.trim() === "" && row.password === "";

/*
  P04 테스트 계정 등록 모달 (P04b 10개 입력, P04c 중복, P04d 붙여넣기) — 퍼블리싱 단계.
  BE 개발 서버에 로그인 연결(원격 브라우저·lease)이 없어, 입력한 계정은 화면 상태에만 저장하고
  실행 요청에는 보내지 않습니다. 비밀번호는 저장소(localStorage 등)에 남기지 않습니다.
  Figma 의 원격 브라우저 단계(1. 브라우저 열기 ~ 3. 시작 화면 지정)와 P04c "로그인 확인"은
  서버 기능이 생기면 이 모달에 이어서 붙입니다.
*/
export default function AccountModal({
  open,
  initialAccounts,
  onClose,
  onSave,
}: AccountModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="테스트 계정 등록"
      description={`계정 1개로 에이전트 1명이 로그인해요 · 최대 ${ACCOUNT_MAX}개`}
    >
      {/* 열 때마다 저장된 계정으로 다시 시작하려고 내용을 따로 둡니다 (닫으면 언마운트) */}
      <AccountForm initialAccounts={initialAccounts} onSave={onSave} />
    </Modal>
  );
}

function AccountForm({
  initialAccounts,
  onSave,
}: Pick<AccountModalProps, "initialAccounts" | "onSave">) {
  const [mode, setMode] = useState<"manual" | "paste">("manual");
  const [rows, setRows] = useState<TestAccount[]>(
    initialAccounts.length > 0 ? initialAccounts : [EMPTY_ROW],
  );
  const [pasteText, setPasteText] = useState("");
  const [pasteError, setPasteError] = useState<string | null>(null);

  const duplicates = findDuplicateUsernames(rows);
  const filledCount = rows.filter(isFilled).length;
  const hasPartialRow = rows.some((row) => !isFilled(row) && !isBlank(row));
  const canSave = filledCount > 0 && duplicates.size === 0 && !hasPartialRow;

  const updateRow = (index: number, patch: Partial<TestAccount>) =>
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const removeRow = (index: number) =>
    setRows((current) => {
      const next = current.filter((_, i) => i !== index);
      return next.length > 0 ? next : [EMPTY_ROW];
    });

  const applyPaste = () => {
    const { accounts, invalidLines } = parseAccountsText(pasteText);
    if (accounts.length === 0) {
      setPasteError("아이디,비밀번호 형식의 줄을 찾지 못했어요");
      return;
    }
    /* 빈 행은 버리고 뒤에 붙입니다. 최대 개수를 넘는 줄은 넣지 않습니다 */
    const merged = [...rows.filter((row) => !isBlank(row)), ...accounts];
    setRows(merged.slice(0, ACCOUNT_MAX));
    setPasteText("");
    setPasteError(
      [
        invalidLines.length > 0
          ? `${invalidLines.join(", ")}번째 줄은 비밀번호가 없어 뺐어요`
          : null,
        merged.length > ACCOUNT_MAX ? `최대 ${ACCOUNT_MAX}개까지만 넣었어요` : null,
      ]
        .filter(Boolean)
        .join(" · ") || null,
    );
    setMode("manual");
  };

  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span id="account-mode-label" className="text-caption font-medium text-ink">
              계정
            </span>
            <div role="radiogroup" aria-labelledby="account-mode-label" className="flex gap-1">
              <ChoiceChip
                kind="radio"
                size="sm"
                selected={mode === "manual"}
                onClick={() => setMode("manual")}
              >
                직접 입력
              </ChoiceChip>
              <ChoiceChip
                kind="radio"
                size="sm"
                selected={mode === "paste"}
                onClick={() => setMode("paste")}
              >
                붙여넣기
              </ChoiceChip>
            </div>
          </div>
          <p className="text-caption font-medium text-ink">
            {filledCount} / {ACCOUNT_MAX}
          </p>
        </div>

        {mode === "paste" ? (
          <div className="flex flex-col items-end gap-3">
            <Field
              label="계정 붙여넣기"
              help="CSV나 스프레드시트에서 아이디,비밀번호 두 칸을 복사해 붙여넣을 수 있어요"
              className="w-full"
            >
              {(control) => (
                <TextArea
                  {...control}
                  rows={5}
                  value={pasteText}
                  onChange={(event) => setPasteText(event.target.value)}
                  placeholder={"test01@example.com,비밀번호\ntest02@example.com,비밀번호"}
                />
              )}
            </Field>
            <Button variant="secondary" disabled={!pasteText.trim()} onClick={applyPaste}>
              목록에 넣기
            </Button>
          </div>
        ) : (
          <ol className="flex flex-col gap-2" aria-label="테스트 계정 목록">
            <li aria-hidden className="grid grid-cols-12 gap-4 text-xs text-muted">
              <span className="col-span-1">#</span>
              <span className="col-span-6">아이디 또는 이메일</span>
              <span className="col-span-4">비밀번호</span>
            </li>
            {rows.map((row, index) => (
              <li key={index} className="flex flex-col gap-1">
                <div className="grid grid-cols-12 items-center gap-4">
                  <span className="col-span-1 text-caption text-muted">{index + 1}</span>
                  <Input
                    className="col-span-6"
                    aria-label={`계정 ${index + 1} 아이디`}
                    aria-invalid={duplicates.has(index) || undefined}
                    autoComplete="off"
                    value={row.username}
                    onChange={(event) => updateRow(index, { username: event.target.value })}
                    placeholder="test01@example.com"
                  />
                  <Input
                    className="col-span-4"
                    type="password"
                    aria-label={`계정 ${index + 1} 비밀번호`}
                    autoComplete="new-password"
                    value={row.password}
                    onChange={(event) => updateRow(index, { password: event.target.value })}
                    placeholder="비밀번호"
                  />
                  <IconButton
                    className="col-span-1 text-muted"
                    icon="close"
                    label={`계정 ${index + 1} 삭제`}
                    onClick={() => removeRow(index)}
                  />
                </div>
                {duplicates.has(index) && (
                  <p className="pl-1 text-xs font-medium text-danger">같은 아이디가 이미 있어요</p>
                )}
              </li>
            ))}
          </ol>
        )}

        {pasteError && <p className="text-xs text-subtle">{pasteError}</p>}

        {mode === "manual" && (
          <div>
            <Button
              variant="link"
              disabled={rows.length >= ACCOUNT_MAX}
              onClick={() => setRows((current) => [...current, EMPTY_ROW])}
            >
              계정 추가
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-base font-medium text-ink">
          {filledCount > 0
            ? `에이전트 ${filledCount}명으로 실행해요`
            : "계정을 넣으면 에이전트 수가 정해져요"}
        </p>
        <div className="h-2 overflow-hidden rounded bg-line">
          {/* 진행 막대 길이는 입력 값이라 style 로 둡니다 */}
          <div
            className="h-full bg-ink"
            style={{ width: `${(filledCount / ACCOUNT_MAX) * 100}%` }}
          />
        </div>
        <p className="text-xs text-muted">계정을 더 넣으면 최대 {ACCOUNT_MAX}명까지 늘어나요</p>
      </div>
      <p className="text-xs text-subtle">
        실제 개인정보·결제 정보가 없는 테스트 계정만 넣어주세요 · 비밀번호는 이 화면에만 두고
        새로고침하면 지워져요 · 지금 개발 서버는 로그인 상태 실행을 지원하지 않아 저장만 해요
      </p>

      <div className="flex justify-end">
        <Button disabled={!canSave} onClick={() => onSave(rows.filter(isFilled))}>
          계정 저장
        </Button>
      </div>
    </>
  );
}
