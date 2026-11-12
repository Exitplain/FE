# web 코드 컨벤션

`web/` 폴더 구조, 이름 규칙, 스타일 규칙입니다. 구조는 Allway 저장소를 기준으로 했습니다. 규칙을 바꾸려면 이 문서를 고치는 PR을 먼저 올립니다.

## 1. 폴더 구조

```
web/src/
  main.tsx            # QueryClientProvider, mock 모드면 MSW 시작
  App.tsx
  routes/index.tsx    # 전체 라우트                         — 공통
  layouts/            # AppLayout(사이드바), AuthLayout      — 공통
  components/         # 두 페이지 이상이 쓰는 UI             — 공통
    Button/Button.tsx
  pages/              # 화면 단위 폴더
    test-run/
      index.tsx       # 페이지 진입 파일
      components/     # 이 화면에서만 쓰는 컴포넌트
      hooks/          # 이 화면의 TanStack Query 훅
      utils/          # 이 화면에서만 쓰는 함수
  apis/               # axiosInstance.ts, queryKeys.ts, 도메인별 *.api.ts
  types/              # 도메인별 *.type.ts
  stores/             # zustand 스토어
  constants/          # routes.ts (라우트 표) 등 상수
  utils/              # cn.ts 등 공용 함수
  assets/             # 화면별 이미지 (assets/<화면>/)
  styles/index.css    # Tailwind + @theme 디자인 토큰
  mocks/              # browser.ts, handlers/, fixtures/
```

"공통"으로 표시한 폴더와 `constants/routes.ts`, `apis/axiosInstance.ts`, `apis/queryKeys.ts`는 공통 영역입니다. 변경 절차는 [COLLABORATION.md](COLLABORATION.md#공통-영역)를 따릅니다.

## 2. 이름 규칙

| 대상 | 규칙 | 예 |
| --- | --- | --- |
| 페이지 폴더 | kebab-case, 진입 파일 `index.tsx` | `pages/session-detail/index.tsx` |
| 페이지 컴포넌트 | PascalCase + `Page` | `SessionDetailPage` |
| 컴포넌트 | PascalCase 폴더와 파일, `export default` | `components/Button/Button.tsx` |
| 훅 | `use` + camelCase | `usePersonaRun.ts` |
| API 함수 파일 | `<도메인>.api.ts` | `persona.api.ts` |
| API 함수 | 동사 + 대상 | `getPersonaRun`, `confirmPersonaRun` |
| 타입 파일 | `<도메인>.type.ts` | `persona.type.ts` |
| zustand 스토어 | `use<이름>Store.ts` | `useNewTestStore.ts` |
| 상수 | UPPER_SNAKE_CASE | `POLLING_INTERVAL_MS` |
| 브랜치·커밋 | [CONTRIBUTING.md](../CONTRIBUTING.md) 참고 | `feat/P12-report-nav` |

- import는 `@/` 절대 경로를 씁니다. 같은 페이지 폴더 안에서는 `./` 상대 경로도 괜찮습니다.
- import 순서: 외부 패키지 → `@/` → 상대 경로. 그룹 사이에 빈 줄을 둡니다.
- 주석은 한국어로, "무엇을"보다 "왜"를 적습니다.

## 3. 컴포넌트를 어디에 둘지

```
이 화면에서만 쓴다          → pages/<화면>/components/
두 번째 화면도 쓰게 됐다     → src/components/ 로 옮기는 PR (공통 영역 절차)
레이아웃 틀이다             → src/layouts/
```

처음부터 공통 컴포넌트로 만들지 않습니다. 두 번째로 쓰일 때 옮기면서 props를 정합니다.

## 4. 상태 관리

| 상태 | 두는 곳 |
| --- | --- |
| 서버에서 받은 데이터 | TanStack Query (`pages/<화면>/hooks/`) |
| 한 컴포넌트 안의 입력·열림 상태 | `useState` |
| 여러 화면이 공유하는 입력값 (예: 새 테스트 P02~P05c 단계별 입력) | zustand (`stores/`) |
| URL로 표현할 수 있는 값 (선택한 실행, 필터, 탭) | 경로 파라미터나 쿼리 스트링 |

서버 데이터를 zustand에 복사하지 않습니다.

## 5. 스타일

- 색·간격·글꼴은 `styles/index.css`의 `@theme` 토큰 클래스만 씁니다.
- `bg-[#1a2b3c]`, `w-[257px]` 같은 임의값은 쓰지 않습니다. 필요하면 토큰을 추가하는 PR을 따로 올립니다.
- 조건부 클래스는 `cn()`으로 합칩니다.
- 클래스 순서는 Prettier 플러그인이 정렬하므로 직접 맞추지 않습니다.

### 현재 토큰

| 토큰 | 값 | 클래스 예 | 출처 |
| --- | --- | --- | --- |
| `gray-50` ~ `gray-900` | `#fbfbfb` ~ `#1a1a1a` (7단계) | `text-gray-700` | Figma 컬러팔레트 |
| `ink` | `#0a0a0a` | `text-ink` | 기존 saas-web |
| `muted` | `#737373` | `text-muted` | 기존 saas-web |
| `line` | `#e5e5e5` | `border-line` | 기존 saas-web |
| `surface` | `#ffffff` | `bg-surface` | 작업 영역 |
| `canvas` | `#f6ffea` | `bg-canvas` | 앱 배경 |
| `highlight` | `#ffdf92` | `bg-highlight` | 선택된 프로젝트 |
| `spacing-sidebar` | `257px` | `w-sidebar` | Figma W01 사이드바 |
| `font-sans` | Noto Sans KR | `font-sans` | 본문 |
| `font-logo` | Saira Stencil One | `font-logo` | 로고 |

Figma 컬러팔레트에 없는 강조색이 필요하면 디자인 담당과 먼저 확인합니다.

## 6. 공통 컴포넌트

| 컴포넌트 | 쓰이는 화면 | 담당 | 상태 |
| --- | --- | --- | --- |
| AppLayout (사이드바·작업 영역) | 로그인 후 전 화면 | 고명준 | 뼈대 완료 |
| AuthLayout | L01~L10, P21 | 고명준 | 뼈대 완료 |
| Button | 전 화면 | 고명준 | 완료 (primary, secondary, ghost / sm, md, lg) |
| PagePlaceholder | 미구현 화면 | 고명준 | 완료 (화면 구현 시 제거) |
| Input, Select, Checkbox | 전 화면 | 고명준 | 예정 |
| Modal, Toast | W07, C03, P04, P17, P20 등 | 고명준 | 예정 |
| EmptyState, ErrorState, Skeleton | E01~E20, 각 화면 로딩 | 고명준 | 예정 |
| Stepper (단계 표시) | P02~P05c | 팀원 | 예정 |
| StatusBadge (실행·세션 상태) | P01, P09, P11, W02 | 팀원 | 예정 |

새 공통 컴포넌트를 만들면 이 표에 추가합니다.
