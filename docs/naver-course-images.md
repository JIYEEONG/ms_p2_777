# 가상 커뮤니티 코스 1,000개와 첫 장소 사진

제공 CSV 1,049행 중 앞 1,000행을 사용했다. 코스 ID와 첫 장소는 유지했다.
경로가 중복되는 851개를 재구성하고 원래 고유 경로 149개는 보존했다.
최종 경로와 제목은 각각 1,000개 모두 다르다.

사진은 **612장 검수 완료**, **388개 미완료**이다. 사용자가 미완료 사진을 다른 담당자가
직접 찾기로 하여 추가 수집을 중단했다. 아트팩토리체험공방으로 시작하는 21개도
첫 장소를 유지한다. 미완료에는 다른 장소·카테고리 사진을 대체 표시하지 않는다.
이미지 생성은 사용하지 않았다. 적용된 612장은 네이버 이미지 검색으로 확보한 사진이다.

## 결과 파일

- `artifacts/naver-course-images/가상코스_1000_최종.csv`: 전체 코스, 방문지, 첫 장소, 사진 상태
- `artifacts/naver-course-images/사진_미완료_인계.csv`: 미완료 388개와 검색어·네이버 검색 링크
- `artifacts/naver-course-images/courses-with-images.csv`: 최초 CSV와 호환되는 코스 ID·이미지 경로
- `artifacts/naver-course-images/final-report.json`: 최종 수량
- `backend/data/naver-course-images.json`: 앱이 읽는 코스·사진·공통 Place Profile·구성 정책
- `front/public/assets/naver-courses/`: 실제 반영된 사진 612장

사진별 검색어·검색 제목·원본 URL·SHA-256과 검수 상태는 서비스 목록에 보존한다.
미사용 검색 후보와 검수 시트는 작업 폴더의 Git 제외 캐시에 남겨두었다.
미검수 원문 후보는 서비스에 적용하지 않았다.

## 기획보고서 V1.11 반영

사용자가 중복 코스 생성 시 참고하도록 지정한 문서의 다음 규칙을 적용했다.

- **§3 단일 Place Profile:** DB 장소 정보와 원천 카테고리를 보존한다. 공통 장소 프로필을
  저장하고, 코스 태그는 실제 방문 장소에서 다시 집계한다.
- **§9 코스 구성:** 재구성한 851개는 서로 다른 실제 활동 카테고리 3곳으로 구성한다.
  가까운 장소를 연결하며 새 구간 최대 직선거리는 약 1.91km다.
  직선거리는 도로 이동거리로 표시하지 않는다.
- **§15.3·16 필터/취향 분리:** 공통 카테고리 우선순위나 임의 취향 점수를 만들지 않는다.
  이 목록은 사용자 필터 입력 전의 가상 코스이며 실제 이용 시 현재 필터를 먼저 적용해야 한다.
- **§17.2 AHP 범위:** AHP는 행동 신호 신뢰도 산출에 쓰이므로 가상 코스 구성에 임의 가중치를 넣지 않는다.

가격·예약 가능 여부·영업/행사시간·실제 도로 이동시간은 확인된 것으로 가정하지 않는다.
미확인 값과 검증 상태를 기록하며, 기존 이동거리/시간을 새 경로에 재사용하지 않는다.
CSV의 빈 장소명은 현재 서비스가 좌표로 매칭한 이름을 보완한 것으로 원래 장소 확인과 구분한다.

## 앱 반영

`backend/course_image_catalog.py`가 기존 코스 응답에 목록을 적용한다. 공유 DB에는 쓰지 않는다.
`moov.html`의 실제 로딩 경로에서 ID와 첫 장소 사진·출처를 보존한다.
썸네일과 첫 장소 상세 사진은 같은 파일이며 정렬·필터 변경에도 고정된다.
다른 방문지의 미검증 사진은 표시하지 않는다.

## 재현 및 인계

현재 완료 상태를 다시 내보내는 명령은 네트워크를 사용하지 않는다.

```powershell
.venv/Scripts/python.exe tools/export_naver_course_handoff.py
```

추후 수집을 다시 요청받는 경우에만 `prepare_naver_course_images.py`의 `collect` 등을 실행한다.
현재는 사용자 지시에 따라 추가 검색·다운로드를 중단했다.
수동으로 찾은 사진도 첫 장소 일치·중복 여부를 검수한 후 서비스 목록에 반영해야 한다.

```powershell
.venv/Scripts/python.exe -m unittest discover -s tools -p 'test_naver*.py'
.venv/Scripts/python.exe tools/test_diversify_naver_courses.py
node --test front/tests/naver-course-app.test.cjs front/tests/naver-course-images.test.cjs front/tests/outing-data.test.cjs
```
