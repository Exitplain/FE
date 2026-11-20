# 기여 규칙

브랜치, 커밋, PR, 리뷰 규칙입니다. 코드 컨벤션은 [docs/WEB_CONVENTIONS.md](docs/WEB_CONVENTIONS.md)를 따릅니다.

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

[Conventional Commits](https://www.conventionalcommits.org/ko/v1.0.0/)의 타입만 씁니다. `feat(P12):`처럼 괄호 안 scope는 붙이지 않습니다. 어느 화면인지는 설명에 적습니다.

```
feat: P12 리포트 구역 이동 메뉴 추가
fix: W01 KPI 로딩 중 레이아웃 흔들림 수정
style: C02 프로젝트 카드 간격 Figma 기준으로 조정
refactor: Modal 닫기 로직 분리
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
- 공통 영역 변경은 기능 PR과 섞지 않습니다.
- 커밋 전에 `npm run format`을 실행합니다. CI가 lint, format 검사, 테스트, build를 확인합니다.

## 리뷰

- 요청받은 당일 안에 리뷰합니다.
- 구현 방식보다 아래를 먼저 봅니다.
  - Figma와 다른 곳
  - 공통 컴포넌트를 재사용했는지
  - 로딩·빈 상태·오류 처리
  - mock 값을 실측값처럼 보여주지 않는지
- 막는 의견(수정 필요)과 제안(선택)을 구분해서 적습니다.
