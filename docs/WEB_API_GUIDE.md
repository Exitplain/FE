# web API 연동 가이드

`web/`에서 BE API를 부르는 방법입니다. 요청·응답 형태의 기준은 BE [`docs/API_SPEC.md`](https://github.com/Exitplain/BE/blob/main/docs/API_SPEC.md)이고, 이 저장소의 [`API_SPEC.md`](API_SPEC.md)는 사본입니다.

## 1. 현재 API 상태

| 구분 | 경로 | 상태 | 쓰는 화면 |
| --- | --- | --- | --- |
| 기본 진단 | `GET /api/state`, `POST /api/runs` | 구현됨 (개발 서버) | W01 일부 |
| 페르소나 실행 | `/api/personas`, `/discover`, `/confirm` | 구현됨 | P02~P11 |
| 질문·사람 관측 | `/api/personas/explain`, `/human` | 구현됨 | P15, K04 |
| 리포트·근거 | `/api/personas/report*`, `/api/artifacts/{id}` | 구현됨 | P12~P14 |
| 제품 API | `/api/v1/*` (로그인, 프로젝트, 공유, 실측, 보정 등) | **미구현** → mock | L, W, C, P17~P21, R, K |

개발 서버 API에는 인증·리소스 소유권 검사가 없습니다. 로그인 화면은 `/api/v1`이 생길 때까지 mock으로 만듭니다.

## 2. 호출 흐름

```
컴포넌트 → pages/<화면>/hooks/useXxx.ts → apis/<도메인>.api.ts → apis/axiosInstance.ts → BE
                    (TanStack Query)          (axios 호출)          (오류 형태 통일)
```

- 컴포넌트에서 axios를 직접 부르지 않습니다.
- 쿼리 키는 `apis/queryKeys.ts`에서만 만듭니다.

예시 — 실행 상태 조회 (`hooks/usePersonaRun.ts`, 여러 화면이 함께 씀):

```ts
export function usePersonaRun() {
  return useQuery({
    queryKey: queryKeys.personas.current(),
    queryFn: getPersonaRun,
    refetchInterval: (query) =>
      query.state.data?.status === "running" ? POLLING_INTERVAL_MS : false,
  });
}
```

## 3. 타입

- 명세의 요청·응답을 `types/<도메인>.type.ts`에 옮깁니다.
- 필드 이름은 명세 그대로 snake_case로 씁니다. (`plan_id`, `task_ids`) camelCase로 바꾸지 않습니다.
- EXITPLAIN BE는 성공 응답을 래퍼로 감싸지 않습니다. Allway의 `ApiResponse<T>`처럼 `data.data`로 꺼내지 않습니다.
- 명세가 바뀌면 타입 파일을 먼저 고치고, 타입 오류가 나는 화면을 따라가며 수정합니다.

## 4. 오류 처리

BE 오류 응답은 두 가지 형태입니다.

| API | 형태 |
| --- | --- |
| 개발 API `/api/*` | `{ "error": "사용자에게 표시할 메시지" }` |
| 제품 API `/api/v1/*` | `{ "error": { "code", "message", "fields" }, "request_id" }` |

`apis/axiosInstance.ts`의 응답 인터셉터가 둘 다 `ApiError`(`types/api.type.ts`) 하나로 바꿉니다. 화면에서는 `ApiError`의 `status`, `message`, `code`, `fields`만 봅니다. 서버에 연결하지 못하면 `status`가 0입니다.

### 상태 코드별 화면 처리

| 상황 | 응답 | 화면 동작 |
| --- | --- | --- |
| `confirm` 계획 만료 | 400 | 사이트 확인(P02) 단계로 되돌림 |
| 진행 중인 실행이 있음 | 409 | 현재 실행(`GET /api/personas`)을 다시 조회 |
| 리포트 미완료 실행 | 409 | 실행 화면으로 안내, 과거 결과로 대체하지 않음 |
| PDF 생성 중 추가 요청 | 429 | 버튼 복구, 재시도 안내 |
| PDF 생성 실패 | 503 | E19 화면 |
| 로그인 만료 (v1) | 401 `AUTH_REQUIRED` | 원래 목적지를 보존하고 로그인 화면으로 |
| 입력 오류 (v1) | 422 `VALIDATION_ERROR` | `fields`의 메시지를 해당 입력 아래에 표시 |
| 공유 링크 만료 (v1) | 410 `SHARE_EXPIRED` | E17 화면 |

## 5. 실행 상태 polling

- BE에는 SSE·WebSocket이 없습니다. `GET /api/personas`를 주기적으로 조회합니다.
- `status`가 `running`일 때만 조회하고, `completed`·`idle`이면 멈춥니다.
- 실행이 `completed`여도 개별 세션은 오류로 끝날 수 있으므로 `sessions[].status`를 확인합니다.
- `simulated_dropout`만 가상 이탈로 표시합니다. `agent_failure`, `budget_exceeded` 같은 기술 실패를 이탈률에 합치지 않습니다.

## 6. mock 작성법

미구현 API(`/api/v1/*`)로 화면을 만들 때 MSW 핸들러를 추가합니다.

1. 응답 예시를 `src/mocks/fixtures/<도메인>.ts`에 명세 8절 형태 그대로 작성합니다. 타입을 붙여 명세와 어긋나면 컴파일 오류가 나게 합니다.
2. 핸들러를 `src/mocks/handlers/<도메인>.ts`에 만들고 `handlers/index.ts` 배열에 합칩니다.
3. `npm run dev:mock`으로 확인합니다.
4. BE가 구현하면 해당 핸들러만 지웁니다. 화면 코드는 바꾸지 않습니다.

```ts
// src/mocks/handlers/project.ts
import { http, HttpResponse } from "msw";

import { projectList } from "../fixtures/project";

export const projectHandlers = [
  http.get("*/api/v1/projects", () => HttpResponse.json({ items: projectList, next_cursor: null })),
];
```

### 페르소나 실행 mock (`/api/personas*`)

- `src/mocks/personaMock.ts`가 BE 개발 API를 메모리 상태로 흉내 냅니다. 탐색 → 확인(BE와 같은 검증 규칙) → 실행 진행 → 완료 → 목록·질문까지 이어집니다.
- `GET /api/personas`를 부를 때마다 한 단계씩 진행합니다(동시 3세션, 과업 × 프로필 3개). 세션 결과는 정해 둔 예시입니다(빠른 구매=이탈, 여유 있는 탐색의 배송 지역 확인=실행 오류, 나머지=완료).
- 오류 화면은 `personaErrorHandlers`(`handlers/personas.ts`)로 재현합니다: `discoverUnavailable`(503), `confirmExpired`(400), `confirmRunning`(409), `personasNetworkError`, `reportsEmpty`.
  - 테스트: `server.use(personaErrorHandlers.confirmExpired)`
- 테스트에서는 `src/test/setup.ts`가 테스트마다 mock 상태를 처음으로 돌립니다.
- 주의
  - 진행은 시간이 아니라 **조회 횟수** 기준입니다. 같은 쿼리를 여러 곳에서 다시 부르면(invalidate, StrictMode 등) 더 빨리 끝납니다.
  - 브라우저를 새로고침하면 mock 상태(탐색 계획 포함)가 사라집니다. 새로고침 뒤 confirm 은 계획 만료(400)로 응답합니다.
  - mock 은 항상 idle 에서 시작하지만, 실제 BE 는 저장된 최근 완료 실행을 복원해 첫 조회부터 `completed`일 수 있습니다.

### mock 데이터 원칙

- 실측값·보정값처럼 보이는 숫자를 지어내 화면에 보여주지 않습니다. 데모에서도 "예시 데이터"임을 알 수 있게 합니다.
- 실제 데이터가 없는 경우는 빈 상태(E01~E03)나 표본 부족(E09)으로 표시합니다.
- 오류 화면을 확인할 수 있도록 실패 응답 핸들러도 함께 만듭니다.

## 7. 명세와 다를 때

프론트에서 응답을 고쳐 맞추지 않습니다. BE 저장소에 이슈를 남깁니다.

- 제목: `[API] <메서드> <경로> — <화면 코드> <한 줄 요약>`
- 내용: 명세의 형태, 실제 응답, 재현 방법
