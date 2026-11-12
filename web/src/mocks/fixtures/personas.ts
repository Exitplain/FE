import type { PersonaRun } from "@/types/persona.type";

/*
  예시 응답 — BE docs/API_SPEC.md 4.2절 응답 예시 기준으로 작성.
  실제 실행 결과가 아닙니다. 화면에 실측값처럼 보이게 쓰지 않습니다.
*/
export const idlePersonaRun: PersonaRun = {
  id: "mock-run",
  status: "idle",
  variant: "fixed",
  policy: "scripted_fixture",
  model_calls: 0,
  profiles: [{ id: "quick", name: "빠른 구매", width: 390, max_required_fields: 2 }],
  sessions: [],
  audience: { ages: ["any"], context: "" },
};
