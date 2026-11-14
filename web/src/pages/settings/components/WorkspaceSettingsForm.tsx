import { useState } from "react";

import Button from "@/components/Button/Button";
import Field from "@/components/Field/Field";
import Icon from "@/components/Icon/Icon";
import Input from "@/components/Input/Input";
import WorkspacePageHeader from "@/components/Workspace/WorkspacePageHeader";
import type { WorkspaceSettings } from "@/types/workspace.type";

import ExecutionDefaults from "./ExecutionDefaults";

export default function WorkspaceSettingsForm({
  initial,
  save,
}: {
  initial: WorkspaceSettings;
  save: (settings: WorkspaceSettings) => Promise<WorkspaceSettings>;
}) {
  const [values, setValues] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof WorkspaceSettings, string>>>({});
  const [saveError, setSaveError] = useState(false);
  const change = (key: keyof WorkspaceSettings, value: string) => {
    setValues((previous) => ({ ...previous, [key]: value }));
    setSaved(false);
    setSaveError(false);
  };
  return (
    <form
      noValidate
      className="space-y-12 text-ink"
      onSubmit={async (event) => {
        event.preventDefault();
        const nextErrors: typeof errors = {};
        if (!values.workspaceName.trim())
          nextErrors.workspaceName = "워크스페이스 이름을 입력해 주세요";
        if (!values.displayName.trim()) nextErrors.displayName = "이름을 입력해 주세요";
        if (
          values.notificationEmail.trim() &&
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.notificationEmail.trim())
        )
          nextErrors.notificationEmail = "이메일 주소를 확인해 주세요";
        setErrors(nextErrors);
        if (Object.keys(nextErrors).length) return;
        setPending(true);
        setSaveError(false);
        try {
          await save(values);
          setSaved(true);
        } catch {
          setSaveError(true);
        } finally {
          setPending(false);
        }
      }}
    >
      <WorkspacePageHeader
        title="워크스페이스 설정"
        actions={
          <Button type="submit" variant="outline" disabled={pending}>
            {pending ? "저장 중…" : "저장"}
          </Button>
        }
      />
      <section className="space-y-4">
        <h2 className="text-lg font-bold">기본 정보</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="워크스페이스 이름" error={errors.workspaceName}>
            {(control) => (
              <Input
                {...control}
                maxLength={80}
                value={values.workspaceName}
                onChange={(e) => change("workspaceName", e.target.value)}
              />
            )}
          </Field>
          <Field label="내 이름" error={errors.displayName}>
            {(control) => (
              <Input
                {...control}
                maxLength={40}
                value={values.displayName}
                onChange={(e) => change("displayName", e.target.value)}
              />
            )}
          </Field>
        </div>
        <Field
          label="이메일"
          error={errors.notificationEmail}
          help="리포트 완료·수집 중단 알림용 (알림 범위 확인 필요)"
        >
          {(control) => (
            <Input
              {...control}
              type="email"
              placeholder="알림 받을 이메일"
              value={values.notificationEmail}
              onChange={(e) => change("notificationEmail", e.target.value)}
            />
          )}
        </Field>
      </section>
      <ExecutionDefaults />
      <p className="text-xs text-muted">현재 설정은 이 탭에 저장되는 데모 설정이에요.</p>
      {saved && (
        <p
          role="status"
          className="fixed right-8 bottom-8 z-30 flex items-center gap-2 rounded-xl border border-line bg-surface px-5 py-4 text-sm shadow-tooltip"
        >
          <Icon name="check" />
          설정을 저장했어요
        </p>
      )}
      {saveError && (
        <p role="alert" className="text-sm text-danger">
          설정을 저장하지 못했어요. 브라우저 저장소를 확인하고 다시 시도해 주세요.
        </p>
      )}
    </form>
  );
}
