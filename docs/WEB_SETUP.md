# web 초기 세팅 기록

작성일: 2026-11-12 · 대상: `web/` (React 앱)

`web/`을 어떤 도구로, 어떤 순서로 만들었는지와 그 이유를 남깁니다. 설정을 바꾸려면 먼저 이 문서를 확인하고, 바꾼 뒤에는 이 문서도 함께 고칩니다.

## 1. 기술 스택과 선택 이유

| 영역 | 선택 | 이유 |
| --- | --- | --- |
| 빌드 | Vite 8 + React 19 + TypeScript 6 | 설정이 가볍고 해커톤 일정에 맞음 |
| 스타일 | Tailwind CSS 4 (`@tailwindcss/vite`) | 토큰을 `src/styles/index.css`의 `@theme` 한 곳에 정의 |
| 컴포넌트 변형 | `class-variance-authority` + `cn()` | Button처럼 variant가 있는 공통 UI. `cn()`은 `clsx` + `tailwind-merge` |
| 라우팅 | React Router 7 | 화면 코드별 페이지 분리 |
| 서버 상태 | TanStack Query 5 + axios | 실행 상태 polling, 캐시, 로딩·오류 처리 |
| 클라이언트 상태 | zustand 5 | 새 테스트 단계별 입력처럼 화면 사이에서 유지할 값만 |
| API mock | MSW 2 | 미구현 `/api/v1`을 핸들러만 지우면 실제 API로 전환 |
| 차트 | recharts 3 | 퍼널·비교 막대 (`components/RangeBarChart`). 색은 SVG에도 토큰 클래스(`fill-*`)를 씁니다 |
| 코드 품질 | ESLint 10 + Prettier 3 + `prettier-plugin-tailwindcss` | 클래스 순서까지 자동 정렬해 diff 충돌 감소 |
| 테스트 | Vitest 5 + Testing Library + jsdom | Vite 설정·alias를 그대로 쓰고, MSW 핸들러를 `msw/node`로 재사용 |

### 버전을 고정한 이유

- **TypeScript `~6.0`**: Vite 템플릿 기본값은 TypeScript 7이지만, `typescript-eslint`가 아직 7을 지원하지 않아 6으로 고정했습니다.
- **MSW `^2`**: MSW 3은 `worker.start()` 옵션이 `onUnhandledRequest`에서 `onUnhandledFrame`으로 바뀌는 등 API가 다릅니다. 그래서 2를 씁니다.
- **ESLint**: Vite 템플릿 기본값인 oxlint 대신 ESLint 설정을 씁니다.

## 2. 기존 폴더를 옮기지 않은 이유

BE 개발 서버가 FE 루트의 폴더를 직접 읽습니다. 경로를 바꾸면 BE 실행과 페르소나 테스트가 깨집니다.

| BE 파일 | 읽는 경로 |
| --- | --- |
| `agent/frontend.py` | `DROPSPOT_FE_ROOT` (기본값: BE와 같은 상위 폴더의 `FE`) |
| `agent/console.py` | `saas-web/`, `demo-shop/` |
| `agent/shop.py` | `demo-shop/` |
| `agent/persona_report.py` | `saas-web/assets/mockups/signup-guest-v1.png` |
| `scripts/verify_harness.py` | `demo-shop/`, `saas-web/` 존재 확인 |

그래서 새 앱은 `web/`에 따로 만들었습니다. `saas-web/`은 `web/`이 완성되고 BE가 더 이상 참조하지 않을 때 정리합니다. `demo-shop/`은 페르소나 실행 대상이라 계속 유지합니다.

폰트는 `demo-shop/assets/`에서 `web/public/fonts/`로 복사했습니다. 아이콘·캐릭터·로고는 Figma `컴포넌트`·`아이콘`·`캐릭터` 섹션에서 내보내 `web/src/assets/`에 이름을 붙여 저장했습니다. 메쉬 배경 blob은 Figma 컴포넌트에 없어 `saas-web/assets/figma/`의 원본을 `web/src/assets/background/`로 옮겼습니다.

## 3. 재현 순서

처음부터 다시 만들 때의 명령입니다. 평소에는 `npm install`만 하면 됩니다.

```bash
npm create vite@latest web -- --template react-ts
cd web
npm i react-router-dom @tanstack/react-query axios zustand class-variance-authority clsx tailwind-merge
npm i -D typescript@~6.0.2 tailwindcss @tailwindcss/vite msw@^2 \
  eslint @eslint/js globals typescript-eslint eslint-plugin-react-hooks eslint-plugin-react-refresh \
  eslint-config-prettier prettier prettier-plugin-tailwindcss
npx msw init public --save
```

