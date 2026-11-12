# web 코드 컨벤션

`web/` 폴더 구조, 이름 규칙, 스타일 규칙입니다. 구조는 Allway 저장소를 기준으로 했습니다. 규칙을 바꾸려면 이 문서를 고치는 PR을 먼저 올립니다.

## 1. 폴더 구조

```
web/src/
  main.tsx            # QueryClientProvider, mock 모드면 MSW 시작
  App.tsx
  routes/index.tsx    # 전체 라우트                         — 공통
  layouts/            # 화면을 감싸는 틀                     — 공통
    AppLayout/        # AppLayout.tsx, Sidebar.tsx (로그인 후 화면)
    AuthLayout/       # AuthLayout.tsx (로그인, 공유 리포트)
  components/         # 두 페이지 이상이 쓰는 UI             — 공통
    Button/           # Button.tsx, buttonVariants.ts
    IconButton/       # IconButton.tsx, iconButtonVariants.ts
    InfoTip/InfoTip.tsx
    Icon/             # Icon.tsx, iconNames.ts
    MeshBackground/MeshBackground.tsx
    PagePlaceholder/PagePlaceholder.tsx
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
  assets/             # Figma 에서 내보낸 공통 에셋 + 화면별 이미지 (assets/<화면>/)
    icons/            # Figma `아이콘` 섹션 36개 → components/Icon 으로 사용
    characters/       # Figma `캐릭터` 섹션 (character-<표정>.svg)
    brand/            # 로고 마크
    background/       # 메쉬 배경 blob (mesh-blob-<색>.svg)
  styles/index.css    # Tailwind + @theme 디자인 토큰
  mocks/              # browser.ts(dev:mock), node.ts(테스트), handlers/, fixtures/
  test/               # setup.ts, renderWithProviders.tsx     — 공통
```

