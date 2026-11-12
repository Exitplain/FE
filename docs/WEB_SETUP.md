# web 초기 세팅 기록

작성일: 2026-11-12 · 대상: `web/` (React 앱)

`web/`을 어떤 도구로, 어떤 순서로 만들었는지와 그 이유를 남깁니다. 설정을 바꾸려면 먼저 이 문서를 확인하고, 바꾼 뒤에는 이 문서도 함께 고칩니다.

## 1. 기술 스택과 선택 이유

| 영역 | 선택 | 이유 |
| --- | --- | --- |
| 빌드 | Vite 8 + React 19 + TypeScript 6 | 설정이 가볍고 해커톤 일정에 맞음. Allway와 같은 구성 |
| 스타일 | Tailwind CSS 4 (`@tailwindcss/vite`) | 토큰을 `src/styles/index.css`의 `@theme` 한 곳에 정의 |
| 컴포넌트 변형 | `class-variance-authority` + `cn()` | Button처럼 variant가 있는 공통 UI. `cn()`은 `clsx` + `tailwind-merge` |
| 라우팅 | React Router 7 | 화면 코드별 페이지 분리 |
| 서버 상태 | TanStack Query 5 + axios | 실행 상태 polling, 캐시, 로딩·오류 처리 |
| 클라이언트 상태 | zustand 5 | 새 테스트 단계별 입력처럼 화면 사이에서 유지할 값만 |
| API mock | MSW 2 | 미구현 `/api/v1`을 핸들러만 지우면 실제 API로 전환 |
| 코드 품질 | ESLint 10 + Prettier 3 + `prettier-plugin-tailwindcss` | 클래스 순서까지 자동 정렬해 diff 충돌 감소 |

### 버전을 고정한 이유

- **TypeScript `~6.0`**: Vite 템플릿 기본값은 TypeScript 7이지만, `typescript-eslint`가 아직 7을 지원하지 않아 Allway와 같은 6으로 고정했습니다.
- **MSW `^2`**: MSW 3은 `worker.start()` 옵션이 `onUnhandledRequest`에서 `onUnhandledFrame`으로 바뀌는 등 API가 다릅니다. Allway와 같은 2를 씁니다.
- **ESLint**: Vite 템플릿 기본값인 oxlint 대신 Allway와 같은 ESLint 설정을 씁니다.

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

폰트와 Figma SVG는 `saas-web/assets/figma/`, `demo-shop/assets/`에서 `web/public/`으로 복사했습니다.

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
| `VITE_API_BASE_URL` | 비움 | 비우면 `/api/...` 요청이 dev 서버 프록시로 갑니다 |
| `VITE_API_PROXY_TARGET` | `http://127.0.0.1:4174` | 프록시가 요청을 넘길 BE 주소 |
| `VITE_USE_MOCK_API` | `false` | `true`이면 MSW가 `/api` 요청을 가로챕니다 |

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

이 처리는 개발 서버에만 해당합니다. 배포할 때는 BE와 같은 origin에서 제공하거나, BE의 Origin 검사 규칙을 함께 정해야 합니다.

## 6. 스크립트

| 명령 | 설명 |
| --- | --- |
| `npm run dev` | 개발 서버 (BE 프록시), http://localhost:5173 |
| `npm run dev:mock` | 개발 서버 (MSW mock) |
| `npm run build` | 타입 검사 + 프로덕션 빌드 |
| `npm run build:mock` | mock 데모 빌드 |
| `npm run lint` | ESLint |
| `npm run format` / `format:check` | Prettier 적용 / 검사 |

## 7. CI

`.github/workflows/web-ci.yml`이 `web/**`를 바꾼 PR과 `main` 푸시에서 아래를 실행합니다.

1. `npm ci`
2. `npm run lint`
3. `npm run format:check`
4. `npm run build`

하나라도 실패하면 머지하지 않습니다.

## 8. 자주 생기는 문제

| 증상 | 원인 | 해결 |
| --- | --- | --- |
| POST가 403 | Origin 헤더 불일치 | `npm run dev`로 실행했는지, BE 주소가 `VITE_API_PROXY_TARGET`과 같은지 확인 |
| `/api` 요청이 502·ECONNREFUSED | BE가 꺼져 있음 | BE에서 `python -m agent.console --port 4174` 실행, 또는 `npm run dev:mock` |
| mock 모드인데 실서버로 요청이 나감 | 핸들러 누락이나 경로 불일치 | 콘솔의 `[mocks] 처리되지 않은 API 요청` 경고 확인 후 `src/mocks/handlers/`에 추가 |
| `confirm` 400 | 탐색 계획이 15분 지나 만료 | 사이트 확인(`discover`) 단계부터 다시 진행 |
| CI에서 `format:check` 실패 | Prettier 미적용 | 커밋 전 `npm run format` |
