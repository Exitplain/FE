# 로그인 화면

Figma L01~L05, L08~L10 화면입니다. 실서버 `/api/v1/auth/*`와 통신합니다. 엔드포인트·오류 코드는 BE의 Notion API 명세가 기준입니다.

- `components/`: 카드, 이메일 폼, 코드 폼·입력, 구글 버튼(`GoogleLoginButton`), 로그인 전용 버튼, 세션 만료 안내
- `hooks/useLoginFlow.ts`: 이메일 → 코드 → 로그인 흐름과 요청(코드 요청·코드 확인·구글 로그인)
- `hooks/useCooldown.ts`: 코드 재전송 대기 카운트다운
- `authErrors.ts`: 오류 문구. Figma에 있는 문구(L04 코드 오류, L10 네트워크 오류)만 화면 문구를 쓰고 나머지는 BE `message`를 그대로 보여줍니다
- `utils/loadGoogleIdentity.ts`: Google Identity Services 스크립트를 로그인 화면에서만 불러옵니다
- 세션 조회·로그아웃·세션 반영은 `src/hooks/useAuthSession.ts`
- `login.css`: 로그인 전용 Tailwind 토큰
- `src/assets/login/`: Figma 원본 배경·Google 아이콘

## 흐름

| 단계                  | 요청                                                             | 화면 처리                                                                          |
| --------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 이메일 입력 (L01·L02) | `POST /api/v1/auth/email/request` → 202                          | 코드 화면으로 이동                                                                 |
|                       | 429 `RESEND_TOO_SOON` (`fields.retry_after`)                     | 코드 화면으로 이동, `0:42 후 ·코드 재전송` 카운트다운 동안 재전송 비활성           |
|                       | 503 `EMAIL_SEND_FAILED`, 422 `VALIDATION_ERROR`                  | 오류 박스에 BE 문구. 바로 다시 요청 가능                                           |
|                       | 응답 없음                                                        | L10 `로그인하지 못했어요 · 네트워크 연결을 확인하고 다시 시도하세요`               |
| 코드 입력 (L03~L05)   | `POST /api/v1/auth/email/verify` → 200 세션                      | 페이지는 대시보드로, 모달은 닫기                                                   |
|                       | 400 `CODE_INVALID`                                               | L04 `코드가 맞지 않습니다. 다시 한번 입력해 주세요`, 입력 유지                     |
|                       | 400 `CODE_EXPIRED`·`CODE_NOT_REQUESTED`, 429 `TOO_MANY_ATTEMPTS` | BE 문구                                                                            |
| 구글 (L01)            | GSI credential → `POST /api/v1/auth/google` → 200 세션           | 이메일 로그인과 같음. 400 `GOOGLE_TOKEN_INVALID`는 오류 박스에 BE 문구             |
| 들어올 때 (L08)       | `GET /api/v1/auth/session`                                       | `AppLayout`에서 사이드바 계정 표시를 맞춤. 비로그인은 200 `{authenticated: false}` |
| 로그아웃 (L08)        | `POST /api/v1/auth/logout` → 204                                 | 세션 캐시·계정 표시를 비움. 이미 끝난 세션(401)도 로그아웃으로 처리                |

로그인·로그아웃이 성공하면 CSRF 토큰을 비웁니다(`resetCsrfToken`). 코드 입력은 빈 칸을 공백으로 채운 6글자라 공백을 빼고 보내며, 6자리를 다 채워야 확인합니다.

## 구글 로그인

- `VITE_GOOGLE_CLIENT_ID`가 있으면 Google이 그리는 버튼(`continue_with`, pill)을 씁니다. 불러오는 중이거나 ID가 없거나 스크립트가 막히면 Figma 버튼을 비활성으로 보여줍니다.
- Google에 등록된 `http://localhost:5173`에서만 로그인됩니다. 다른 배포 주소는 BE가 Google에 등록하기 전까지 `VITE_GOOGLE_CLIENT_ID`를 넣지 않습니다(넣으면 버튼은 보이지만 `origin_mismatch`). 그동안은 이메일 로그인만 됩니다.

## 사이드바·세션 만료

- 로그인 전: 사이드바 하단 안내와 로그인 버튼 → 현재 페이지 위에 로그인 모달. 모달에서 로그인하면 원래 URL·쿼리·본문 입력을 유지합니다.
- 계정 표시는 `useDemoSessionStore`가 sessionStorage에 사본으로 둡니다. 기준은 서버 세션이며, 세션 응답이 오면 덮어씁니다.
- `/?auth=expired`(모달)·`/login?view=expired`(페이지)로 세션 만료 안내(L09)를 확인할 수 있습니다. 실제 만료 감지(401 `AUTH_REQUIRED`)와 입력 복원은 아직 연결하지 않았습니다.

## 로컬 확인

`VITE_API_BASE_URL`을 비우고 `VITE_API_PROXY_TARGET=http://43.200.218.110`으로 `npm run dev`를 띄웁니다. 실서버 쿠키가 `Secure`라 실서버 주소를 직접 부르면 로그인이 되지 않습니다. ([docs/WEB_SETUP.md](../../../../docs/WEB_SETUP.md) 4절)
