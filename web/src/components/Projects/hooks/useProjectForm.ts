import { useRef, useState } from "react";

import { useCreateProject } from "@/hooks/useProjects";
import type { ProjectInput } from "@/types/project.type";
import { validateProjectInput } from "@/utils/projectInput";

export function useProjectForm() {
  const [values, setValues] = useState<ProjectInput>({ name: "", url: "", journey: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof ProjectInput, string>>>({});
  const [validationAttempt, setValidationAttempt] = useState(0);
  const submitting = useRef(false);
  const mutation = useCreateProject();

  function change(field: keyof ProjectInput, value: string) {
    setValues((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => {
      if (!previous[field]) return previous;
      const next = { ...previous };
      delete next[field];
      return next;
    });
    mutation.reset();
  }

  async function submit() {
    if (submitting.current) return null;
    const result = validateProjectInput(values);
    setErrors(result.errors);
    if (!result.valid) {
      setValidationAttempt((value) => value + 1);
      return null;
    }
    submitting.current = true;
    try {
      return await mutation.mutateAsync(result.value);
    } catch {
      return null;
    } finally {
      submitting.current = false;
    }
  }

  return {
    values,
    errors,
    validationAttempt,
    change,
    submit,
    ready: validateProjectInput(values).valid,
    pending: mutation.isPending,
    serverError: mutation.isError
      ? mutation.error instanceof Error
        ? mutation.error.message
        : "프로젝트를 만들지 못했어요. 다시 시도해 주세요"
      : null,
  };
}
