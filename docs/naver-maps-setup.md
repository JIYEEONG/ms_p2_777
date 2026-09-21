# 네이버 지도 API 설정

렌트·택시 지도와 출발지 선택 화면이 네이버 지도로 연결된다. 렌트는 예약·픽업·차량 접근·이용 중·코스 변경 지도에 적용되며, 택시는 예약·이용 중 지도와 픽업 선택에 적용된다. 나들이 지도는 기존 방식을 유지한다. 차량은 체험용이며 실제 차량 호출은 발생하지 않는다.

## 1. 네이버 클라우드에서 키 발급

1. [네이버 클라우드 플랫폼](https://www.ncloud.com/)에 로그인하고 콘솔을 연다.
2. VPC 환경에서 **Application Services → Maps**를 찾고 이용 신청을 진행한다.
3. **Application → Application 등록**에서 이름을 `MOOV`로 입력한다.
4. **Dynamic Map**(웹 지도), **Geocoding**, **Reverse Geocoding**, **Directions 5**를 선택한다.
5. Web 서비스 URL에 로컬 개발 주소 `http://localhost:3000`과 `http://127.0.0.1:3000`을 등록한다. 다른 포트·배포 주소로 접속하면 그 주소도 등록 상태를 확인한다.
6. 등록한 Application의 **인증 정보**에서 Client ID와 Client Secret을 확인한다. 일반 계정의 Access Key / Secret Key나 네이버 검색 API 키와는 다르다.

[공식 Application 등록 가이드](https://guide.ncloud-docs.com/docs/application-maps-app-vpc)

## 2. 입력할 파일

`backend/.env` 맨 아래 준비된 빈칸에 값을 넣는다. 기존 Azure·DB 설정을 지우지 않는다.

```dotenv
NAVER_MAP_CLIENT_ID=발급받은_Client_ID
NAVER_MAP_CLIENT_SECRET=발급받은_Client_Secret
```

- 빈 양식은 `backend/.env.naver.example`에도 있다. 실제 키는 이 예제 파일에 넣지 않는다.
- `backend/1.env`는 이 연결에서 읽지 않는다. `backend/.env`를 사용한다.
- Client ID는 웹 지도 SDK를 로딩할 때 브라우저에 전달된다. Client Secret은 Python 서버에서만 사용한다.
- `.env`와 `1.env` 같은 파일은 Git에서 제외한다. 이미 Git에 추적 중인 파일에는 ignore가 소급 적용되지 않는다.
- 키를 변경한 후 **백엔드를 재시작**한다. 이미 설정된 운영체제 환경변수는 `.env`보다 우선한다.

## 3. 실행과 확인

프로젝트 루트에서 터미널 두 개를 사용한다.

터미널 1 — 지도만 먼저 확인할 때 (Azure·DB 초기화 없이 실행):

```powershell
.venv/Scripts/python.exe -m uvicorn maps_server:app --app-dir backend --host 127.0.0.1 --port 8000
```

이미 기존 백엔드가 8000번 포트에서 실행 중이면 두 서버를 동시에 띄우지 않는다. 기존 백엔드에도 지도 라우터가 추가되었으므로, 기존 백엔드를 재시작해서 그대로 사용해도 된다. 지도 전용 서버에는 채팅·나들이 API가 없다.

터미널 2 — 프런트:

```powershell
cd front
npm run dev
```

브라우저에서 **http://localhost:3000/naver-map-check.html**을 연다.

1. 성수동 중심의 네이버 지도가 나타나는지 확인한다.
2. 도로명·지번 주소를 검색해 한글 주소와 영문 주소가 나오는지 확인한다. 이 API는 음식점 이름 검색용 API가 아니다.
3. 지도에서 출발지·목적지를 클릭하면 해당 좌표의 주소가 표시된다.
4. **자동차 경로 확인**을 누르면 실제 도로 경로·거리·예상 시간이 표시된다. 체류 시간은 포함하지 않는다.

지도 클릭의 역지오코딩 결과는 한글 주소이며, 영문 주소는 주소 검색(Geocoding)의 `englishAddress`로 확인한다. 가게 이름이나 코스 설명의 번역과는 별개다.

## 만들어진 파일과 연결

- `backend/naver_maps_api.py`: 공개 Client ID 설정, 주소 검색, 좌표→주소, 자동차 경로 API. 비밀키는 서버에만 보관.
- `backend/maps_server.py`: 지도만 검증하는 독립 실행 서버.
- `backend/main.py`: 기존 앱 서버에도 지도 라우터 등록.
- `front/server.mjs`: `/api/maps/*`를 백엔드로 전달. 기본 백엔드 주소는 `http://127.0.0.1:8000`; 필요하면 실행 환경의 `MOOV_BACKEND_URL`로 변경.
- `front/public/naver-map-check.html`, `naver-map-check.js`: 연결 확인 화면.
- `front/public/naver-map.js`: 렌트·택시의 공통 지도 SDK 로더, 지도·마커·경로, 주소/길찾기 요청. 같은 경로의 중복 요청은 60초 동안 재사용한다.
- `front/public/moov-home/js/rental-policy.js`, `home.js`: 렌트의 네이버 지도·실제 도로 경로 및 체험 차량 접근 표시.
- `front/public/moov.html`: 택시의 네이버 지도·출발지 선택·자동차 경로 표시.
- `tools/check_naver_maps.cjs`: 임시 Edge 프로필로 지도 클릭·취소·확정·배차·탑승 과정을 검사한다.
- `backend/test_naver_maps_api.py`: 비밀키 비노출, 좌표·시간 단위 변환, 실패 처리 테스트.

경로 응답은 기존 앱과 맞추기 위해 `[위도, 경도]`, 거리 미터, 시간 초로 반환한다. Directions 5의 중간 경유지 제한은 요청당 5개다. 렌트의 더 긴 코스는 순서를 유지해 나눠 조회하고, 택시는 경유지 5곳까지 표시한다. 렌트의 지도 경로를 조회하지 못하면 기존 직선거리 기반 예상값임을 안내한다.

기존 렌트 장소 검색은 등록된 체험 장소를 대상으로 한다. 지도 직접 선택은 네이버 지도의 좌표를 사용한다. 택시 자유 입력의 위치는 보유 좌표가 있으면 사용하고, 없으면 도로명·지번 주소로 검색하므로 모든 가게 이름 검색을 지원하는 것은 아니다. 서울 전역 차량 목록에서 가장 가까운 차량을 배정하는 기능은 이번 지도 교체에 포함하지 않았다.

## 연결이 안 될 때

- 키 입력 안내가 보임: `.env` 위치와 변수 이름, 백엔드 재시작 확인.
- 백엔드 연결 실패: 8000번 포트 서버 실행 여부 확인.
- 지도 인증 실패: Dynamic Map 선택과 Client ID, Web 서비스 URL 확인.
- 주소·경로만 실패: Client Secret과 각각의 API 선택 여부 확인.
- 429 관련 안내: API 선택 여부, 콘솔의 이용 한도 확인.

실제 요청은 네이버 사용량으로 집계된다. 무료 이용량·과금 및 한도는 콘솔에서 확인한다. 이 페이지와 API는 로컬 연결 점검용으로, 공개 운영 전에는 앱 인증·호출 제한을 적용해야 한다.

공식 문서: [Maps 인증·엔드포인트](https://api.ncloud-docs.com/docs/application-maps-overview), [Geocoding](https://api.ncloud-docs.com/docs/en/application-maps-geocoding), [Directions 5](https://api.ncloud-docs.com/docs/application-maps-directions5), [지도 SDK 예제](https://github.com/navermaps/maps.js.ncp/blob/master/examples/map/1-map-simple.html)
