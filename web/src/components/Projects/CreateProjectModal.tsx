import { useEffect, useId, useRef } from "react";
import { useNavigate } from "react-router-dom";

import Button from "@/components/Button/Button";
import Field from "@/components/Field/Field";
import Input from "@/components/Input/Input";
import Modal from "@/components/Modal/Modal";
import { buildPath } from "@/constants/routes";
import { cn } from "@/utils/cn";

import { useProjectForm } from "./hooks/useProjectForm";

import "@/components/Projects/projects.css";

export default function CreateProjectModal({ onClose }: { onClose: () => void }) {
  const form = useProjectForm();
  const { values, errors, pending, ready } = form;
  const formRef = useRef<HTMLFormElement>(null);
  const navigate = useNavigate();
  const formId = useId();
  useEffect(() => {
    if (form.validationAttempt > 0)
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [form.validationAttempt]);
  return (
    <Modal
      open
      onClose={() => {
        if (!pending) onClose();
      }}
      title="새 프로젝트"
      description="진단할 사이트와 점검할 고객 여정을 정해주세요"
      footer={
        <>
          <Button variant="link" onClick={onClose} disabled={pending}>
            취소
          </Button>
          <Button
            type="submit"
            form={formId}
            disabled={pending}
            className={cn(!ready && "bg-gray-200 text-subtle")}
          >
            {pending ? "만드는 중…" : "만들기"}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        ref={formRef}
        noValidate
        className="project-create-fields space-y-6"
        onSubmit={async (event) => {
          event.preventDefault();
          const project = await form.submit();
          if (project) {
            onClose();
            navigate(buildPath("projectDetail", { projectId: project.id }));
          }
        }}
      >
        <Field label="프로젝트 이름" hint="필수" error={errors.name}>
          {(control) => (
            <Input
              {...control}
              placeholder="예: 반찬로드"
              value={values.name}
              disabled={pending}
              maxLength={80}
              onChange={(event) => form.change("name", event.target.value)}
            />
          )}
        </Field>
        <Field
          label="사이트 URL"
          hint="필수"
          error={errors.url}
          help="진단할 사이트 1개 = 프로젝트 1개"
        >
          {(control) => (
            <Input
              {...control}
              type="url"
              placeholder="https://"
              value={values.url}
              disabled={pending}
              onChange={(event) => form.change("url", event.target.value)}
            />
          )}
        </Field>
        <Field
          label="점검할 고객 여정"
          hint="선택"
          error={errors.journey}
          help="첫 사전 테스트의 목표 기본값으로 써요"
        >
          {(control) => (
            <Input
              {...control}
              placeholder="예: 첫 주문 완료"
              maxLength={120}
              value={values.journey}
              disabled={pending}
              onChange={(event) => form.change("journey", event.target.value)}
            />
          )}
        </Field>
        {form.serverError && (
          <p role="alert" className="text-caption text-danger">
            {form.serverError}
          </p>
        )}
      </form>
    </Modal>
  );
}