"공통"으로 표시한 폴더와 `constants/routes.ts`, `apis/axiosInstance.ts`, `apis/queryKeys.ts`는 공통 영역입니다.

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
| 테스트 | 대상 파일 옆에 `<대상>.test.ts(x)` | `utils/cn.test.ts` |
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
| `gray-50` ~ `gray-900` | `#fbfbfb` ~ `#1a1a1a` (50·100·200·300·400·500·700·800·900, 300 은 Button, 800 은 사이드바 메뉴·InfoTip 값) | `text-gray-700` | Figma 컬러팔레트 |
| `ink` | `#0a0a0a` | `text-ink` | 기존 saas-web |
| `muted` | `#737373` | `text-muted` | 기존 saas-web |
| `subtle` | `#525252` | `text-subtle` | muted 보다 진한 보조색 (Button 비활성 글자, 아이콘 버튼) |
| `line` | `#e5e5e5` | `border-line` | 기존 saas-web |
| `surface` | `#ffffff` | `bg-surface` | 작업 영역 |
| `canvas` | `#f6ffea` | `bg-canvas` | 앱 배경 |
| `highlight` | `#ffdf92` | `bg-highlight` | 선택된 프로젝트 |
| `veil` | `#ffffff8c` | `bg-veil` | 메쉬 배경 위 흰 베일 (BG/WhiteVeil) |
| `ink-pressed` | `#333333` | `active:bg-ink-pressed` | 검정 Button 눌림 |
| `surface-pressed` | `#ededed` | `active:bg-surface-pressed` | 흰색 Button 눌림 |
| `avatar` | `#999999` | `bg-avatar` | 사이드바 계정 아바타 |
| `danger` | `#c93638` | `text-danger` | 이탈·실패 (P01 실패 아이콘, P09 세션 타일 이탈) |
| `radius-tooltip` | `10px` | `rounded-tooltip` | InfoTip 말풍선 |
| `shadow-tooltip` | `0 8px 12px rgb(0 0 0 / .12)` | `shadow-tooltip` | InfoTip 말풍선 |
| `shadow-surface` | `0 8px 32px rgb(10 10 10 / .06)` | `shadow-surface` | 흰 작업 영역 (Surface/Work) |
| `shadow-dialog` | `0 16px 24px rgb(10 10 10 / .16)` | `shadow-dialog` | 모달 (Dialog/*) |
| `text-caption` | `13px / 18px` | `text-caption` | 아바타 글자 (페이지 부제에도 쓸 예정) |
| `spacing-sidebar` | `256px` | `w-sidebar` | Figma W01 사이드바 |
| `font-sans` | Noto Sans KR | `font-sans` | 본문 |
| `font-logo` | Saira Stencil One | `font-logo` | 로고 |

Figma 컬러팔레트에 없는 강조색이 필요하면 디자인 담당과 먼저 확인합니다.

예외: Figma 절대 좌표를 그대로 옮기는 장식 요소(`MeshBackground`의 blob 위치)는 데이터 배열 + `style`로 둡니다.

## 6. 공통 컴포넌트

| 컴포넌트 | 쓰이는 화면 | 담당 | 상태 |
| --- | --- | --- | --- |
| AppLayout (사이드바·작업 영역) | 로그인 후 전 화면 | 고명준 | 사이드바 템플릿 완료 (샘플 데이터) |
| MeshBackground | AppLayout (로그인 화면 작업 때 AuthLayout 에도 적용 예정) | 고명준 | 완료 |
| Icon | 전 화면 | 고명준 | 완료 (Figma 아이콘 섹션 36개 + 화면에서 쓰는 `play` 1개, `<Icon name="search" />`) |
| AuthLayout | L01~L10, P21 | 고명준 | 뼈대 완료 |
| Button | 전 화면 | 고명준 | 완료 (Figma 5종: primary=검정, secondary=흰색, outline=흰색 검은 테두리, link=밑줄, 비활성=`disabled` / 높이 40 하나) |
| InfoTip | 섹션 제목 옆 | 고명준 | 완료 (hover·focus 로 열림, Escape 로 닫힘) |
| IconButton | 모달 닫기, 행 삭제, 검색 지우기, 사이드바 검색 | 고명준 | 완료 (sm 24 / md 32 / lg 40, `label` 필수) |
| PagePlaceholder | 미구현 화면 | 고명준 | 완료 (화면 구현 시 제거) |
| Field + Input / TextArea | P02, P04, P05 등 입력 화면 | 사전 테스트 | 완료 (라벨·hint·도움말·오류를 Field 가 연결, `{(control) => <Input {...control} />}`) |
| ChoiceChip | P04, P05(과업·연령), P09(과업 전환) | 사전 테스트 | 완료 (선택=노란 바탕+체크, 여러 개=`aria-pressed`, 하나만=`kind="radio"` + radiogroup, md 40 / sm) |
| Modal | P04, W07, C03, P17, P20 등 | 사전 테스트 | 완료 (Escape·닫기·덮개 클릭으로 닫힘, 초점 이동·복귀, 스크롤 잠금, md 720 / lg 960) |
| EmptyState | E01~E03 등 빈 상태 | 사전 테스트 | 완료 (아이콘·제목·설명·action. 메쉬 띠는 화면에서 감쌈) |
| Stepper (단계 표시) | P02~P05c | 사전 테스트 | 완료 (지난 단계 체크, 현재 `aria-current="step"`) |
| StatusBadge (실행·세션 상태) | P01, P09, P11, W02 | 사전 테스트 | 완료 (tone: muted·strong·alert·danger, 상태→아이콘 매핑은 화면에서) |
| Select, Checkbox | 전 화면 | 고명준 | 예정 |
| Toast | P20, K03 등 | 고명준 | 예정 |
| ErrorState, Skeleton | E04~E20, 각 화면 로딩 | 고명준 | 예정 |

### Button·IconButton·InfoTip 규칙

- 버튼은 `<Button variant="secondary" icon="download">내보내기</Button>`처럼 씁니다. 크기 옵션은 없습니다(와이어프레임의 Button 인스턴스 284개가 모두 40px).
- 링크를 버튼 모양으로: `<Link className={buttonVariants({ variant: "outline" })}>` (`components/Button/buttonVariants.ts`).
- 로그인 "계속"(48px) · "Google로 계속하기"(50px)는 로그인 화면 전용으로 그 화면에서 만듭니다.
- 아이콘만 있는 클릭 요소는 `<IconButton icon="close" label="닫기" size="lg" />`을 씁니다. `label`(aria-label)은 필수입니다. 기본 색은 `subtle`, 연한 색은 `className="text-muted"`. 링크라면 `<Link aria-label="..." className={iconButtonVariants({ size: "md" })}>`.
- IconButton 의 hover(ink 5%)·눌림(ink 10%)은 Figma 에 정의가 없어 정한 값입니다. 디자인이 정해지면 `iconButtonVariants.ts` 만 고칩니다.
- InfoTip: `<div className="flex items-center gap-2"><h2>제목</h2><InfoTip text="..." /></div>`처럼 제목 **옆**에 둡니다(h2 안에 넣으면 설명이 제목에 섞여 읽힘). hover·focus 로 열리고 Escape 로 닫힙니다. `overflow:hidden`·`transform` 이 있는 부모 안에서는 말풍선이 잘리거나 가려질 수 있습니다.
- @theme 에 `--radius-*`·`--shadow-*`·`--text-*` 토큰을 추가하면 `utils/cn.ts` 의 `extendTailwindMerge` 에도 이름을 추가합니다.

### 아이콘·에셋 규칙

- 아이콘은 `<Icon name="search" />`로 씁니다. 기본 16px(`size-4`), 크기는 `className="size-5"`, 색은 `text-*`로 바꿉니다.
- 글자 없이 아이콘만 있는 버튼·링크는 버튼에 `aria-label`을 주거나 `<Icon label="..." />`을 씁니다. 장식 아이콘에는 label을 넣지 않습니다.
- 아이콘 선은 크기와 상관없이 2px 입니다(Figma 와 같음). `Icon` 이 `icon-stroke` 유틸리티(non-scaling-stroke)를 붙입니다.
- 새 아이콘은 Figma `아이콘` 섹션에서 SVG로 내보내 `src/assets/icons/<이름>.svg`에 저장하고(viewBox `0 0 24 24`, stroke `currentColor`) `components/Icon/iconNames.ts`에 이름을 추가합니다.
- 로고를 바꾸면 `src/assets/brand/logo-mark.svg`와 `public/favicon.svg`를 함께 바꿉니다.

새 공통 컴포넌트를 만들면 이 표에 추가합니다.
