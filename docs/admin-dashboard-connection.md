# MOOV 관리자 페이지 백엔드 연결

## 연결 구조

관리자 페이지의 화면 구조와 스타일은 유지하고, `front/public/dashboard/integration.js`가 기존 화면 스크립트보다 먼저 서버 데이터를 준비한다.

```text
/dashboard/ (기존 관리자 UI)
  └─ integration.js
      ├─ /api/admin/*        관리자 설정·상품·차량·이벤트·결제·파일
      ├─ /api/auth/*         Google/로컬 데모 세션
      ├─ /api/maps/*         네이버 지도 SDK 설정·검색·길찾기
      ├─ /api/outing/*       앱 나들이 데이터
      └─ /api/hot-products   인기 상품·재고 추천
             ↓
        FastAPI + PostgreSQL + Azure Blob Storage
```

- 앱: `/`
- 관리자: `/dashboard/#dashboard`
- Next.js 관리자 래퍼: `/dashboard`
- 관리자 API: `backend/admin_api.py`
- 프런트 프록시: `front/server.mjs`

## 서버에 저장되는 항목

| 화면 데이터 | 서버 저장 위치 |
| --- | --- |
| 상품·재고, 운영 활동, 차량 환경 테마, 선택 테마 | `moov.admin_state` |
| 차량 현재 상태·운영 조치 | `moov.admin_state` |
| AI 프롬프트·페르소나, OTT·웰니스·콘텐츠 테마 | `moov.admin_state` (ETag 충돌 검사) |
| AI 사용량·차량 상태 보고 JSON | `moov.admin_event_imports` |
| 결제 원장 JSON | `moov.admin_payments` |
| 테마 이미지·음원 메타데이터 | `moov.admin_assets` |
| 테마 이미지·음원 원본 | Azure Blob `admin-assets` 컨테이너 |
| 회원 목록 | 기존 `moov.users` 조회 |

브라우저 저장소는 앱과 관리자 화면 사이의 즉시 반영 및 백엔드 장애 시 로컬 호환용으로만 남는다. 백엔드 연결이 정상이고 관리자 인증을 통과하면 서버 상태가 우선이다.

## 관리자 권한 설정

운영 환경에서는 `backend/.env`에 Google 로그인 이메일 또는 고정 사용자 ID 허용 목록을 설정한다. 여러 값은 쉼표로 구분한다.

```dotenv
MOOV_ADMIN_EMAILS=admin@example.com,ops@example.com
# 선택 사항
MOOV_ADMIN_USER_IDS=google:허용할_google_subject

# 관리자 이미지·음원 컨테이너. 생략하면 admin-assets
AZURE_STORAGE_ADMIN_CONTAINER=admin-assets
```

- 로컬의 `demo:moov` 계정은 개발 확인용 관리자 권한이 있다.
- 일반 Google 사용자는 로그인했더라도 허용 목록에 없으면 `403`을 받는다.
- 운영 환경에서 허용 목록이 비어 있으면 관리자 API는 `503`으로 닫힌다.
- 변경 요청은 기존 세션의 same-origin 검사를 그대로 적용한다.

## 네이버 지도

차량 관제 지도는 별도 Leaflet/OpenStreetMap 코드를 사용하지 않는다. 앱의 공용 `front/public/naver-map.js`를 그대로 사용하며 Client ID는 `GET /api/maps/config`로 받고 Client Secret은 백엔드에만 둔다.

네이버 클라우드의 Dynamic Map Web 서비스 URL에는 실제 접속 오리진을 등록한다.

```text
http://localhost:3000
https://실제-배포-도메인
```

나머지 키 설정은 `docs/naver-maps-setup.md`를 따른다.

## 실행

실행기는 `.venv`를 먼저 확인하고, 현재 작업공간처럼 기존 환경의 Python 경로가 끊긴 경우 실행 가능한 `.venv314`를 사용한다. 프로젝트 루트에서:

```powershell
cd front
npm.cmd run dev
```

실행기는 FastAPI와 프런트를 함께 시작한다. 브라우저에서 다음 주소를 연다.

```text
http://localhost:3000/dashboard/#dashboard
```

상단 배지는 다음 상태를 표시한다.

- `백엔드 저장`: PostgreSQL 관리자 API 연결 및 권한 확인 완료
- `관리자 로그인 필요`: 앱에서 먼저 로그인해야 함
- `권한 없음`: 로그인 계정이 관리자 허용 목록에 없음
- `로컬 모드`: 백엔드가 꺼져 있거나 관리자 API를 사용할 수 없음

## 연결 확인 API

로그인 후 같은 브라우저에서 확인한다.

```text
GET /api/auth/me
GET /api/admin/bootstrap
GET /api/maps/config
GET /api/outing/health
GET /api/hot-products
```

`/api/admin/bootstrap`이 `200`을 반환하고 관리자 화면 상단에 `백엔드 저장`이 보이면 상품·설정·차량 변경이 PostgreSQL에 저장된다. `401`은 로그인, `403`은 허용 목록, `502`는 FastAPI 실행 상태를 확인한다.

## 배포

`moov-admin-operations.sonsome7.chatgpt.site`에 보이는 기존 페이지는 이 로컬 소스와 별도 배포물이다. 변경 사항을 반영하려면 이 프로젝트를 다시 배포하고 `/api/*`를 같은 오리진의 FastAPI로 프록시해야 한다. `APP_BASE_URL`, Google OAuth Redirect URI, 네이버 Dynamic Map Web 서비스 URL도 실제 HTTPS 도메인으로 맞춘다.
