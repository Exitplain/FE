# 프론트엔드 협업 가이드

프론트엔드 2명이 `web/`을 나눠 개발하는 방법입니다. 원칙은 **화면 단위로 폴더를 나눠 서로 같은 파일을 건드리지 않는 것**입니다. 브랜치·커밋·PR 규칙은 [CONTRIBUTING.md](../CONTRIBUTING.md)에 있습니다.

## 1. 역할 분담

| 담당 | 화면 | 폴더 | API 상태 |
| --- | --- | --- | --- |
| 고명준 | 공통 UI, 레이아웃, 라우터 | `routes/`, `layouts/`, `components/`, `styles/` | — |
| 고명준 | L01~L10 로그인 | `pages/login/` | 미구현 → mock |
| 고명준 | W01, W07 대시보드·새 테스트 모달 | `pages/dashboard/` | 일부(`/api/state`) + mock |
| 고명준 | W02·W03 진단 기록·발견한 문제 | `pages/diagnosis-history/`, `pages/issues/` | 미구현 → mock |
| 고명준 | W04·W05 설정·시작 가이드 | `pages/settings/`, `pages/guide/` | 미구현 → mock |
| 고명준 | C02~C09 프로젝트 | `pages/project-list/`, `pages/project-detail/` | 미구현 → mock |
| 팀원 | P01, P02~P05c 테스트 목록·새 테스트 | `pages/test-list/`, `pages/new-test/` | 구현됨 |
| 팀원 | P06~P11 실행 | `pages/test-run/` | 구현됨 |
| 팀원 | P12~P16 리포트·세션 상세 | `pages/report/`, `pages/session-detail/` | 구현됨 |
| 팀원 | P17~P21 재테스트·비교·공유 | `pages/retest/`, `pages/shared-report/` | 미구현 → mock |
| 미정 | R01~R11 실측, K01~K04 보정 | `pages/analytics/`, `pages/calibration/` | 미구현 → 먼저 끝난 사람이 가져감 |

- 로딩·빈 상태·오류(E01~E20) 화면은 해당 화면 담당자가 공통 컴포넌트로 만듭니다.
- 사전 테스트(P) 흐름이 데모의 핵심입니다. R·K는 시간이 부족하면 데모에서 뺍니다.
- 경로와 화면 코드는 [web/README.md 라우트 표](../web/README.md#라우트-표)와 `web/src/constants/routes.ts`가 기준입니다.

## 2. 공통 영역

아래 파일은 둘 다 영향을 받는 공통 영역입니다.

- `src/routes/`, `src/layouts/`, `src/components/`, `src/styles/`
- `src/constants/routes.ts`
- `src/apis/axiosInstance.ts`, `src/apis/queryKeys.ts`
- `package.json` (의존성 추가)

고칠 때는 다음 순서를 따릅니다.

1. 채팅으로 무엇을 왜 바꾸는지 한 줄 알립니다.
2. 기능 PR과 섞지 않고 작은 PR로 따로 올립니다.
3. 상대가 리뷰한 뒤 먼저 머지하고, 각자 자기 브랜치를 rebase합니다.

다른 사람이 맡은 페이지 폴더를 고쳐야 하면 직접 고치지 않고 담당자에게 요청하거나 이슈를 남깁니다.

## 3. 완료 기준

보드에서 "완료"로 옮기려면 아래를 모두 만족해야 합니다.

- [ ] Figma와 비교한 스크린샷을 PR에 첨부
- [ ] 로딩·빈 상태·오류 화면 처리
- [ ] `npm run lint`, `npm run format:check`, `npm run build` 통과 (CI)
- [ ] mock을 쓰는 화면이면 PR에 표시
- [ ] 화면의 `PagePlaceholder` 제거

## 4. 소통

| 방법 | 언제 | 내용 |
| --- | --- | --- |
| 데일리 공유 | 매일 밤, 채팅 | 어제 한 일 / 오늘 할 일 / 막힌 점 / 공통 영역 변경 예정 |
| 싱크 | 주 2회 15분 (화요일은 동아리 정기회의 22시 직후) | 화면 공유로 합쳐진 결과 확인, 규칙 보완 |
| 보드 | 상시 | GitHub Projects, 화면 코드별 카드, `할 일 → 진행 중 → 리뷰 → 완료` |
| 결정 기록 | 결정 즉시 | 둘 다 영향받는 결정(토큰 추가, 구조 변경)은 이 문서나 관련 docs에 반영 |
| API 문제 | 발견 즉시 | BE 저장소 이슈 ([WEB_API_GUIDE.md](WEB_API_GUIDE.md#7-명세와-다를-때)) |

## 5. 첫 주 체크리스트

- [x] 초기 세팅: `web/` 생성, 라우트 표, 린트·CI, 프록시 (`chore/initial-setup`)
- [ ] 역할 분담과 이 문서 내용에 둘이 합의
- [ ] `main` 브랜치 보호 규칙 설정 (리뷰 1건, CI 통과 필수)
- [ ] GitHub Projects 보드 만들고 화면 코드별 카드 등록
- [ ] 팀원: Figma 색·글꼴 토큰을 확인하고 `@theme` 보완 PR
- [ ] 고명준: Input, Select, Modal, Toast, EmptyState, ErrorState, Skeleton
- [ ] 팀원: `types/persona.type.ts` 보완, Stepper·StatusBadge
- [ ] 첫 화면 하나씩 연결해 보기 (고명준 W01, 팀원 P02) → 싱크에서 규칙 보완

## 6. 아직 정할 것

- 해커톤 최종 발표일과 주차별 일정
- 데모 실행 방식: 발표 때 BE를 함께 띄울지, `npm run build:mock`으로 mock 데모를 배포할지
- 모바일 대응 범위: Figma가 데스크톱(사이드바 257px) 기준이라 최소 너비를 정해야 함
