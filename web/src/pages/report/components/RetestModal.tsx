import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";

import { createRun, getPlanRevision } from "@/apis/plan.api";
import { queryKeys } from "@/apis/queryKeys";
import Button from "@/components/Button/Button";
import Field from "@/components/Field/Field";
import Input from "@/components/Input/Input";
import Modal from "@/components/Modal/Modal";
import TextArea from "@/components/TextArea/TextArea";
import { buildPath } from "@/constants/routes";
import { useRunTaskNamesStore } from "@/stores/useRunTaskNamesStore";
import { ApiError } from "@/types/api.type";
import type { PlanRevisionDetail } from "@/types/plan.type";

/* BE RunCreateSerializer.change_note 최대 길이 */
const MAX_NOTE = 500;

/* 없음·로그인 필요·권한 없음은 다시 물어도 같아서 바로 대체 문구로 둡니다 */
const retryUnlessFinal = (count: number, error: Error) =>
  !(error instanceof ApiError && [401, 403, 404].includes(error.status)) && count < 1;

/* Idempotency-Key. randomUUID 는 HTTPS·localhost 에서만 있어 없으면 시각·난수로 만듭니다 */
const newKey = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

/* 패널 "P-001~P-020" · 페르소나 수 · 시드 수 (확정 계획 data). 코드는 BE 가 순서대로 매깁니다 */
function conditionsOf(revision: PlanRevisionDetail | undefined) {
  const codes = (revision?.data.personas ?? []).map((persona) => persona.code);
  return {
    personas: codes.length,
    panel:
      codes.length === 0
        ? null
        : codes.length === 1
          ? codes[0]
          : `${codes[0]}~${codes[codes.length - 1]}`,
    seeds: revision?.data.limits?.seed_count ?? null,
  };
}

/*
  BE runs/naming.build_run_name 과 같은 규칙 — "4차·첫 주문 완료" · 과업이 여럿이면 "4차·첫 주문 완료 외 1개"
  재테스트 이름은 BE 가 실행을 만들 때 이 규칙으로 정합니다 (차수 = 프로젝트의 가장 큰 차수 + 1)
*/
function expectedRunName(sequenceNo: number, revision: PlanRevisionDetail | undefined) {
  const names = (revision?.data.tasks ?? [])
    .map((task) => String(task.name || task.id).slice(0, 60))
    .filter(Boolean);
  if (names.length === 0) return `${sequenceNo}차`;
  if (names.length === 1) return `${sequenceNo}차·${names[0]}`;
  return `${sequenceNo}차·${names[0]} 외 ${names.length - 1}개`;
}

/*
  Figma P17 수정 후 재테스트 — 같은 확정 계획(페르소나·시드)으로 다시 실행합니다.
  POST /api/v1/runs { plan_revision_id, base_run_id, change_note } 후 새 실행 화면(P08)으로 갑니다. 이전 실행은 남습니다.
  - 테스트 이름은 BE 가 정해서, 시작하면 붙을 이름을 미리 보여 주고 바꾸지는 못하게 둡니다
  - 보정 줄·"끝나면 자동으로 비교하기" 는 BE 보정·비교 API 가 없어 두지 않습니다
  - 시작 요청 중에는 닫지 않습니다 (닫아도 실행은 만들어지고 화면이 이동해 혼란스러움)
*/
export default function RetestModal({
  open,
  onClose,
  projectId,
  runId,
  sequenceNo,
  nextSequenceNo,
  planRevisionId,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  runId: string;
  sequenceNo: number | undefined;
  /* 새 실행이 받을 차수 (실행 목록의 가장 큰 차수 + 1) */
  nextSequenceNo: number | undefined;
  planRevisionId: string;
}) {
  const navigate = useNavigate();
  const client = useQueryClient();
  const [note, setNote] = useState("");
  /* 같은 모달에서 다시 눌러도 같은 키를 보내 실행이 두 번 생기지 않게 합니다 */
  const [idempotencyKey] = useState(newKey);
  const revision = useQuery({
    queryKey: queryKeys.planRevision(planRevisionId),
    queryFn: () => getPlanRevision(planRevisionId),
    enabled: open,
    staleTime: Infinity,
    retry: retryUnlessFinal,
  });
  const start = useMutation<Awaited<ReturnType<typeof createRun>>, Error>({
    mutationFn: () =>
      createRun(
        { plan_revision_id: planRevisionId, base_run_id: runId, change_note: note.trim() },
        idempotencyKey,
      ),
  });

  /* "3차와" · "이전 실행과" */
  const withBase = sequenceNo ? `${sequenceNo}차와` : "이전 실행과";
  const conditions = conditionsOf(revision.data);
  const loading = revision.isPending;

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (start.isPending) return;
    start.mutate(undefined, {
      onSuccess: (created) => {
        /* 실행 응답에는 과업 id 만 있어, 실행 화면이 보여 줄 과업 이름을 남겨 둡니다 */
        useRunTaskNamesStore.getState().register(created.run_id, revision.data?.data.tasks ?? []);
        void client.invalidateQueries({ queryKey: queryKeys.runs.all });
        onClose();
        navigate(buildPath("testRun", { projectId, runId: created.run_id }));
      },
    });
  };
  const close = () => {
    if (!start.isPending) onClose();
  };

  const error =
    start.error instanceof ApiError && start.error.status === 409
      ? "이미 실행 중인 테스트가 있어요. 끝난 뒤 다시 시작해 주세요."
      : start.error instanceof ApiError && start.error.status === 422
        ? start.error.message
        : start.isError
          ? "재테스트를 시작하지 못했어요. 잠시 뒤 다시 시도해 주세요."
          : null;

  const rows = [
    [
      "패널",
      loading
        ? "불러오는 중…"
        : `${withBase} 동일${conditions.panel ? ` · ${conditions.panel}` : ""}`,
    ],
    [
      "시드",
      loading
        ? "불러오는 중…"
        : `${withBase} 동일${conditions.seeds ? ` · ${conditions.seeds}회` : ""}`,
    ],
  ];

  return (
    <Modal
      open={open}
      onClose={close}
      size="sm"
      title="수정 후 재테스트"
      description={
        conditions.personas && conditions.seeds
          ? `사이트를 고치고 배포한 뒤 실행하세요. 같은 페르소나 ${conditions.personas}명과 같은 시드 ${conditions.seeds}개로 다시 실행해요.`
          : "사이트를 고치고 배포한 뒤 실행하세요. 같은 페르소나와 시드로 다시 실행해요."
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
        <Field label="테스트 이름" help="이 이름으로 실행돼요 · 바꿀 수 없어요">
          {(control) => (
            <Input
              {...control}
              readOnly
              value={
                loading || !nextSequenceNo
                  ? ""
                  : `${expectedRunName(nextSequenceNo, revision.data)} (재테스트)`
              }
              placeholder="불러오는 중…"
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

        <dl aria-label="실행 조건" className="flex flex-col rounded-lg bg-gray-50 px-3 py-1">
          {rows.map(([label, value]) => (
            <div key={label} className="flex min-h-10 items-center justify-between text-xs">
              <dt className="text-subtle">{label}</dt>
              <dd className="font-bold text-ink">{value}</dd>
            </div>
          ))}
        </dl>

        {error && (
          <p role="alert" className="text-caption text-danger">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
