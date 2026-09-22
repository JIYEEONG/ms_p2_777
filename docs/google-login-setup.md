# Google 로그인 설정

## 로컬 시연 계정

Google 로그인 설정 없이 로컬 시연을 하려면 로그인 화면의 **로컬 시연 로그인**을 사용합니다.

- 아이디: `moov`
- 비밀번호: `demo1234`
- 백엔드 실행이 필요합니다. 로그인 후 서버 세션 쿠키를 사용하므로 새로고침·로그아웃·취향 설문도 같은 인증 흐름을 사용합니다.
- `APP_BASE_URL=http://localhost:3000`인 로컬 환경에서 기본 활성화됩니다. 환경변수 `ENABLE_DEMO_LOGIN=false`로 끌 수 있습니다.
- 공개 도메인에서는 비활성화됩니다. 실제 Google 사용자와 다른 `demo:moov` 공용 계정으로 저장되며, 같은 서버에서 이 계정을 쓰면 시연 데이터가 공유됩니다.
- 아이디·비밀번호를 임의로 입력하는 방식은 아닙니다. 위에 지정된 계정을 사용하세요.
- 변경 사항을 받은 팀원은 실행 중인 터미널에서 `Ctrl+C` 후 `front`의 `npm run dev`를 다시 실행하고 브라우저를 새로고침하세요. 백엔드도 함께 새로 실행됩니다.

## Google 계정 로그인

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

프로젝트 루트에서 가상환경을 만들고 백엔드 의존성을 설치한다(최초 한 번).

```powershell
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r backend/requirements.txt
```

프론트 폴더에서 실행하면 전체 백엔드까지 함께 시작한다. `npm install`은 최초 설치 시 필요하다.

```powershell
cd front
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`을 연다. `Ctrl+C`는 프론트와 이번에 띄운 백엔드를 함께 종료한다. `.env` 또는 백엔드 코드 수정 후에는 `npm run dev`를 다시 실행한다. 실행할 때마다 새 백엔드가 연결되므로 이전 서버에 남은 로그인 코드를 사용하지 않는다. 기존 서버가 8000번 포트를 사용하면 자동으로 다른 포트를 쓴다.

AI 설정 없이 지도·로그인·취향 설문만 확인하려면 같은 `front` 폴더에서 아래 명령을 사용한다. Azure AI·PostgreSQL을 초기화하지 않는다.

```powershell
npm run dev:maps
```

통합 실행은 로컬 개발용이며 실행 중인 프로세스의 `APP_BASE_URL`과 `GOOGLE_REDIRECT_URI`를 프론트의 `localhost` 주소로 맞춘다. `.env`의 저장된 값은 변경하지 않는다. 기본 포트는 3000이며 `PORT` 환경변수로 변경할 수 있다. Google Cloud에 등록한 콜백 주소도 해당 포트와 일치해야 한다. 프론트만 따로 실행하려면 `npm run dev:front`를 사용한다.

## 동작과 저장

취향 설문을 끝까지 완료하기 전에는 다음 로그인 때 다시 표시한다. 건너뛴 설문은 나들이·렌트 진입 시 이어서 작성할 수 있고, `내 정보 → 취향 설문`에서도 수정한다. [설문 구성·저장·추천 적용 안내](login-survey-setup.md)를 참고한다.

- 클라이언트 보안 비밀번호와 세션 비밀값은 서버에서만 사용한다.
- 로그인 요청의 state·nonce·PKCE와 Google ID 토큰을 검증한다. 계정 식별에는 Google의 고유 사용자 ID를 사용한다.
- 로그인 쿠키는 HttpOnly로 발급하며 HTTPS에서는 Secure도 적용한다. 로그아웃하면 서버 세션도 무효화한다.
- 서버 세션은 `backend/.auth-sessions.sqlite3`에 저장하며 Git에 포함하지 않는다. Google 계정 ID·이름·이메일·프로필 사진 주소와 OAuth 임시 인증값은 암호화해서 저장한다. 세션 토큰은 원문 대신 SHA-256 해시만 저장한다.
- Google 계정 비밀번호는 앱에서 받지 않는다. Google에서 발급한 액세스·ID 토큰은 로그인 검증 중에만 사용하며 DB에 저장하거나 브라우저로 반환하지 않는다.
- 브라우저의 기존 로그인 표시값만으로 로그인하지 않는다. Google 계정별로 앱 데이터와 렌트 상태를 구분하며 기존 임시 아이디 데이터는 자동으로 다른 계정에 옮기지 않는다.
- 발급된 실제 Google 설정값이 없으면 인증을 완료할 수 없다. 자동 검증은 Google 응답을 대체한 테스트를 사용하며 실제 계정의 동의·로그인은 사용자가 브라우저에서 확인한다.

## 로그인 저장 정보 암호화

별도 설정이 없으면 기존 `AUTH_SESSION_SECRET`에서 HKDF로 저장용 키를 파생하고, `cryptography`의 Fernet으로 암호화·변조 검증한다. OAuth 쿠키 서명과 저장 암호화에는 서로 다른 키를 사용한다. `AUTH_SESSION_SECRET`은 위 설정 도구가 생성한 무작위 비밀값을 유지한다. 프론트에는 키를 넣지 않는다.

업데이트를 받은 팀원은 프로젝트 루트에서 의존성을 설치한 뒤, 실행 중인 개발 서버를 `Ctrl+C`로 종료하고 `front`에서 `npm run dev`를 다시 실행한다.

```powershell
.venv/Scripts/python.exe -m pip install -r backend/requirements.txt
cd front
npm run dev
```

새 백엔드에서 처음 로그인 DB에 접근할 때 기존 평문 프로필과 진행 중인 OAuth 인증값도 자동으로 암호화한다. 기존 비밀값을 유지하면 로그인 세션도 유지한다. 이 전환 후에는 이전 버전의 백엔드를 같은 DB와 함께 실행하지 않는다. 로컬 시연 계정은 개인 정보 대신 고정된 계정 표시값만 저장하므로 Google 설정 없이도 사용할 수 있다.

암호화 키를 세션 서명 비밀값과 별도로 관리하려면 아래 명령으로 키를 생성하고 `backend/.env`의 `AUTH_DATA_ENCRYPTION_KEY`에 넣을 수 있다. 기본 사용에는 이 추가 설정이 필요하지 않다.

```powershell
.venv/Scripts/python.exe -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

키는 서버의 환경변수/비밀 저장소로 관리하고 Git에 올리지 않는다. 키를 새로 지정·변경하거나 분실하면 이전 키로 저장된 로그인 기록을 읽을 수 없으므로 사용자는 다시 로그인해야 한다. 기본 설정에서는 `AUTH_SESSION_SECRET` 변경도 같은 영향을 준다. 키가 없거나 유효하지 않으면 Google 로그인을 비활성화하며, 평문 저장으로 전환하지 않는다.

암호화 범위는 **서버 로그인 DB의 프로필과 OAuth 임시 인증값**이다. DB의 만료 시각 등 메타데이터, 별도 설문·앱 데이터, 브라우저에서 표시·보관하는 프로필, 과거에 복사한 DB 백업까지 암호화하는 기능은 아니다. 사용자에게 프로필을 보여주는 API 응답은 계속 제공하며, 외부 접속 시 전송 구간은 HTTPS로 보호한다. DB와 서버 비밀키가 함께 유출되는 상황까지 이 기능만으로 막을 수는 없다.

공식 참고: [서버 OAuth 흐름](https://developers.google.com/identity/protocols/oauth2/web-server), [ID 토큰 검증](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token), [Fernet 암호화](https://cryptography.io/en/latest/fernet/).
