import type { ProjectInput } from "@/types/project.type";

/* 사이트 주소는 프로젝트를 만들 때 받지 않습니다. 새 테스트 1단계에서 입력하면 서버가 프로젝트에 등록합니다 */
export function validateProjectInput(input: ProjectInput) {
  const value = { name: input.name.trim(), journey: input.journey.trim() };
  const errors: Partial<Record<keyof ProjectInput, string>> = {};
  if (!value.name) errors.name = "프로젝트 이름을 입력해주세요";
  else if (value.name.length > 80) errors.name = "프로젝트 이름은 80자 이내로 입력해주세요";
  if (value.journey.length > 120) errors.journey = "고객 여정은 120자 이내로 입력해주세요";
  return { value, errors, valid: Object.keys(errors).length === 0 };
}
