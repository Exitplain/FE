import { useEffect, useState } from "react";

import type { WorkspaceSettingsPatch, WorkspaceSettingsResponse } from "@/apis/workspace.api";
import Button from "@/components/Button/Button";
import Field from "@/components/Field/Field";
import Icon from "@/components/Icon/Icon";
import Input from "@/components/Input/Input";
import WorkspacePageHeader from "@/components/Workspace/WorkspacePageHeader";
import { ApiError } from "@/types/api.type";

import ExecutionDefaults from "./ExecutionDefaults";

/* BE WorkspaceUpdateSerializer 의 최대 길이 */
const MAX_NAME = 50;
/* 저장 완료 알림을 보여 주는 시간 */
const TOAST_MS = 3000;
/* W04: white, outlined 40px inputs; other screens keep the shared filled style. */
const settingsInputClass = "h-10 border border-gray-300 bg-surface py-2";

type Values = { workspaceName: string; myName: string };
type Errors = Partial<Record<keyof Values, string>>;

const valuesOf = (settings: WorkspaceSettingsResponse): Values => ({
  workspaceName: settings.workspace?.name ?? "",
  myName: settings.me.name ?? "",
});

/* 422 fields 의 첫 메시지 */
function fieldMessage(fields: Record<string, unknown> | undefined, key: string) {
  const value = fields?.[key];
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return undefined;
}

/*
  Figma W04 워크스페이스 설정 · W04b 저장 완료.
  - 저장 버튼은 바꾼 값이 있을 때만 켜지고, 저장하면 가운데에 "설정을 저장했어요" 를 띄웁니다 (W04b)
  - 바꾼 값만 보냅니다 (관리 권한이 없으면 워크스페이스 이름은 잠급니다)
  - 이메일은 로그인 이메일이라 바꿀 수 없습니다 (BE 에 알림 이메일 값이 없음)
*/
export default function WorkspaceSettingsForm({
  initial,
  save,
}: {
  initial: WorkspaceSettingsResponse;
  save: (body: WorkspaceSettingsPatch) => Promise<WorkspaceSettingsResponse>;
}) {
  const [savedValues, setSavedValues] = useState(() => valuesOf(initial));
  const [values, setValues] = useState(savedValues);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const owner = initial.workspace?.role === "owner";
  const nameLocked =
    initial.workspace == null
      ? "워크스페이스가 아직 없어요"
      : owner
        ? undefined
        : "관리 권한이 있어야 바꿀 수 있어요";

  /* 저장 알림은 잠시 뒤 닫습니다 (가운데를 계속 가리지 않게) */
  useEffect(() => {
    if (!saved) return;
    const timer = window.setTimeout(() => setSaved(false), TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [saved]);
  const dirty =
    values.workspaceName !== savedValues.workspaceName || values.myName !== savedValues.myName;

  const change = (key: keyof Values, value: string) => {
    setValues((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => ({ ...previous, [key]: undefined }));
    setSaved(false);
    setSaveError(null);
  };

  const submit = async () => {
    const nextErrors: Errors = {};
    if (owner && !values.workspaceName.trim())
      nextErrors.workspaceName = "워크스페이스 이름을 입력해 주세요";
    /* 이름이 비어 있는 계정도 있어(BE 허용) 바꿨을 때만 검사합니다 */
    if (values.myName !== savedValues.myName && !values.myName.trim())
      nextErrors.myName = "이름을 입력해 주세요";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    const body: WorkspaceSettingsPatch = {};
    if (owner && values.workspaceName !== savedValues.workspaceName)
      body.workspace_name = values.workspaceName.trim();
    if (values.myName !== savedValues.myName) body.my_name = values.myName.trim();

    setPending(true);
    setSaveError(null);
    try {
      const next = valuesOf(await save(body));
      setSavedValues(next);
      setValues(next);
      setSaved(true);
    } catch (error) {
      if (error instanceof ApiError && error.status === 422) {
        const fieldErrors = {
          workspaceName: fieldMessage(error.fields, "workspace_name"),
          myName: fieldMessage(error.fields, "my_name"),
        };
        setErrors(fieldErrors);
        if (!fieldErrors.workspaceName && !fieldErrors.myName) setSaveError(error.message);
      } else if (error instanceof ApiError && error.status === 403) {
        setSaveError("워크스페이스 이름은 관리 권한이 있어야 바꿀 수 있어요.");
      } else {
        setSaveError("설정을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <form
      noValidate
      className="space-y-12 text-ink"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <WorkspacePageHeader
        title="워크스페이스 설정"
        actions={
          <Button type="submit" variant="outline" disabled={!dirty || pending}>
            {pending ? "저장 중…" : "저장"}
          </Button>
        }
      />
      <section className="space-y-4">
        <h2 className="text-lg font-bold">기본 정보</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            className="gap-1"
            label="워크스페이스 이름"
            error={errors.workspaceName}
            help={nameLocked}
          >
            {(control) => (
              <Input
                {...control}
                className={settingsInputClass}
                maxLength={MAX_NAME}
                disabled={!owner}
                value={values.workspaceName}
                onChange={(e) => change("workspaceName", e.target.value)}
              />
            )}
          </Field>
          <Field className="gap-1" label="내 이름" error={errors.myName}>
            {(control) => (
              <Input
                {...control}
                className={settingsInputClass}
                maxLength={MAX_NAME}
                value={values.myName}
                onChange={(e) => change("myName", e.target.value)}
              />
            )}
          </Field>
        </div>
        <Field className="gap-1" label="이메일" help="로그인한 이메일이에요 · 바꿀 수 없어요">
          {(control) => (
            <Input
              {...control}
              className={settingsInputClass}
              type="email"
              readOnly
              value={initial.me.email}
            />
          )}
        </Field>
      </section>
      <ExecutionDefaults defaults={initial.run_defaults} />
      {saveError && (
        <p role="alert" className="text-sm text-danger">
          {saveError}
        </p>
      )}
      {saved && (
        <p
          role="status"
          className="pointer-events-none fixed top-1/2 left-1/2 z-30 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-xl border border-line bg-surface px-5 py-4 text-sm shadow-tooltip"
        >
          <Icon name="check" />
          설정을 저장했어요
        </p>
      )}
    </form>
  );
}
