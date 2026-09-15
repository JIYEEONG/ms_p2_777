# MOOV 개발 소스 복구 정보

- 복구 대상: `https://moov-autonomous-mobility.sonsome7.chatgpt.site`
- 운영 버전: Site V11
- 기준 소스 커밋: `0e4095026047df3487e8922ec501cec82353761b`
- 복구 확인일: 2026-09-14

## 바로 실행하기

별도 설치 없이 `dist/index.html`을 브라우저에서 열면 됩니다. 한 파일로 실행하려면 프로젝트 루트의 `moov_무인차_플랫폼_앱_V2.1.html`을 열어도 됩니다.

## 수정 위치

- 화면 구조와 문구: `dist/index.html`
- 디자인과 반응형 스타일: `dist/styles.css`
- 메뉴 전환과 앱 동작: `dist/app.js`
- 이미지 리소스: `dist/assets/`

## 단일 HTML 다시 만들기

`node tools/build-standalone.mjs`를 실행하면 `dist` 내용을 하나의 HTML 파일로 다시 묶을 수 있습니다.

