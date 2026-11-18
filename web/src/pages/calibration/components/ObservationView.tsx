import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ChangeEvent, type FormEvent, useId, useState } from "react";

import {
  deleteObservation,
  getObservations,
  importObservation,
  saveObservation,
} from "@/apis/calibration.api";
import { queryKeys } from "@/apis/queryKeys";
import Button from "@/components/Button/Button";
import DropdownMenu from "@/components/DropdownMenu/DropdownMenu";
import Icon from "@/components/Icon/Icon";
import { useToastStore } from "@/stores/useToastStore";
import type {
  HumanObservation,
  HumanObservationList,
  ObservationInput,
} from "@/types/calibration.type";

import TrendLineChart from "@/components/TrendLineChart/TrendLineChart";

import { KpiTrio } from "./CalibrationViews";

const CODE_PATTERN = /^[A-Za-z0-9_-]{1,40}$/;
const PURPOSES = [
  ["calibration", "보정용"],
  ["evaluation", "평가용"],
] as const;

function observationKey(projectId: string) {
  return [...queryKeys.calibration.all, projectId, "observations"] as const;
}

const NONE = "__none__";

/* 한 관측이 예측과 맞는지: 불편 화면을 골랐으면 그 일치, 아니면 판단할 수 있는 항목이 모두 맞을 때 */
function agrees(row: HumanObservation) {
  if (row.match.pain_screen !== null) return row.match.pain_screen;
  const values = Object.values(row.match).filter((value) => value !== null);
  return values.length > 0 && values.every(Boolean);
}

/* 응답이 쌓일수록 불편 화면 일치율(누적 %)이 어떻게 바뀌는지 */
function agreementTrend(items: HumanObservation[]) {
  let matched = 0;
  let total = 0;
  return [...items]
    .sort((a, b) => a.updated_at.localeCompare(b.updated_at))
    .flatMap((row, index) => {
      if (row.match.pain_screen === null) return [];
      total += 1;
      matched += row.match.pain_screen ? 1 : 0;
      return [{ x: `${index + 1}`, rate: Math.round((matched / total) * 1000) / 10 }];
    });
}

/*
  K04 사람 관측 입력 · K04b 저장됨(토스트) · K04c 같은 참여자 코드(덮어쓰기 안내). 실제 API(BE calibrations).
  예측은 가장 최근 사전 테스트의 과업별 다수 결과·가장 많이 이탈한 단계·1위 원인입니다.
  평가용 관측이 있으면 일치 요약은 평가용만으로 셉니다 (보정용과 섞지 않음).
*/
export default function ObservationView({ projectId }: { projectId: string }) {
  const query = useQuery({
    queryKey: observationKey(projectId),
    queryFn: () => getObservations(projectId),
  });
  if (query.isError) {
    return (
      <p role="alert" className="rounded-xl bg-gray-50 p-6 text-sm text-subtle">
        {query.error.message}
      </p>
    );
  }
  if (!query.data) return <p className="text-sm text-subtle">불러오는 중이에요…</p>;
  if (!query.data.report_id || query.data.tasks.length === 0) {
    return (
      <p className="rounded-xl bg-gray-50 p-6 text-sm text-subtle">
        먼저 사전 테스트를 한 번 실행해야 사람 관측을 예측과 비교할 수 있어요.
      </p>
    );
  }
  return <ObservationEditor projectId={projectId} data={query.data} />;
}

