# web API 연동 가이드

`web/`에서 BE API를 부르는 방법입니다. 요청·응답 형태의 기준은 BE [`docs/API_SPEC.md`](https://github.com/Exitplain/BE/blob/main/docs/API_SPEC.md)이고, 이 저장소의 [`API_SPEC.md`](API_SPEC.md)는 사본입니다.

## 1. 현재 API 상태

| 구분 | 경로 | 상태 | 쓰는 화면 |
| --- | --- | --- | --- |
| 기본 진단 | `GET /api/state`, `POST /api/runs` | 구현됨 (개발 서버) | W01 일부 |
| 페르소나 실행 | `/api/personas`, `/discover`, `/confirm` | 구현됨 | P02~P11 |
| 질문·사람 관측 | `/api/personas/explain`, `/human` | 구현됨 | P15, K04 |
| 리포트·근거 | `/api/personas/report*`, `/api/artifacts/{id}` | 구현됨 | P12~P14 |
| 로그인 | `/api/v1/auth/*` (session, csrf, google, email/request·verify, logout) | 구현됨 (실서버) | L01~L10 |
| 제품 API | `/api/v1/*` (프로젝트, 공유, 실측, 보정 등) | **미구현** → mock | W, C, P17~P21, R, K |

개발 서버 API에는 인증·리소스 소유권 검사가 없습니다. 로그인(`/api/v1/auth/*`)은 실서버와만 통신합니다. 브라우저 mock 핸들러는 두지 않고, 테스트에서만 `mocks/node.ts`·`server.use(...)`로 응답을 흉내 냅니다. 엔드포인트·오류 코드는 BE의 Notion API 명세가 기준입니다.

위 표는 로컬 개발 서버(4174) 기준입니다. 배포된 실서버(`http://43.200.218.110`)는 모든 API가 `/api/v1/*`이고, 표의 버전 없는 `/api/*` 경로는 없습니다. 실서버에서 확인된 경로는 `GET /api/v1/auth/session`, `GET /api/v1/auth/csrf`, `POST /api/v1/auth/google`, `/api/v1/projects`, `POST /api/v1/runs`입니다(2026-11-15).

Vercel 배포본은 실서버 빌드(`build`)이고 `vercel.json` rewrite로 `/api/*`를 실서버에 넘깁니다. MSW는 켜지지 않습니다. ([WEB_SETUP.md](WEB_SETUP.md) 5절)

- 예전 mock 배포본에서 mock이 응답하던 `/api/personas*`, `POST /api/v1/persona-panels`, `GET /api/v1/projects/{id}/calibrations`, `GET /api/artifacts/{id}`도 이제 실서버로 갑니다. 실서버에 없는 경로는 404입니다.
- mock 핸들러(`src/mocks/handlers`)는 `npm run dev:mock`과 테스트에서만 씁니다.

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

`apis/axiosInstance.ts`의 응답 인터셉터가 둘 다 `ApiError`(`types/api.type.ts`) 하나로 바꿉니다. 화면에서는 `ApiError`의 `status`, `message`, `code`, `fields`만 봅니다. 서버에 연결하지 못하면 `status`가 0입니다. 제품 API 오류의 `request_id`는 `ApiError.requestId`에 남습니다. BE에 문의할 때 함께 전달합니다.

- 제품 API는 `code`로 분기합니다. `message` 문구는 바뀔 수 있으므로 문자열 비교에 쓰지 않습니다.
- `fields`는 입력별 메시지뿐 아니라 계획 확정 차단 사유(`fields.blocking` 배열) 같은 값도 담으므로 `Record<string, unknown>`입니다.

### CSRF (제품 API)

제품 API는 Django 세션과 CSRF를 씁니다. `axiosInstance`가 처리하므로 `*.api.ts`에서 따로 할 일은 없습니다.

- `/api/v1/*`로 가는 POST·PUT·PATCH·DELETE에 `X-CSRFToken` 헤더를 붙입니다. 토큰은 처음 한 번 `GET /api/v1/auth/csrf`로 받아 같이 씁니다.
- 토큰이 없거나 틀리면 Django가 JSON이 아닌 HTML 403을 돌려줍니다. 이때는 토큰을 새로 받아 한 번만 다시 보내고, 그래도 실패하면 `code`가 `CSRF_FAILED`인 `ApiError`가 됩니다. BE의 JSON 403(`FORBIDDEN`)은 권한 오류라 다시 보내지 않습니다.
- 로그인·로그아웃 뒤에는 `resetCsrfToken()`을 불러 토큰을 비웁니다.
- 토큰 발급은 테스트(`mocks/node.ts`)에서만 mock합니다. 브라우저 mock에 넣으면 Vercel 배포본이 가짜 토큰으로 실서버에 POST해 403이 됩니다.
- 개발 API(`/api/personas` 등)에는 붙이지 않습니다.
- 같은 origin이 전제입니다. `VITE_API_BASE_URL`은 비워 두고 dev 프록시나 Vercel rewrite로 부릅니다. 절대 주소(`http://43.200.218.110` 등)를 넣으면 cross-origin이 되어 세션·CSRF 쿠키가 실리지 않고, 제품 API POST가 모두 `CSRF_FAILED`가 됩니다.

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
| 공유 링크 만료 (v1) | 410 `SHARE_LINK_EXPIRED` | E17 화면 |
| CSRF 실패 (v1) | 403 `CSRF_FAILED` (FE가 붙인 코드) | 새로고침 안내 |

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

- `src/mocks/personaMock.ts`가 BE 개발 API를 메모리 상태로 흉내 냅니다. 탐색 → 확인(BE와 같은 검증 규칙) → 실행 진행 → 완료 → 목록·질문 → 리포트·내보내기·사람 관측까지 이어집니다.
- 리포트(`/api/personas/report`)는 완료된 mock 실행 기록에서 계산합니다. 시드 반복이 없어 예측 범위는 `[n, n]`이고, 화면 캡처가 없어 근거는 모두 `evidence_status: "missing"`입니다. 리포트 안쪽 필드 모양(퍼널·alignment 등)은 명세에 없어 `types/persona.type.ts`에 **임시**로 정의했습니다. BE 명세가 나오면 타입부터 고칩니다.
- Figma P12와 같게 보여주려고 명세에 없는 임시 필드도 mock이 채웁니다: 과업별 `segments`(히트맵, 실행 기록에서 계산), `median_duration`(스텝 수 × 15초 예시값), `actual`(실측 비교·P14 상태, **예시값**), 리포트 `conditions`(패널·시드·보정). 실측 수치는 실측 분석(R) API가 생기면 그 응답으로 바꿉니다.
- `GET /api/personas`를 부를 때마다 한 단계씩 진행합니다(동시 3세션, 과업 × 프로필 3개). 세션 결과는 정해 둔 예시입니다(빠른 구매=이탈, 여유 있는 탐색의 배송 지역 확인=실행 오류, 나머지=완료).
- 오류 화면은 `personaErrorHandlers`(`handlers/personas.ts`)로 재현합니다: `discoverUnavailable`(503), `confirmExpired`(400), `confirmRunning`(409), `personasNetworkError`, `reportsEmpty`, `reportNotFound`(404), `reportNetworkError`, `pdfBusy`(429), `pdfFailed`(503).
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
