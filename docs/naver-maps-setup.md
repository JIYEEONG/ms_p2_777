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
- `front/public/naver-course-map.js`: 나들이 지도와 코스 상세·등록 미리보기의 네이버 지도. 상세 경로는 Directions 응답으로만 표시한다.
- `front/public/moov-home/js/rental-policy.js`, `home.js`: 렌트의 네이버 지도·실제 도로 경로 및 체험 차량 접근 표시.
- `front/public/moov.html`: 택시의 네이버 지도·출발지 선택·자동차 경로 표시.
- `tools/check_naver_maps.cjs`: 임시 Edge 프로필로 지도 클릭·취소·확정·배차·탑승 과정을 검사한다.
- `backend/test_naver_maps_api.py`: 비밀키 비노출, 좌표·시간 단위 변환, 실패 처리 테스트.

경로 응답은 기존 앱과 맞추기 위해 `[위도, 경도]`, 거리 미터, 시간 초로 반환한다. Directions 5의 중간 경유지 제한은 요청당 5개다. 렌트와 코스 상세의 긴 코스는 순서를 유지해 나눠 조회하고, 택시는 경유지 5곳까지 표시한다. 경로 조회 중이거나 실패하면 이동 거리·시간은 미확인으로 표시하고 다시 조회할 수 있다. 직선 경로나 자체 예상값으로 대체하지 않는다.

기존 지도 라이브러리, 오프라인 도로 그래프·지도 데이터, 지도 이미지와 타일 썸네일을 제거했다. 저장 코스·장소 좌표·체류시간은 앱 데이터이므로 유지한다. 브라우저에 남은 예전 경로는 좌표를 보존하고 네이버 경로로 재조회한다. 렌트 차량 배차·접근은 체험 동작이며, 접근 경로는 네이버 Directions를 사용한다. 실제 차량 관제나 결제는 지도 API의 기능이 아니다.

렌트·택시의 승차 전 경로는 `/api/maps/approach`에서 **차량→출발지** 두 점만 사용한다. 탑승 후 코스의 목적지·경유지는 보내지 않으며, 네이버의 5개 자동차 경로 옵션을 최대 3개씩 두 번 조회해 반환 후보 중 거리(동일 거리일 때 시간)가 가장 짧은 경로를 선택한다. Directions 5에는 최단거리 전용 옵션이 없으므로 모든 도로 중 절대 최단거리를 보장하지 않는다. 데모에서는 출발지 주변의 가상 차량 4곳 중 도로 이동 거리가 가장 짧은 후보를 선택하고 약 18초 동안 접근을 재생한다. 실제 차량 좌표가 주어지는 공통 함수 호출은 해당 위치를 유지한다. 도착 후 **차량에 탑승했어요**를 누르면 원래 목적지·경유지 경로로 전환한다. 택시 접근 거리는 승객의 예상 요금에 더하지 않으며, 취소·조회 실패·재시도·새로고침 중에도 이미 확인한 요금을 보존한다.

택시·렌트 차량 선택 카드의 **출발지·경유지·목적지 입력란**에 주소나 장소명을 입력하면 아래에 검색 결과가 나타난다. 별도의 **검색·지도** 글자 버튼 없이 결과를 선택하여 경로를 바꾼다. 입력 글씨는 16px이며 검색창과 결과, 경로 안내는 지도 밖에 표시된다.

출발 핀, 출발지 검색 결과 또는 **내 위치**를 선택하면 기존 지도에서 승차 위치를 조정한다. 지도 가운데 고정된 **탑승** 핀 아래로 지도를 움직이고, 지도 아래 장소명·주소를 확인한 뒤 **여기서 탑승**으로 확정한다. 취소하거나 지도를 움직이는 동안에는 기존 코스가 바뀌지 않는다. **관심 코스**와 **나들이 코스**에서 선택한 코스도 유지된다.

렌트의 **관심 코스·나들이 코스**에서 들어간 나들이 화면은 코스 선택 모드다. **렌트에 적용**을 누르거나 **이용 기록** 항목을 고르면 렌트 설정으로 바로 복귀해 경유지·목적지를 교체하고 출발지·차량·이용 시간·옵션은 유지한다. **변경 없이 돌아가기**는 기존 설정으로 복귀한다. 일반 나들이의 **코스등록 → 이용 기록에서 가져오기**는 등록 초안 편집 기능을 유지한다. 검증: `node tools/check_naver_maps.cjs http://localhost:3000 --course-return`.

택시도 같은 코스 선택·복귀 방식과 **전체 경로** 버튼을 사용한다. 택시·렌트의 장소명 확인은 공통 `MoovNaverMap.matchPlace`로 처리하여 띄어쓰기가 다른 정확한 장소명 또는 단일 주소 검색 결과를 사용한다. 특정 장소를 고를 수 없는 택시 지점은 해당 입력칸에서 검색 결과를 선택하도록 안내하며 확인된 다른 지점은 계속 표시한다.

전체 자동차 경로는 공통 `directionsForStops`에서 2~20개 장소를 순서대로 계산한다. 한 번의 네이버 요청에 포함할 수 있는 경유지 수를 넘으면 구간별로 나눠 거리와 시간을 합산한다. 택시 예상 소요시간은 네이버 응답의 `durationSeconds`를 분으로 올림해 표시하며, 수동 시간 입력은 필요하지 않다. 예상 요금은 기존 거리 기준 정책을 유지한다. 검증: `node tools/check_naver_maps.cjs http://localhost:3000 --taxi-shared`, `node tools/check_taxi_fares.cjs http://localhost:3000`.

