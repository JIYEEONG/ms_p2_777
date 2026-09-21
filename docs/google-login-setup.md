# Google 로그인 설정

앱은 Google 로그인 화면에서 계정을 선택한 뒤 `http://localhost:3000`으로 돌아온다. 서버가 Google의 인증 응답을 확인하고 로그인 세션을 발급한다. Google 이메일이나 계정 비밀번호를 MOOV의 `.env`에 넣지 않는다.

## Google Cloud 등록

1. [Google Auth Platform](https://console.cloud.google.com/auth/overview)에서 프로젝트를 선택하고 브랜딩·대상 사용자를 설정한다.
2. **클라이언트 → 클라이언트 만들기 → 웹 애플리케이션**을 선택한다.
3. 승인된 JavaScript 원본에 `http://localhost`, `http://localhost:3000`을 등록한다.
4. **승인된 리디렉션 URI**에 아래 주소를 정확히 등록한다.

```text
http://localhost:3000/api/auth/google/callback
```

5. 발급된 클라이언트 ID와 클라이언트 보안 비밀번호(Client Secret)를 `backend/.env`에 넣는다. Google Cloud에서 테스트 사용자 등록을 요구하는 경우 로그인할 계정을 대상 사용자에 추가한다.

```dotenv
GOOGLE_CLIENT_ID=발급받은_ID.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=발급받은_Client_Secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
APP_BASE_URL=http://localhost:3000
AUTH_SESSION_SECRET=자동_생성된_값_유지
```

처음 설정할 때 프로젝트 루트에서 아래 명령을 실행하면 누락된 항목만 추가하고 세션 비밀값을 자동 생성한다. 기존 Azure·DB·네이버 설정을 덮어쓰지 않는다.

```powershell
.venv/Scripts/python.exe tools/setup_google_env.py
```

배포할 때는 `APP_BASE_URL`과 `GOOGLE_REDIRECT_URI`를 실제 HTTPS 도메인으로 변경하고, Google Cloud에도 동일한 주소를 등록한다. 로컬 테스트에서는 `localhost`로 접속한다. `127.0.0.1`은 별도 호스트라 로그인 쿠키와 콜백 주소를 섞어 쓰면 안 된다.

## 실행

프로젝트 루트에서 로그인용 의존성을 설치한다.

```powershell
.venv/Scripts/python.exe -m pip install "google-auth>=2.38,<3" "requests>=2.32,<3"
```

터미널 1 — 지도·로그인 서버:

```powershell
.venv/Scripts/python.exe -m uvicorn maps_server:app --app-dir backend --host 127.0.0.1 --port 8000 --no-access-log
```

터미널 2 — 프론트:

```powershell
cd front
npm run dev
```

브라우저에서 `http://localhost:3000`을 연다. `.env` 수정 후에는 백엔드 서버를 재시작한다. 전체 AI·나들이 백엔드에는 `backend/main.py`에도 같은 로그인 라우터가 연결되어 있다. 지도·로그인 전용 실행 명령은 AI·PostgreSQL을 초기화하지 않는다.

## 동작과 저장

- 클라이언트 보안 비밀번호와 세션 비밀값은 서버에서만 사용한다.
- 로그인 요청의 state·nonce·PKCE와 Google ID 토큰을 검증한다. 계정 식별에는 Google의 고유 사용자 ID를 사용한다.
- 로그인 쿠키는 HttpOnly로 발급하며 HTTPS에서는 Secure도 적용한다. 로그아웃하면 서버 세션도 무효화한다.
- 서버 세션은 `backend/.auth-sessions.sqlite3`에 저장하며 Git에 포함하지 않는다.
- 브라우저의 기존 로그인 표시값만으로 로그인하지 않는다. Google 계정별로 앱 데이터와 렌트 상태를 구분하며 기존 임시 아이디 데이터는 자동으로 다른 계정에 옮기지 않는다.
- 발급된 실제 Google 설정값이 없으면 인증을 완료할 수 없다. 자동 검증은 Google 응답을 대체한 테스트를 사용하며 실제 계정의 동의·로그인은 사용자가 브라우저에서 확인한다.

공식 참고: [서버 OAuth 흐름](https://developers.google.com/identity/protocols/oauth2/web-server), [ID 토큰 검증](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token).
