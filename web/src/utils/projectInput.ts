import type { ProjectInput } from "@/types/project.type";

export function validateProjectInput(input: ProjectInput) {
  const value = { name: input.name.trim(), url: input.url.trim(), journey: input.journey.trim() };
  const errors: Partial<Record<keyof ProjectInput, string>> = {};
  if (!value.name) errors.name = "프로젝트 이름을 입력해주세요";
  else if (value.name.length > 80) errors.name = "프로젝트 이름은 80자 이내로 입력해주세요";
  try {
    const parsed = new URL(value.url);
    if (
      !/^https?:$/.test(parsed.protocol) ||
      !parsed.hostname ||
      parsed.username ||
      parsed.password
    )
      throw new Error("url");
    value.url = parsed.href;
  } catch {
    errors.url = "HTTP 또는 HTTPS로 시작하는 주소를 입력해주세요";
  }
  if (value.journey.length > 120) errors.journey = "고객 여정은 120자 이내로 입력해주세요";
  return { value, errors, valid: Object.keys(errors).length === 0 };
}
