# 협업 규칙

프론트엔드 2명이 `web/`을 함께 개발하기 위한 규칙입니다. 원칙은 **화면 단위로 폴더를 나눠 서로 같은 파일을 건드리지 않는 것**입니다.

## 역할

| 담당 | 범위 |
| --- | --- |
| 고명준 | 공통 영역(`routes/`, `layouts/`, `components/`, `styles/`, `apis/axiosInstance.ts`), 로그인(L), 워크스페이스(W), 프로젝트(C) |
| 팀원 | 사전 테스트 흐름(P01~P21) |
| 미정 | 실측(R), 보정(K) — 먼저 끝난 사람이 가져가고, 시간이 부족하면 데모에서 제외 |

화면별 폴더와 경로는 [web/README.md의 라우트 표](web/README.md#라우트-표)를 따릅니다.

## 공통 영역

- `src/routes/`, `src/layouts/`, `src/components/`, `src/styles/`, `src/constants/routes.ts`, `src/apis/axiosInstance.ts`, `src/apis/queryKeys.ts`는 공통 영역입니다.
- 고치기 전에 채팅으로 한 줄 알리고, 기능 PR과 섞지 않고 작은 PR로 먼저 머지합니다.
- 다른 사람이 맡은 페이지 폴더를 고쳐야 하면 직접 고치지 않고 담당자에게 요청하거나 이슈를 남깁니다.

## 브랜치

`main`은 보호 브랜치입니다. 리뷰 1건과 CI 통과 후 squash 머지합니다.

```
종류/화면코드-설명

feat/P12-report-nav
fix/W01-kpi-loading
chore/setup-msw
docs/readme-routes
```

- 작업 전에 최신 `main`에서 브랜치를 만듭니다.
- 하루 넘게 걸리는 브랜치는 하루 한 번 `main`을 rebase합니다.
- 머지한 브랜치는 삭제합니다.

## 커밋

[Conventional Commits](https://www.conventionalcommits.org/ko/v1.0.0/)에 화면 코드를 scope로 붙입니다.

```
feat(P12): 리포트 구역 이동 메뉴 추가
fix(W01): KPI 로딩 중 레이아웃 흔들림 수정
style(C02): 프로젝트 카드 간격 Figma 기준으로 조정
refactor(common): Modal 닫기 로직 분리
chore: MSW 핸들러 파일 분리
docs: 라우트 표 갱신
```

| 타입 | 용도 |
| --- | --- |
| `feat` | 화면·기능 추가 |
| `fix` | 버그 수정 |
| `style` | 동작 변화 없는 UI 조정 |
| `refactor` | 동작 변화 없는 코드 정리 |
| `chore` | 설정, 의존성, 빌드 |
| `docs` | 문서 |

## PR

- 화면 1~2개, 변경 400줄 안팎으로 작게 올립니다. 작업 중이면 Draft PR로 먼저 엽니다.
- [PR 템플릿](.github/pull_request_template.md)의 Figma 링크와 스크린샷 비교를 채웁니다.
- 리뷰는 요청받은 당일 안에 합니다. 피그마와의 차이, 공통 컴포넌트 재사용, 로딩·빈 상태·오류 처리를 봅니다.

### 완료 기준

보드에서 "완료"로 옮기려면 아래를 모두 만족해야 합니다.

- [ ] Figma와 비교한 스크린샷 첨부
- [ ] 로딩·빈 상태·오류 화면 처리
- [ ] `npm run lint`, `npm run build` 통과 (CI)
- [ ] mock을 쓰는 화면이면 PR에 표시

## 소통

- **데일리 공유** (매일 밤, 채팅): 어제 한 일 / 오늘 할 일 / 막힌 점 / 공통 영역 변경 예정
- **싱크** (주 2회 15분): 화면 공유로 합쳐진 결과 확인
- **보드**: GitHub Projects에 화면 코드별 카드, `할 일 → 진행 중 → 리뷰 → 완료`
- **API 문제**: BE 저장소 이슈로 남기고 제목에 엔드포인트와 화면 코드를 적습니다.
