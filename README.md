# Exitplain FE

[API 명세서](docs/API_SPEC.md) · [Figma UI 반영 내역](https://github.com/Exitplain/FE/blob/main/docs/FIGMA_IMPLEMENTATION.md)


DropSpot의 HTML/CSS/JavaScript 프론트엔드입니다. 별도 빌드 단계는 없습니다.

- `saas-web/`: SaaS 대시보드, 페르소나 실행 준비, 리포트 화면과 정적 자산.
- `demo-shop/`: 합성 데이터 기반 반찬로드 테스트 쇼핑몰과 폰트·이미지.
- 에이전트·개발 API·테스트·공통 설계 문서: [Exitplain/BE](https://github.com/Exitplain/BE).

## 실행

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