이후 추가한 설정 파일:

| 파일 | 내용 |
| --- | --- |
| `vite.config.ts` | `@` alias, Tailwind 플러그인, `/api` 프록시 |
| `tsconfig.app.json` | `paths: { "@/*": ["./src/*"] }` |
| `eslint.config.js` | Allway 설정 + `eslint-config-prettier` |
| `.prettierrc.json` | `printWidth: 100`, Tailwind 플러그인 |
| `.env.example`, `.env.mock` | 환경변수 (아래 4절) |
| `src/vite-env.d.ts` | 환경변수 타입 |

## 4. 환경변수

`.env.example`을 `.env.local`로 복사해서 씁니다. `.env.local`은 커밋하지 않습니다.

| 이름 | 기본값 | 설명 |
| --- | --- | --- |
| `VITE_API_BASE_URL` | 비움 | 비우면 `/api/...` 요청이 dev 서버 프록시로 갑니다. 로그인 쿠키 때문에 로컬에서는 **비워 둡니다** |
| `VITE_API_PROXY_TARGET` | `http://127.0.0.1:4174` (`.env.example`은 실서버 `http://43.200.218.110`) | 프록시가 요청을 넘길 BE 주소 |
| `VITE_USE_MOCK_API` | `false` | `true`이면 MSW가 `/api` 요청을 가로챕니다 |
| `VITE_GOOGLE_CLIENT_ID` | 비움 | 구글 로그인 버튼(GSI) 클라이언트 ID. 비우면 버튼이 비활성입니다 |

실서버의 `csrftoken`·`sessionid` 쿠키는 `Secure; SameSite=None`입니다. `VITE_API_BASE_URL`에 실서버 주소(`http://43.200.218.110`)를 직접 넣으면 브라우저가 쿠키를 저장하지 않아 로그인이 되지 않습니다. 프록시를 쓰면 `http://localhost:5173`과 같은 origin이고, 브라우저는 localhost를 안전한 주소로 봐서 Secure 쿠키를 저장합니다.

구글 로그인은 Google에 등록된 `http://localhost:5173`에서만 됩니다. IP 주소 배포본은 https 도메인이 생기기 전까지, Vercel 배포본은 BE가 그 도메인을 Google에 등록하기 전까지 이메일 코드 로그인만 쓸 수 있습니다. 지금은 BE에 테스트 사용자로 등록된 구글 계정만 로그인됩니다.

`.env.mock`은 비밀 값이 없어 커밋합니다. `npm run dev:mock`, `npm run build:mock`이 이 파일을 씁니다.

## 5. BE 프록시와 Origin 헤더

BE 개발 서버는 POST 요청에 Origin 헤더가 있으면, 그 값이 BE와 같은 포트의 `localhost` 또는 `127.0.0.1`일 때만 허용하고 나머지는 403을 돌려줍니다. (BE `docs/API_SPEC.md` 2절)

`web`은 5173 포트에서 뜨기 때문에 브라우저가 `Origin: http://localhost:5173`을 보내고, 그대로 넘기면 POST가 모두 403이 됩니다. 그래서 `vite.config.ts`의 프록시가 Origin 헤더를 BE 주소로 바꿔 보냅니다.

```ts
proxy.on("proxyReq", (proxyReq) => {
  if (proxyReq.getHeader("origin")) {
    proxyReq.setHeader("origin", new URL(proxyTarget).origin);
  }
});
```

이 처리는 개발 서버에만 해당합니다. 배포본은 아래 Vercel rewrite를 씁니다.

### Vercel 배포와 실서버 프록시

실서버(`http://43.200.218.110`, 모든 API가 `/api/v1/*`)는 HTTP만 지원하고 CORS 헤더가 없습니다. HTTPS인 Vercel 페이지에서 직접 부르면 mixed content·CORS로 막히므로, `vercel.json`의 rewrite로 Vercel이 대신 요청합니다. 브라우저 입장에서는 같은 origin이라 CORS가 필요 없습니다.

```json
"rewrites": [
  { "source": "/api/:path*", "destination": "http://43.200.218.110/api/:path*" },
  { "source": "/(.*)", "destination": "/index.html" }
]
```

