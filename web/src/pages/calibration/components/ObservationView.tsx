import { type FormEvent, useId, useState } from "react";

import Button from "@/components/Button/Button";
import DropdownMenu from "@/components/DropdownMenu/DropdownMenu";
import Icon from "@/components/Icon/Icon";
import { useToastStore } from "@/stores/useToastStore";

import {
  matchObservation,
  OBSERVATION_CAUSES,
  OBSERVATION_STAGES,
  OBSERVATION_TASKS,
  type Observation,
  observationsOf,
  sameObservation,
  useCalibrationMockStore,
} from "../data/calibrationMock";
import { KpiTrio } from "./CalibrationViews";

const CODE_PATTERN = /^[A-Za-z0-9_-]{1,40}$/;

/*
  K04 사람 관측 입력 · K04b 저장됨(토스트) · K04c 같은 참여자 코드(덮어쓰기 안내).
  임시: 저장은 화면 상태에만 남고(API 없음), 예측 비교도 고정 예측값으로 계산합니다.
*/
export default function ObservationView({ projectId }: { projectId: string }) {
  const observations = useCalibrationMockStore((state) => observationsOf(state, projectId));
  /* 방금 저장한 관측 (참여자·과업). 입력을 바꾸기 전에는 덮어쓰기 안내를 띄우지 않습니다 */
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [participant, setParticipant] = useState("H-004");
  const [task, setTask] = useState(OBSERVATION_TASKS[0]);
  const [outcome, setOutcome] = useState<Observation["outcome"]>("dropout");
  const [stage, setStage] = useState(3);
  const [cause, setCause] = useState(1);
  const [touched, setTouched] = useState(false);
  const codeId = useId();

  const code = participant.trim();
  const codeError =
    touched && !CODE_PATTERN.test(code) ? "영문·숫자·밑줄·하이픈 1~40자로 입력해주세요" : null;
  const key = `${code}|${task}`;
  const exists = observations.some((item) => sameObservation(item, code, task));
  const duplicate = exists && savedKey !== key;
  const count = (key: keyof Observation["matches"]) =>
    observations.filter((item) => item.matches[key]).length;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (!CODE_PATTERN.test(code)) return;
    const dropout = outcome === "dropout";
    const stageName = dropout ? OBSERVATION_STAGES[stage] : null;
    const causeName = dropout ? OBSERVATION_CAUSES[cause] : null;
    useCalibrationMockStore.getState().saveObservation(projectId, {
      participant: code,
      task,
      outcome,
      stage: stageName,
      cause: causeName,
      matches: matchObservation(outcome, stageName, causeName),
    });
    useToastStore.getState().show(exists ? "관측을 고쳤어요" : "관측을 저장했어요");
    setSavedKey(key);
  };

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
        </div>
        <Picker
          label="과업"
          value={task}
          options={OBSERVATION_TASKS}
          onSelect={(index) => {
            setTask(OBSERVATION_TASKS[index]);
            setSavedKey(null);
          }}
        />
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-xs text-ink">결과</legend>
          <div className="flex gap-6">
            {(
              [
                ["success", "완료"],
                ["dropout", "이탈"],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="flex min-h-8 items-center gap-2 text-caption text-ink">
                <input
                  type="radio"
                  name="outcome"
                  value={value}
                  checked={outcome === value}
                  onChange={() => setOutcome(value)}
                  className="size-4 accent-ink"
                />
                <span className={outcome === value ? "font-bold" : undefined}>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {outcome === "dropout" && (
          <>
            <Picker
              label="멈춘 단계"
              value={`${stage + 1}. ${OBSERVATION_STAGES[stage]}`}
              options={OBSERVATION_STAGES.map((name, index) => `${index + 1}. ${name}`)}
              onSelect={setStage}
            />
            <Picker
              label={`원인 (${OBSERVATION_CAUSES.length}종)`}
              value={OBSERVATION_CAUSES[cause]}
              options={OBSERVATION_CAUSES}
              onSelect={setCause}
            />
          </>
        )}
        <div className="flex justify-end">
          <Button type="submit">{duplicate ? "기존 관측 고치기" : "관측 저장"}</Button>
        </div>
      </form>

      <div className="flex flex-col gap-8 lg:col-span-2">
        <KpiTrio
          items={[
            {
              label: "결과 일치",
              value: `${count("outcome")} / ${observations.length}`,
              note: "완료·이탈",
            },
            {
              label: "단계 일치",
              value: `${count("stage")} / ${observations.length}`,
              note: "멈춘 단계",
            },
            {
              label: "원인 일치",
              value: `${count("cause")} / ${observations.length}`,
              note: `${OBSERVATION_CAUSES.length}종 기준`,
            },
          ]}
        />
        <section aria-labelledby="observations-title" className="flex flex-col gap-3">
          <h2 id="observations-title" className="text-lg font-bold text-ink">
            입력한 관측 {observations.length}건
          </h2>
          <table aria-labelledby="observations-title" className="w-full text-left text-caption">
            <thead>
              <tr className="border-b border-line text-xs text-muted">
                <th className="w-20 py-3 font-medium">참여자</th>
                <th className="w-16 py-3 font-medium">결과</th>
                <th className="w-20 py-3 font-medium">멈춘 단계</th>
                <th className="py-3 font-medium">원인</th>
                <th className="w-16 py-3 font-medium">예측과</th>
              </tr>
            </thead>
            <tbody>
              {observations.map((item) => (
                <tr
                  key={`${item.participant}|${item.task}`}
                  className="border-b border-line last:border-b-0"
                >
                  <th scope="row" className="py-3 font-bold text-ink">
                    {item.participant}
                  </th>
                  <td className="py-3 text-gray-800">
                    {item.outcome === "success" ? "완료" : "이탈"}
                  </td>
                  <td className="py-3 text-gray-800">{item.stage ?? "—"}</td>
                  <td className="py-3 text-gray-800">{item.cause ?? "—"}</td>
                  <td
                    className={
                      item.matches.outcome ? "py-3 font-bold text-ink" : "py-3 text-gray-800"
                    }
                  >
                    {item.matches.outcome ? "일치" : "다름"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
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
          selected: option === value,
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
