# 코스 CSV와 사진

- `가상코스_1000_최종.csv`: 전체 1,000개 코스와 검수된 썸네일.
- `사진_미완료_인계.csv`: 검색·검수 후에도 사진이 없는 코스의 수동 검색 목록.
- `final-report.json`: 최종 사진 수와 첫 장소·도착지·경유지별 집계.

기존 첫 장소 사진을 유지하고, 미완료 코스는 실제 도착지 또는 경유지의 네이버 검색 사진으로 보완합니다. 방문 경로와 첫 장소는 바꾸지 않습니다. CSV의 `사진_장소`, `사진_역할`, `사진_방문순서`가 실제 촬영 장소를 나타내며, 방문 순서는 1부터 시작합니다. JSON의 `cover_stop_index`는 0부터 시작합니다.

`image_url`은 `front/public` 아래의 로컬 이미지 경로입니다. `원본이미지`와 검색 링크는 출처 확인용입니다. 확인하지 못한 사진은 빈칸으로 유지하며 AI로 생성하지 않습니다.

사진 수집은 `tools/collect_course_stop_fallbacks.py`, 시각 검수 기록은 `review-fallback*.json`을 사용합니다. 검수 후 `tools/apply_course_stop_fallbacks.py`, `tools/export_naver_course_handoff.py` 순서로 실행하면 승인된 사진만 카탈로그와 CSV에 반영됩니다. 이 과정은 공유 데이터베이스를 변경하지 않습니다.