- `/api` rewrite는 SPA fallback(`/(.*)`)보다 **앞에** 둡니다. 뒤에 두면 API 요청에 `index.html`이 돌아옵니다.
- 배포 빌드는 실서버 빌드 `build`입니다(2026-11-16, 이전에는 `build:mock`). MSW가 켜지지 않으므로 모든 `/api/*`가 실서버로 갑니다. 실서버에 없는 경로(버전 없는 `/api/personas*` 등)는 404입니다.
- Vercel 대시보드에 `VITE_USE_MOCK_API`·`VITE_API_BASE_URL`은 넣지 않습니다(`VITE_API_BASE_URL`이 비어야 rewrite를 탑니다).
- `VITE_GOOGLE_CLIENT_ID`는 BE가 Google에 배포 도메인(`https://exitplain.vercel.app` 등)을 등록한 **뒤에** 대시보드에 넣습니다. 등록 전에 넣으면 Google 버튼이 나타나지만 눌렀을 때 `origin_mismatch` 오류가 납니다. 넣지 않으면 버튼이 비활성이고 이메일 로그인만 됩니다.
- rewrite 대상에는 환경변수를 쓸 수 없습니다. 서버 주소가 바뀌면 `vercel.json`을 고치고 다시 배포합니다.
- Origin 헤더는 바뀌지 않고 `https://exitplain.vercel.app`으로 전달됩니다. POST가 CSRF 검사에 걸리지 않으려면 BE의 `CSRF_TRUSTED_ORIGINS`에 배포 도메인이 있어야 합니다. Preview 배포는 `*.vercel.app`의 다른 도메인이라 따로 등록하지 않으면 POST가 실패합니다.
- Vercel 외부 rewrite에는 프록시 타임아웃이 있습니다. 오래 걸리는 요청은 202 + 상태 polling으로 설계합니다.
- Vercel → 서버 구간은 평문 HTTP입니다. 로그인 연동 전에 서버 HTTPS(도메인·인증서)가 필요합니다.
- rewrite는 로컬·CI에서 검증되지 않습니다. 배포 후 브라우저 콘솔에서 `await (await fetch("/api/v1/auth/session")).json()`이 `{authenticated: false}`인지 확인합니다.

## 6. 스크립트

| 명령 | 설명 |
| --- | --- |
| `npm run dev` | 개발 서버 (BE 프록시), http://localhost:5173 |
| `npm run dev:mock` | 개발 서버 (MSW mock) |
| `npm run build` | 타입 검사 + 프로덕션 빌드 |
| `npm run build:mock` | mock 데모 빌드 (Vercel 배포에는 쓰지 않음) |
| `npm run lint` | ESLint |
| `npm run format` / `format:check` | Prettier 적용 / 검사 |
| `npm run test` / `test:run` | Vitest 감시 모드 / 1회 실행 |

### 테스트 작성 규칙

- 테스트 파일은 대상 옆에 `*.test.ts(x)`로 둡니다. (예: `utils/cn.ts` → `utils/cn.test.ts`)
- 테스트 대상: 검증·계산 로직(순수 함수), zustand 스토어 액션, API 훅, 화면 동작. 스타일은 테스트하지 않습니다.
- API는 `src/mocks/handlers`가 `msw/node`로 응답합니다. 핸들러가 없는 요청은 테스트를 실패시킵니다.
  테스트별 응답은 `server.use(...)`로 덮어쓰고, 각 테스트 뒤에 원래대로 돌아갑니다.
- Query·Router가 필요한 컴포넌트는 `src/test/renderWithProviders.tsx`로 렌더링합니다.
- `describe`·`it`·`expect`는 `vitest`에서 직접 import합니다(globals 미사용).

## 7. CI

`.github/workflows/web-ci.yml`이 `web/**`를 바꾼 PR과 `main`·`develop` 푸시에서 아래를 실행합니다.

1. `npm ci`
2. `npm run lint`
3. `npm run format:check`
4. `npm run test:run`
5. `npm run build`

하나라도 실패하면 머지하지 않습니다.

## 8. 자주 생기는 문제

| 증상 | 원인 | 해결 |
| --- | --- | --- |
| POST가 403 | Origin 헤더 불일치 | `npm run dev`로 실행했는지, BE 주소가 `VITE_API_PROXY_TARGET`과 같은지 확인 |
| `/api` 요청이 502·ECONNREFUSED | BE가 꺼져 있음 | BE에서 `python -m agent.console --port 4174` 실행, 또는 `npm run dev:mock` |
| mock 모드인데 실서버로 요청이 나감 | 핸들러 누락이나 경로 불일치 | 콘솔의 `[mocks] 처리되지 않은 API 요청` 경고 확인 후 `src/mocks/handlers/`에 추가 |
| `confirm` 400 | 탐색 계획이 15분 지나 만료 | 사이트 확인(`discover`) 단계부터 다시 진행 |
| CI에서 `format:check` 실패 | Prettier 미적용 | 커밋 전 `npm run format` |