function ObservationEditor({ projectId, data }: { projectId: string; data: HumanObservationList }) {
  const queryClient = useQueryClient();
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [participant, setParticipant] = useState("H-001");
  const [taskId, setTaskId] = useState(data.tasks[0].task_id);
  const [outcome, setOutcome] = useState<ObservationInput["outcome"]>("dropout");
  const [stageId, setStageId] = useState<string | null>(null);
  const [cause, setCause] = useState(data.causes[0]?.key ?? "unknown");
  const [purpose, setPurpose] = useState<ObservationInput["purpose"]>("calibration");
  const [painStage, setPainStage] = useState<string>(NONE);
  const [painCause, setPainCause] = useState(data.causes[0]?.key ?? "unknown");
  const [discomfort, setDiscomfort] = useState("3");
  const [touched, setTouched] = useState(false);
  const codeId = useId();
  const fileId = useId();

  const task = data.tasks.find((item) => item.task_id === taskId) ?? data.tasks[0];
  const stage = task.stages.find((item) => item.id === stageId) ?? task.stages[0];
  const code = participant.trim();
  const codeError =
    touched && !CODE_PATTERN.test(code) ? "영문·숫자·밑줄·하이픈 1~40자로 입력해주세요" : null;
  const key = `${code}|${task.task_id}`;
  const exists = data.items.some(
    (item) => item.participant_code === code && item.task_id === task.task_id,
  );
  const duplicate = exists && savedKey !== key;

  const onSaved = (next: HumanObservationList, message: string) => {
    queryClient.setQueryData(observationKey(projectId), next);
    useToastStore.getState().show(next.replaced ? "관측을 고쳤어요" : message);
  };
  const save = useMutation({
    mutationFn: () =>
      saveObservation(projectId, {
        participant_code: code,
        task_id: task.task_id,
        outcome,
        purpose,
        discomfort: Number(discomfort),
        ...(outcome === "dropout" ? { stage_id: stage.id, cause } : {}),
        ...(painStage !== NONE ? { pain_stage_id: painStage, pain_cause: painCause } : {}),
      }),
    onSuccess: (next) => {
      onSaved(next, "관측을 저장했어요");
      setSavedKey(key);
    },
  });
  const importFile = useMutation({
    mutationFn: async (file: File) =>
      importObservation(projectId, {
        task_id: task.task_id,
        purpose,
        record: JSON.parse(await file.text()) as unknown,
      }),
    onSuccess: (next) => onSaved(next, "기록 파일을 가져왔어요"),
  });
  const remove = useMutation({
    mutationFn: (id: number) => deleteObservation(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: observationKey(projectId) }),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (!CODE_PATTERN.test(code)) return;
    save.mutate();
  };
  const onFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) importFile.mutate(file);
    event.target.value = "";
  };
  const error = save.error ?? importFile.error;
  const count = (item: { matched: number; total: number }) => `${item.matched} / ${item.total}`;

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
      <form
        aria-labelledby="observe-form-title"
        noValidate
        onSubmit={submit}
        className="flex flex-col gap-4 p-4"
      >
        <h2 id="observe-form-title" className="font-bold text-ink">
          관측 추가
        </h2>
        {duplicate && (
          <p
            role="status"
            className="flex items-center gap-2 rounded-lg bg-gray-50 p-3 text-xs font-bold text-ink"
          >
            <Icon name="status-error" className="size-5 shrink-0 text-danger" />
            {code} 관측이 이미 있어요 · 저장하면 덮어써요
          </p>
        )}
        <div className="flex flex-col gap-2">
          <label htmlFor={codeId} className="text-xs text-ink">
            참여자 코드
          </label>
          <input
            id={codeId}
            value={participant}
            maxLength={40}
            aria-invalid={codeError != null}
            aria-describedby={codeError ? `${codeId}-error` : undefined}
            onChange={(event) => {
              setParticipant(event.target.value);
              setSavedKey(null);
            }}
            onBlur={() => setTouched(true)}
            className="min-h-10 rounded-lg bg-gray-50 px-3 text-caption text-ink"
          />
          {codeError && (
            <p id={`${codeId}-error`} className="text-xs text-danger">
              {codeError}
            </p>
          )}
          <p className="text-xs text-subtle">이름·연락처 대신 익명 코드만 써요</p>
        </div>
        <Picker
          label="과업"
          value={task.name}
          options={data.tasks.map((item) => item.name)}
          onSelect={(index) => {
            setTaskId(data.tasks[index].task_id);
            setStageId(null);
            setSavedKey(null);
          }}
        />
        <RadioRow
          legend="결과"
          name="outcome"
          value={outcome}
          options={[
            ["success", "완료"],
            ["dropout", "이탈"],
          ]}
          onChange={(value) => setOutcome(value as ObservationInput["outcome"])}
        />
        {outcome === "dropout" && (
          <>
            <Picker
              label="멈춘 단계"
              value={stage.name}
              options={task.stages.map((item, index) => `${index + 1}. ${item.name}`)}
              onSelect={(index) => setStageId(task.stages[index].id)}
            />
            <Picker
              label={`원인 (${data.causes.length - 1}종 + 미상)`}
              value={data.causes.find((item) => item.key === cause)?.name ?? cause}
              options={data.causes.map((item) => item.name)}
              onSelect={(index) => setCause(data.causes[index].key)}
            />
          </>
        )}
        <Picker
          label="가장 불편했던 화면"
          value={task.stages.find((item) => item.id === painStage)?.name ?? "특별히 없었어요"}
          options={["특별히 없었어요", ...task.stages.map((item) => item.name)]}
          onSelect={(index) => setPainStage(index === 0 ? NONE : task.stages[index - 1].id)}
        />
        {painStage !== NONE && (
          <Picker
            label="불편했던 이유"
            value={data.causes.find((item) => item.key === painCause)?.name ?? painCause}
            options={data.causes.map((item) => item.name)}
            onSelect={(index) => setPainCause(data.causes[index].key)}
          />
        )}
        <RadioRow
          legend="불편 정도"
          name="discomfort"
          value={discomfort}
          options={["1", "2", "3", "4", "5"].map((n) => [n, n] as const)}
          onChange={setDiscomfort}
        />
        <RadioRow
          legend="용도"
          name="purpose"
          value={purpose}
          options={PURPOSES}
          onChange={(value) => setPurpose(value as ObservationInput["purpose"])}
        />
        {error && (
          <p role="alert" className="text-xs text-danger">
            {error.message}
          </p>
        )}
        <div className="flex items-center justify-between gap-3">
          <label
            htmlFor={fileId}
            className="cursor-pointer text-caption font-bold text-ink underline underline-offset-4"
          >
            기록 파일 가져오기
          </label>
          <input
            id={fileId}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={onFile}
          />
          <Button type="submit" disabled={save.isPending}>
            {duplicate ? "기존 관측 고치기" : "관측 저장"}
          </Button>
        </div>
        <p className="text-xs text-subtle">
          기록 파일은 데모 사이트 recorder.js 가 내려받게 한 JSON 이에요 · 고른 과업·용도로 들어가고
          원인은 '원인 미상'이에요
        </p>
      </form>

      <div className="flex flex-col gap-8 lg:col-span-2">
        <KpiTrio
          items={[
            {
              label: "결과 일치",
              value: count(data.summary.outcome),
              note: data.summary_basis === "evaluation" ? "평가용 관측 기준" : "완료·이탈",
            },
            {
              label: "불편 화면 일치",
              value: count(data.summary.pain_screen),
              note: "모델 마찰 상위 2개 화면 안",
            },
            {
              label: "불편 이유 일치",
              value: count(data.summary.pain_cause),
              note: "그 화면에서 모델이 본 마찰",
            },
          ]}
        />
        <section aria-labelledby="observations-title" className="flex flex-col gap-3">
          <h2 id="observations-title" className="text-lg font-bold text-ink">
            입력한 관측 {data.items.length}건
          </h2>
          <table aria-labelledby="observations-title" className="w-full text-left text-caption">
            <thead>
              <tr className="border-b border-line text-xs text-muted">
                <th className="w-20 py-3 font-medium">참여자</th>
                <th className="w-28 py-3 font-medium">과업</th>
                <th className="w-14 py-3 font-medium">결과</th>
                <th className="w-24 py-3 font-medium">불편 화면</th>
                <th className="py-3 font-medium">이유</th>
                <th className="w-12 py-3 font-medium">정도</th>
                <th className="w-16 py-3 font-medium">용도</th>
                <th className="w-16 py-3 font-medium">예측과</th>
                <th className="w-10 py-3" aria-label="삭제" />
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <tr key={item.id} className="border-b border-line last:border-b-0">
                  <th scope="row" className="py-3 font-bold text-ink">
                    {item.participant_code}
                  </th>
                  <td className="py-3 text-gray-800">{item.task_name}</td>
                  <td className="py-3 text-gray-800">
                    {item.outcome === "success" ? "완료" : "이탈"}
                  </td>
                  <td className="py-3 text-gray-800">
                    {item.pain_stage_name ?? item.stage_name ?? "—"}
                  </td>
                  <td className="py-3 text-gray-800">
                    {item.pain_cause_name ?? item.cause_name ?? "—"}
                  </td>
                  <td className="py-3 text-gray-800">{item.discomfort ?? "—"}</td>
                  <td className="py-3 text-gray-800">
                    {item.purpose === "evaluation" ? "평가용" : "보정용"}
                  </td>
                  <td className={agrees(item) ? "py-3 font-bold text-ink" : "py-3 text-gray-800"}>
                    {agrees(item) ? "일치" : "다름"}
                  </td>
                  <td className="py-3 text-right">
                    <button
                      type="button"
                      aria-label={`${item.participant_code} 관측 삭제`}
                      onClick={() => remove.mutate(item.id)}
                      className="text-muted hover:text-ink"
                    >
                      <Icon name="close" className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-muted">
            비교: 사람이 고른 불편 화면이 모델이 마찰을 가장 많이 본 화면(상위 2개) 안에 있는지 ·
            가장 최근 사전 테스트 기준
          </p>
        </section>
        {agreementTrend(data.items).length > 1 && (
          <section aria-labelledby="agreement-trend-title" className="flex flex-col gap-3">
            <h2 id="agreement-trend-title" className="text-lg font-bold text-ink">
              불편 화면 일치율 추이
            </h2>
            <TrendLineChart
              title="응답이 쌓일수록 불편 화면 일치율"
              unit="%"
              domain={[0, 100]}
              data={agreementTrend(data.items)}
              series={[{ key: "rate", label: "누적 일치율", color: "#171717" }]}
            />
          </section>
        )}
      </div>
    </div>
  );
}