지도는 마우스나 손가락으로 이동하고 두 손가락으로 확대·축소할 수 있다. 출발 마커 드래그는 승차 위치 확인으로 이어지며, 경유·도착 마커 드래그는 해당 지점을 바로 변경한다. 확정하면 다른 지점의 좌표를 보존하면서 네이버 길찾기를 다시 조회한다. 택시는 거리·시간·예상 요금을, 렌트는 경로와 시간을 갱신한다. 모든 지점과 도로 경로가 들어오는 최대 확대 수준으로 맞추며 최대 자동 확대는 18이다. 이후 사용자가 이동·확대한 화면을 늦게 도착한 경로 응답이 되돌리지 않는다. 배차·이용 중인 경로의 지도 마커는 이동할 수 없다.

장소 표시는 Reverse Geocoding의 건물명을 우선 사용하고, 없으면 주소로 지역검색 후 실제 선택 좌표에서 80m 이내의 가장 가까운 상호명을 표시한다. 출발지 이름에 ‘인근’ 또는 ‘Near’를 붙이지 않으며, 이전에 저장한 출발지 입력칸에서도 이 표현을 생략한다. 상호를 찾지 못하면 주소를 유지한다. 핀을 상호 좌표나 출입구로 자동 이동하지 않는다. 이 이름은 주변 위치를 알아보기 위한 안내이며 도로 진입·정차 가능 여부를 보증하는 데이터는 아니다. 지도 위에서는 마우스 휠로 확대·축소할 수 있고, 직접 조절한 화면을 늦게 도착한 경로 응답이 초기화하지 않는다.

이름만 저장된 렌트 코스도 네이버 검색에서 이름이 일치하는 단일 장소를 찾아 좌표를 보완한 뒤 자동차 경로를 조회한다. 같은 이름의 장소가 여러 곳이거나 검색이 실패하면 해당 입력칸에서 결과를 선택하도록 안내하며, 기존 좌표·순서·체류시간은 보존한다. 출발지 확정 후에는 이전 확대 상태를 초기화해 전체 경로를 표시하고, 지도 아래 **전체 경로** 버튼으로 다시 전체 코스를 볼 수 있다. 재현 검증: `node tools/check_naver_maps.cjs http://localhost:3000 --name-only-route`.

검증: `node tools/check_naver_maps.cjs http://localhost:3000 --pickup-only`로 고정 핀 선택·취소·확정, 현재 위치, 출발·경유·도착 마커 이동, 거리별 자동 확대, 지도 이동·두 손가락 확대/축소와 영문 화면을 확인한다. `--route-controls --place-search`로 코스 연결과 입력 검색도 확인한다.

도로명·지번 주소 검색은 기존 Maps 설정으로 동작한다. 가게·기관 이름 검색까지 사용하려면 [NAVER API HUB 지역검색 API](https://api.ncloud-docs.com/docs/naver-api-hub-search-local)를 등록하고 아래 값을 **로컬 `backend/.env`**에 추가한 뒤 백엔드를 재시작한다. API HUB Application에서 **NAVER 검색 → 지역**을 선택하고 인증 정보의 Client ID·Client Secret을 사용한다. Maps 키는 그대로 유지하며 검색 키는 브라우저로 전달하지 않는다. 서버는 `https://naverapihub.apigw.ntruss.com/search/v1/local`에 `X-NCP-APIGW-API-KEY-ID`와 `X-NCP-APIGW-API-KEY` 헤더로 인증한다.

```dotenv
NAVER_SEARCH_CLIENT_ID=
NAVER_SEARCH_CLIENT_SECRET=
```

지역검색 키가 없으면 주소 검색과 지도 직접 선택을 사용한다. 서울 전역 차량 목록에서 가장 가까운 차량을 배정하는 기능은 포함하지 않았다.

## 연결이 안 될 때

- 키 입력 안내가 보임: `.env` 위치와 변수 이름, 백엔드 재시작 확인.
- 백엔드 연결 실패: 8000번 포트 서버 실행 여부 확인.
- 지도 인증 실패: Dynamic Map 선택과 Client ID, Web 서비스 URL 확인.
- 주소·경로만 실패: Client Secret과 각각의 API 선택 여부 확인.
- 429 관련 안내: API 선택 여부, 콘솔의 이용 한도 확인.

실제 요청은 네이버 사용량으로 집계된다. 무료 이용량·과금 및 한도는 콘솔에서 확인한다. 이 페이지와 API는 로컬 연결 점검용으로, 공개 운영 전에는 앱 인증·호출 제한을 적용해야 한다.

공식 문서: [Maps 인증·엔드포인트](https://api.ncloud-docs.com/docs/application-maps-overview), [Geocoding](https://api.ncloud-docs.com/docs/en/application-maps-geocoding), [Directions 5](https://api.ncloud-docs.com/docs/application-maps-directions5), [지도 SDK 예제](https://github.com/navermaps/maps.js.ncp/blob/master/examples/map/1-map-simple.html)
