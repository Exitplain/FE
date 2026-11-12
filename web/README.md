# EXITPLAIN Web

EXITPLAIN SaaS 화면의 React 앱입니다. 기존 `../saas-web/`(HTML·CSS·JS)을 대체하기 위해 새로 만들며, 화면 기준은 [4호선톤 Figma 와이어프레임](https://www.figma.com/design/XYkGMN8Avldbl3SN65vEsr?node-id=0-1)입니다.

> `../saas-web/`과 `../demo-shop/`은 옮기거나 지우지 않습니다. BE 개발 서버(`agent.console`, `agent.shop`)가 FE 루트의 두 폴더를 직접 읽습니다.

## 기술 스택

| 영역            | 사용                                                               |
| --------------- | ------------------------------------------------------------------ |
| 빌드            | Vite 8, React 19, TypeScript 6                                     |
| 스타일          | Tailwind CSS 4 (`@theme` 토큰), `class-variance-authority`, `cn()` |
| 라우팅          | React Router 7                                                     |
| 서버 상태       | TanStack Query 5 + axios                                           |
| 클라이언트 상태 | zustand (화면 사이에서 유지할 값만)                                |
| API mock        | MSW 2                                                              |
| 코드 품질       | ESLint, Prettier(`prettier-plugin-tailwindcss`)                    |

## 실행

Node 22 이상이 필요합니다.

```bash
cd web
npm install
cp .env.example .env.local
```

**BE와 함께 실행** — BE 저장소에서 개발 서버를 먼저 띄웁니다. ([BE 설치 안내](https://github.com/Exitplain/BE#분리-저장소-로컬-실행))

```bash
# BE 저장소, 가상환경에서
python -m agent.console --port 4174

# FE 저장소
cd web
npm run dev          # http://localhost:5173
```

dev 서버가 `/api/*` 요청을 `VITE_API_PROXY_TARGET`(기본 `http://127.0.0.1:4174`)으로 넘깁니다. BE는 다른 포트에서 온 POST를 403으로 막기 때문에, 프록시가 Origin 헤더를 BE 주소로 바꿔 보냅니다.

**BE 없이 실행 (mock)** — 아직 구현되지 않은 `/api/v1` 화면을 만들 때 사용합니다.

```bash
npm run dev:mock     # .env.mock 사용, MSW가 /api 요청을 가로챕니다
```

## 스크립트

| 명령                              | 설명                      |
| --------------------------------- | ------------------------- |
| `npm run dev`                     | 개발 서버 (BE 프록시)     |
| `npm run dev:mock`                | 개발 서버 (MSW mock)      |
| `npm run build`                   | 타입 검사 + 프로덕션 빌드 |
| `npm run build:mock`              | mock 데모 빌드            |
| `npm run lint`                    | ESLint                    |
| `npm run format` / `format:check` | Prettier 적용 / 검사      |

## 폴더 구조

```
web/
  .env.example          # 환경변수 설명 (복사해서 .env.local)
  .env.mock             # mock 모드 설정 (비밀 값 없음)
  public/               # 폰트, 로고, Figma SVG, mockServiceWorker.js
  src/
    main.tsx            # QueryClientProvider, mock 모드면 MSW 시작
    App.tsx
    routes/index.tsx    # 전체 라우트 — 공통
    layouts/            # AppLayout(사이드바), AuthLayout — 공통
    components/         # 두 페이지 이상이 쓰는 UI — 공통
      Button/Button.tsx
    pages/              # 화면 단위, kebab-case
      test-run/
        index.tsx
        components/     # 이 화면에서만 쓰는 컴포넌트
        hooks/          # 이 화면의 TanStack Query 훅 (usePersonaRun.ts)
    apis/               # axiosInstance.ts, queryKeys.ts, 도메인별 *.api.ts
    types/              # 도메인별 *.type.ts
    stores/             # zustand, use*Store.ts
    constants/          # routes.ts (라우트 표)
    utils/              # cn.ts
    assets/             # 화면별 이미지
    styles/index.css    # Tailwind + @theme 디자인 토큰
    mocks/              # browser.ts, handlers/, fixtures/
```

### 규칙

- 페이지 폴더는 kebab-case, 진입 파일은 `index.tsx`입니다. 컴포넌트 폴더와 파일은 PascalCase입니다.
- 한 페이지에서만 쓰는 컴포넌트는 `pages/<페이지>/components/`에 둡니다. 두 번째 페이지가 쓰게 되면 `src/components/`로 옮깁니다.
- 화면에서 axios를 직접 부르지 않습니다. `apis/*.api.ts` 함수 → `pages/<페이지>/hooks/` 훅 → 컴포넌트 순서로 씁니다.
- 쿼리 키는 `apis/queryKeys.ts`에서만 만듭니다.
- 서버 데이터는 TanStack Query에만 두고, zustand에는 여러 화면이 공유하는 입력값만 둡니다.
- 색·간격·글꼴은 `styles/index.css`의 `@theme` 토큰 클래스를 씁니다. `bg-[#...]` 같은 임의값은 쓰지 않습니다.
- import는 `@/` 절대 경로를 씁니다.

## 라우트 표

모든 화면이 빈 페이지(`PagePlaceholder`)로 미리 등록돼 있습니다. 화면을 만들기 시작하면 해당 `index.tsx`에서 `PagePlaceholder`를 지웁니다. 경로 문자열은 `src/constants/routes.ts`에서만 관리합니다.

| 경로                               | 화면                    | Figma    | 폴더                      | 담당   |
| ---------------------------------- | ----------------------- | -------- | ------------------------- | ------ |
| `/login`                           | 로그인                  | L01~L10  | `pages/login`             | 고명준 |
| `/`                                | 대시보드·새 테스트 모달 | W01, W07 | `pages/dashboard`         | 고명준 |
| `/history`                         | 진단 기록               | W02      | `pages/diagnosis-history` | 고명준 |
| `/issues`                          | 발견한 문제             | W03      | `pages/issues`            | 고명준 |
| `/settings`                        | 워크스페이스 설정       | W04      | `pages/settings`          | 고명준 |
| `/guide`                           | 시작 가이드             | W05      | `pages/guide`             | 고명준 |
| `/projects`                        | 프로젝트 찾기·생성      | C02~C04  | `pages/project-list`      | 고명준 |
| `/projects/:projectId`             | 프로젝트 개요           | C05~C09  | `pages/project-detail`    | 고명준 |
| `/projects/:projectId/tests`       | 사전 테스트 목록        | P01      | `pages/test-list`         | 팀원   |
| `/tests/new`                       | 새 테스트               | P02~P05c | `pages/new-test`          | 팀원   |
| `/runs/:runId`                     | 실행 준비·실행·분석     | P06~P11  | `pages/test-run`          | 팀원   |
| `/runs/:runId/report`              | 리포트                  | P12~P14  | `pages/report`            | 팀원   |
| `/runs/:runId/sessions/:sessionId` | 세션 상세               | P15~P16  | `pages/session-detail`    | 팀원   |
| `/runs/:runId/retest`              | 재테스트 전후 비교      | P17~P18  | `pages/retest`            | 팀원   |
| `/share/:shareId`                  | 공유 리포트             | P20~P21  | `pages/shared-report`     | 팀원   |
| `/projects/:projectId/analytics`   | 실측 분석               | R01~R11  | `pages/analytics`         | 미정   |
| `/projects/:projectId/calibration` | 보정                    | K01~K04  | `pages/calibration`       | 미정   |

로딩·빈 상태·오류(E01~E20) 화면은 각 화면 담당자가 공통 컴포넌트로 함께 만듭니다.

## API 연동

- 기준 문서: BE [`docs/API_SPEC.md`](https://github.com/Exitplain/BE/blob/main/docs/API_SPEC.md). 사본은 `../docs/API_SPEC.md`.
- 지금 동작하는 API는 개발 서버의 `/api/personas/*`, `/api/state`, `/api/artifacts/*`입니다. 제품 API `/api/v1/*`은 아직 구현 전입니다.
- 타입은 명세 필드 이름(snake_case) 그대로 `types/*.type.ts`에 둡니다.
- 오류는 `apis/axiosInstance.ts`가 개발 API `{ error: "..." }`와 제품 API `{ error: { code, message, fields } }`를 `ApiError` 하나로 바꿉니다. EXITPLAIN BE는 성공 응답을 래퍼로 감싸지 않습니다.
- 실행 상태(`/api/personas`)는 `status === "running"`일 때만 polling합니다. 예시: `pages/test-run/hooks/usePersonaRun.ts`
- 미구현 API는 `mocks/handlers/`에 명세 8절 형태 그대로 추가하고, BE가 구현하면 해당 핸들러만 지웁니다.
- mock 값을 실측값처럼 화면에 보여주지 않습니다. 데이터가 없으면 빈 상태나 표본 부족으로 표시합니다.
- 명세와 실제 응답이 다르면 프론트에서 맞추지 말고 BE 저장소에 이슈를 남깁니다.

협업 규칙(브랜치, 커밋, PR, 리뷰)은 [CONTRIBUTING.md](../CONTRIBUTING.md)를 따릅니다.
