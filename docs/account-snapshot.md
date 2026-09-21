# 계정 데이터 중간 저장

사용자 요청에 따라 현재 계정의 코스·취향 설문·앱 설정을 `backend/account_snapshots/`의 JSON 파일로 저장했다. 이번 백업에는 직접 등록한 **경복궁 투어: 숭례문 → 광화문 → 경복궁**, 관심 코스 등록 상태, 설문 응답, 앱 및 렌트 설정이 포함된다.

## 포함 범위

- 직접 만든 코스의 원래 ID, 작성자, 제목, 설명, 장소 순서, 체류 시간, 사진 참조, 태그
- 관심·좋아요 코스 목록, 나들이 정렬·필터·추천 조건
- 완료 또는 건너뛴 취향 설문의 원본 응답
- 테마·온도·조명·차량 옵션·이용 시간·AI 음성 관련 설정·글자 크기·언어 설정

로그인 쿠키·토큰·세션·`.env`, 결제수단, 주문·결제 내역, 대화 원문, 진행 중인 배차·운행 상태는 포함하지 않는다. 위치 동의 기록을 브라우저 GPS 권한으로 옮기지 않는다.

## 복원 방식

1. Google 로그인으로 서버가 확인한 계정 ID의 SHA-256 값과 백업 파일명을 비교한다. 다른 계정에는 백업을 전달하지 않는다.
2. 앱은 `/api/outing/survey` 응답의 `accountBackup`을 받아 **기존 저장소가 없는 항목만** 복원한다. 원래 Google 계정 ID와 이메일은 백업 파일에 추가하지 않는다.
3. 이미 있는 앱 설정, 코스, 의도적으로 비운 관심 목록을 덮어쓰지 않는다. 복원 실패 시 부분 저장을 되돌리고 재시도한다.
4. 설문은 서버 SQLite의 최신 응답을 우선 사용한다. 그 계정의 서버 응답이 없을 때만 백업 응답을 사용하고, 추천 프로필은 기존 규칙으로 다시 계산한다.

따라서 다른 PC에서 이 브랜치의 앱과 백엔드를 실행하고 **같은 Google 계정**으로 로그인하면 코스와 설정을 다시 불러올 수 있다. 팀원의 다른 계정에 기본 코스로 등록되는 방식은 아니다.

이 파일은 내보낸 시점의 Git 백업이다. 이후 앱에서 수정한 내용이 자동으로 GitHub에 동기화되지는 않는다. 저장소를 볼 수 있는 사람은 백업 파일의 코스와 취향·설정 내용을 볼 수 있다.

## 다시 내보내기

현재 내보내기 도구는 Windows Edge의 Default 프로필, `http://localhost:3000`에 저장한 MOOV 데이터만 읽는다. 쿠키·로그인 세션에는 접근하지 않는다. LevelDB의 현재 manifest에 포함된 테이블과 로그를 읽으며, 오래된 파일·삭제된 항목·다른 사이트 키를 백업으로 되살리지 않는다.

```powershell
python tools/export_account_snapshot.py --inspect
python tools/export_account_snapshot.py --owner-hash <inspect에 표시된 계정 해시>
```

추출 후 JSON 변경 내용을 확인하고 해당 파일을 커밋·푸시한다. 브라우저에서 저장소가 변경되는 중이면 도구가 재시도를 요청할 수 있다. 다른 브라우저 또는 접속 주소의 데이터는 별도 확인이 필요하다.

## 확인

```powershell
.venv/Scripts/python.exe -m unittest backend.test_survey_api tools.test_export_account_snapshot
node --test front/tests/account-snapshot.test.cjs
node tools/check_naver_maps.cjs http://localhost:3000 --account-snapshot
```

브라우저 검사는 별도 임시 프로필·모의 인증을 사용하며 사용 중인 브라우저의 데이터는 수정하지 않는다.