function RadioRow({
  legend,
  name,
  value,
  options,
  onChange,
}: {
  legend: string;
  name: string;
  value: string;
  options: readonly (readonly [string, string])[];
  onChange: (value: string) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-xs text-ink">{legend}</legend>
      <div className="flex gap-6">
        {options.map(([option, label]) => (
          <label key={option} className="flex min-h-8 items-center gap-2 text-caption text-ink">
            <input
              type="radio"
              name={name}
              value={option}
              checked={value === option}
              onChange={() => onChange(option)}
              className="size-4 accent-ink"
            />
            <span className={value === option ? "font-bold" : undefined}>{label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/* Figma 선택 필드 (회색 바탕 + 오른쪽 화살표) — 누르면 목록 메뉴 */
function Picker({
  label,
  value,
  options,
  onSelect,
}: {
  label: string;
  value: string;
  options: string[];
  onSelect: (index: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs text-ink">{label}</span>
      <DropdownMenu
        label={label}
        className="w-full"
        items={options.map((option, index) => ({
          key: option,
          label: option,
          selected: option === value || option.endsWith(`. ${value}`),
          onSelect: () => onSelect(index),
        }))}
        renderTrigger={(props) => (
          <button
            type="button"
            {...props}
            aria-label={`${label}: ${value}`}
            className="flex min-h-10 w-full items-center justify-between rounded-lg bg-gray-50 px-3 text-caption text-ink"
          >
            {value}
            <Icon name="chevron-right" className="size-4" />
          </button>
        )}
      />
    </div>
  );
}
