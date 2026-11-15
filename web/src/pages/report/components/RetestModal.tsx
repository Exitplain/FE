import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";

import Button from "@/components/Button/Button";
import Field from "@/components/Field/Field";
import Input from "@/components/Input/Input";
import Modal from "@/components/Modal/Modal";
import TextArea from "@/components/TextArea/TextArea";
import { buildPath } from "@/constants/routes";
import { useRetestStore } from "@/stores/useRetestStore";
import type { PersonaReport } from "@/types/persona.type";

import { useStartRetest } from "../hooks/useStartRetest";
import { formatDay } from "../utils/reportView";

const MAX_NAME = 60;
const MAX_NOTE = 500;

/* 패널 코드 범위 (mock·Figma P07 규칙 P-001~P-020) */
const panelCodes = (size: number) => `P-001~P-${String(size).padStart(3, "0")}`;

/*
  Figma P17 수정 후 재테스트 — 같은 패널·시드로 다시 실행해 차이만 비교합니다.
  이름·고친 내용·자동 비교는 API 필드가 없어 브라우저에만 둡니다 (useRetestStore, 임시).
  이름·고친 내용은 아직 보여주는 화면이 없어 기록만 해 둡니다 (서버 명세가 나오면 실행 정보로).
*/
export default function RetestModal({
  open,
  onClose,
  projectId,
  report,
  order,
  nextOrder,
  taskName,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  report: PersonaReport;
  /* 지금 리포트의 차수 (없으면 null) */
  order: number | null;
  nextOrder: number;
  taskName: string;
}) {
  const navigate = useNavigate();
  const start = useStartRetest();
  /* "3차와" · "이전 실행과" (받침에 따라 조사가 다릅니다) */
  const withBase = order ? `${order}차와` : "이전 실행과";
  const defaultName = `${taskName} · ${nextOrder}차 (재테스트)`;
  const [name, setName] = useState(defaultName);
  const [note, setNote] = useState("");
  const [autoCompare, setAutoCompare] = useState(true);
  const conditions = report.conditions;

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (start.isPending) return;
    start.mutate(report, {
      onSuccess: (run) => {
        /* 실행 ID 가 없으면 비교 대상과 이어 둘 수 없어 기록하지 않습니다 */
        if (run.id) {
          useRetestStore.getState().register(run.id, {
            baseRunId: report.run_id,
            name: name.trim() || defaultName,
            note: note.trim(),
            autoCompare,
          });
        }
        onClose();
        navigate(buildPath("testRun", { projectId, runId: run.id ?? "current" }));
      },
    });
  };
  /* 시작 요청 중에 닫히면 이어서 할 일(기록·이동)을 잃으므로 끝날 때까지 닫지 않습니다 */
  const close = () => {
    if (!start.isPending) onClose();
  };

  const error =
    start.error?.status === 409
      ? "이미 실행 중인 테스트가 있어요. 끝난 뒤 다시 시작해 주세요."
      : start.isError
        ? "재테스트를 시작하지 못했어요. 잠시 뒤 다시 시도해 주세요."
        : null;

  const rows = [
    [
      "패널",
      conditions ? `${withBase} 동일 · ${panelCodes(conditions.panel_size)}` : `${withBase} 동일`,
    ],
    ["시드", conditions ? `${withBase} 동일 · ${conditions.seeds}회` : `${withBase} 동일`],
    [
      "보정",
      conditions?.calibrated_at
        ? `ON · 보정 적용됨(${formatDay(conditions.calibrated_at)})`
        : "OFF · 보정 전",
    ],
  ];

  return (
    <Modal
      open={open}
      onClose={close}
      size="sm"
      title="수정 후 재테스트"
      description={
        conditions
          ? `사이트를 고치고 배포한 뒤 실행하세요. 같은 페르소나 ${conditions.panel_size}명과 같은 시드 ${conditions.seeds}개로 다시 실행해서 차이만 비교해요.`
          : "사이트를 고치고 배포한 뒤 실행하세요. 같은 페르소나와 시드로 다시 실행해서 차이만 비교해요."
      }
      footer={
        <>
          <Button variant="outline" onClick={close} disabled={start.isPending}>
            취소
          </Button>
          <Button type="submit" form="retest-form" disabled={start.isPending}>
            {start.isPending ? "시작하는 중" : "재테스트 시작"}
          </Button>
        </>
      }
    >
      <form id="retest-form" onSubmit={submit} className="flex flex-col gap-4">
        <Field label="테스트 이름">
          {(control) => (
            <Input
              {...control}
              value={name}
              maxLength={MAX_NAME}
              onChange={(event) => setName(event.target.value)}
            />
          )}
        </Field>
        <Field label="무엇을 고쳤나요" hint="선택">
          {(control) => (
            <TextArea
              {...control}
              rows={2}
              value={note}
              maxLength={MAX_NOTE}
              placeholder="예: 가입 필수 입력 8칸 → 3칸 · 비회원 주문 추가"
              onChange={(event) => setNote(event.target.value)}
            />
          )}
        </Field>

        {/* 임시: 패널·시드는 API 로 지정할 수 없어 지난 실행 조건을 표시만 합니다 */}
        <dl aria-label="실행 조건" className="flex flex-col rounded-lg bg-gray-50 px-3 py-1">
          {rows.map(([label, value]) => (
            <div key={label} className="flex min-h-10 items-center justify-between text-xs">
              <dt className="text-subtle">{label}</dt>
              <dd className="font-bold text-ink">{value}</dd>
            </div>
          ))}
        </dl>

        <label className="flex min-h-10 items-center gap-3 text-caption text-ink">
          <input
            type="checkbox"
            checked={autoCompare}
            onChange={(event) => setAutoCompare(event.target.checked)}
            className="size-5 accent-ink"
          />
          끝나면 {withBase} 자동으로 비교하기
        </label>

        {error && (
          <p role="alert" className="text-caption text-danger">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
