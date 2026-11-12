# Exitplain FE

[API 명세서](docs/API_SPEC.md) · [Figma UI 반영 내역](https://github.com/Exitplain/FE/blob/main/docs/FIGMA_IMPLEMENTATION.md) · [협업 규칙](CONTRIBUTING.md)

EXITPLAIN 프론트엔드 저장소입니다.

| 폴더 | 내용 | 상태 |
| --- | --- | --- |
| `web/` | React + TypeScript + Tailwind SaaS 앱 | **신규 개발 중** — [web/README.md](web/README.md) |
| `saas-web/` | 기존 HTML/CSS/JavaScript SaaS 화면 | 유지 (BE 개발 서버가 제공, `web/` 완성 후 정리) |
| `demo-shop/` | 합성 데이터 기반 반찬로드 테스트 쇼핑몰 | 유지 (페르소나 실행 대상) |
| `docs/` | API 명세 사본, Figma 반영 내역 | |

`saas-web/`과 `demo-shop/`은 BE의 `agent.console`, `agent.shop`이 FE 루트에서 직접 읽으므로 경로를 바꾸지 않습니다.
에이전트·개발 API·테스트·공통 설계 문서는 [Exitplain/BE](https://github.com/Exitplain/BE)에 있습니다.

## web 실행 (React 앱)

```bash
# BE 저장소, 가상환경에서
python -m agent.console --port 4174

# 이 저장소
cd web
npm install
npm run dev        # http://localhost:5173, /api 는 BE로 프록시
npm run dev:mock   # BE 없이 MSW mock으로 실행
```

자세한 내용은 [web/README.md](web/README.md), 협업 규칙은 [CONTRIBUTING.md](CONTRIBUTING.md)를 참고하세요.

## 기존 화면 실행 (saas-web, demo-shop)

BE와 FE를 같은 상위 폴더 아래에 클론한 다음 [BE 설치 안내](https://github.com/Exitplain/BE#분리-저장소-로컬-실행)를 따릅니다.
BE 가상환경에서 실행하세요.

```bash
cd ../BE
python -m agent.console --port 4174
# 별도 터미널에서
python -m agent.shop --port 4173
```

SaaS: http://localhost:4174 · 데모 쇼핑몰: http://localhost:4173/lab

BE의 개발 서버가 이 저장소의 화면과 `/api/*`를 같은 origin으로 제공합니다.
FE 위치가 다르면 BE 실행 전에 `DROPSPOT_FE_ROOT`를 FE 절대 경로로 설정합니다.
HTML 파일만 직접 열면 API와 쇼핑몰 라우팅이 동작하지 않습니다.
Skyvern 라이브 연결은 별도 설치가 필요하며 Django 운영 API 통합은 후속 작업입니다.

원본: [Jaehyeon-kr/dropspot_](https://github.com/Jaehyeon-kr/dropspot_/tree/c52730f5413cfeffb8b28b82b3eaa033a8a99b58), 커밋 `c52730f5413cfeffb8b28b82b3eaa033a8a99b58`의 스냅샷.
폰트 라이선스와 이미지 출처는 `demo-shop/README.md`와 `demo-shop/assets/OFL-NotoSansKR.txt`를 참고하세요.
