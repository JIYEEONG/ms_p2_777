# 영어 버전 동기화 — 2026-09-27

`영어버전` 브랜치는 최신화한 `origin/main`의 `de39442`에서 생성했다. 기존 `english` 브랜치(`c3134d6`)를 병합해 오래된 UI를 되살리지 않고, 현재 한국어 소스의 화면과 동작 위에 영어 표시를 적용했다.

## 비교 결과

| 범위 | 현재 문구 | 새 항목 | 제거한 이전 항목 | 기존 영어 수정 | 빈 번역 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 공통 UI·음성·관리자 원문 목록 | 2,405 | 1,344 | 176 | 18 | 0 |
| 홈·렌트 원문 목록 | 366 | 89 | 84 | 23 | 0 |

위 수치는 업데이트 전 `origin/main`의 워크북과 비교한 결과다. 삭제된 파일 참조를 현재 공개 JS/HTML 목록으로 바꾸고, 잘린 템플릿 조각을 완전한 문장으로 추출하도록 개선했기 때문에, 목록의 증감에는 추출 방식 변경도 포함된다. 공통·홈 목록에 중복 문구가 있으므로 합계는 고유 문구 수가 아니다.

기존 `english` 브랜치의 공통 브라우저 사전과 직접 비교하면 **1,343개 추가, 178개 제거, 15개 영어 수정**이다. 현재 공통 브라우저 사전은 원문 2,405개와 명시적인 동적 표시 12개를 포함한다. 전체 목록은 [sync-report.json](../translations/sync-report.json)에 기록했다.

## 반영한 동작

- 저장된 언어가 없으면 영어로 시작한다. 기존 사용자의 언어 선택은 유지하며 `?lang=en` / `?lang=ko`로 지정할 수 있다. Next.js 진입 페이지도 iframe에 언어를 전달한다.
- 최신 로그인, 설문, AI, 택시, 나들이, 프로필, 공간 콘텐츠, 홈·렌트와 관리자 화면의 문구를 반영했다.
- 숫자·가격·시간·상태가 들어가는 동적 문장, 중첩된 메뉴의 명시적 영어, textarea의 placeholder와 접근성 속성을 처리한다.
- 입력한 문장, textarea 내용, option의 내부 값, 편집 가능한 관리자 설정은 원래 값을 보존한다. 번역된 값이 저장 데이터나 API 식별자로 섞이지 않게 한다.
- 한글로 돌아가면 원문이 복원된다. 숫자가 아닌 장소명이 `원`으로 끝나도 금액으로 오인하지 않는다.
- 원문 목록에서 사라진 사전 항목과 오래된 픽업→출발 별칭 생성을 제거했다. 런타임 조합 문구는 별도 `runtime-en.json`에 명시했다.

## 검증

- `node tools/check_english.cjs`: **37개 화면 상태 통과**, 검사한 표시 텍스트·placeholder·접근성 속성에서 한글 누락 0개, 브라우저 JavaScript 예외 0개. 별도로 영어 기본값, 동적 DOM 갱신, 한국어 복원, 입력 내용과 option 값 보존을 확인했다.
- 검사 범위: 앱 주요 탭, AI 세 화면, 나들이 메뉴와 등록/추천/장소 선택, 프로필 하위 메뉴, 차량 선택, 홈 iframe, 렌트 4종, 공간 OTT/웰니스/테마/구매, 관리자 6개 화면. 임시 Edge 프로필과 가짜 인증 응답을 사용했다.
- `npm run build`: Next.js 프로덕션 빌드 통과.
- `node --test "front/tests/*.test.cjs"`: **96개 중 92개 통과, 기존 불일치 4개 실패**. 차량 테스트 3개는 삭제된 `easyfit`과 이전 차종 구성을 기대한다. 관리자 테스트 1개는 `styles.css` 원본 바이트 해시가 다르다. 실패 지점의 차량 카탈로그·요금 코드·CSS·테스트 파일은 이번 변경에서 수정하지 않았고 `origin/main`과 동일하다.
- `git diff --check`: 통과.

이 검사는 저장소의 UI와 기본/데모 데이터를 대상으로 한다. 모든 실시간 DB 레코드, 실제 AI 응답, 지도 공급자의 지도 타일·상호, 사용자 작성 글, 편집 중인 관리자 데이터의 언어를 보장하는 검사는 아니다. 영화 배너의 이미지 내부 한글은 아래 제한 사항이 남아 있다. 언어 선택 버튼의 `한국어` 표시는 의도적으로 유지한다.

## 배너와 남은 제한

빌트인 imagegen 도구와 [imagegen 스킬](C:/Users/user/.codex/skills/.system/imagegen/SKILL.md)을 사용해 기존 이미지의 문자만 영어로 편집했다. 결과는 프로젝트 안에 복사했고 한국어 원본을 보존했다.

- `front/public/assets/banner-food-en.png`
- `front/public/assets/banner-exhibit-en.png`

두 배너는 홈과 렌트 iframe의 언어 선택에 맞춰 전환된다. **스파이더맨 배너 편집은 이미지 생성 도구의 안전 시스템에서 거절되어 원본을 유지했다.** 외부 제목·설명은 번역되지만 이미지 내부 한글은 남아 있다.

공통 프롬프트:

> Use case: text-localization. Edit this existing website banner. Translate only Korean lettering into English; retain all imagery, layout and proportions.

음식 배너 프롬프트:

> Replace Korean headline with 'A SPECIAL DAY, AN EXTRAORDINARY MEAL'. Replace body with 'Crisp outside, tender inside. Beef Wellington, crafted with care.' Replace lower-right Korean with 'Good food makes a great day.' Preserve all existing English, food, lighting, composition and aspect ratio.

전시 배너 프롬프트:

> Replace Korean at lower right of blue area with 'Inventing Modern Vision'. Replace Korean foundation name at bottom left with 'Hanwha Foundation of Culture' without duplicate English. Preserve all existing English titles, the blue background, black lettering, decorative border and logos, original aspect ratio.

거절된 영화 배너 프롬프트:

> Replace central Korean title with 'SPIDER-MAN', same red dimensional logo style. Replace yellow subtitle with 'BRAND NEW DAY'. Replace black Korean release text below with 'IN THEATERS JULY'. Preserve the characters, poses, sky, architecture, composition, Marvel Studios logo and copyright, original aspect ratio.

## 다음 동기화

### 사용자 제보 후 보완 검증

- 경로 입력값과 검색 결과의 장소명·주소를 영어로 표시하면서 원래 검색어, 저장된 이름, 좌표를 보존한다. 새로 입력 중인 값은 언어 전환으로 덮어쓰지 않는다.
- 기존 출발지·경유지·목적지에 포커스하거나 마우스를 올리면 상세 주소 검색 결과가 열린다. 알고 있는 주소는 필드 아래에도 표시한다.
- `안국역` 검색 결과의 `안국역 3호선`을 유일한 역 이름으로 확인하면 경로를 계산한다. 출구·상호·서로 다른 좌표의 중복 결과는 자동 선택하지 않는다. 이전 방문에서 실패한 위치 조회도 다시 시도한다.
- NAVER SDK `language=en`과 영어 타일 레이블 `len`을 사용한다. 언어 전환 시 기본 지도만 교체하고 경로와 좌표를 유지한다. NAVER 제공 타일은 한·영 병기일 수 있다.
- `translations/places-en.json`에 현재 공개 코스의 장소명, 띄어쓰기 별칭, 데모 작성자와 소리 분류명을 추가했다. 알 수 없는 장소명·주소의 로마자 표기는 공식 영문명 검증을 의미하지 않는다.
- 커뮤니티 코스 제목, 상세 보기 및 개별 장소 상세와 소리 선택의 `optgroup label`을 검증에 포함했다.

검증 결과:

- 공개 API 코스 1,071개의 제목과 장소명: 번역 후 한글 잔존 없음.
- `node tools/check_english.cjs --live-courses`: 40개 화면 및 주소 포커스·호버·원문 검색어·언어 복원 검사 통과.
- `node tools/check_naver_maps.cjs http://localhost:3000 --english-route`: 실제 영어 지도 타일, 안국역 렌트 경로, 오페라하우스 택시 경로, 기존 입력값 주소 조회, 한·영 전환 검증 통과.
- 지도·렌트 경로·코스 위치 테스트 44개 통과, `npm run build` 통과.

`translations/README.md`의 추출→검수→내보내기→브라우저 검사 순서로 진행한다. `python tools/compare_translation_sync.py --base origin/main --english english`는 기준 브랜치들과 현재 작업 파일을 다시 비교한다. 새 원문과 런타임 문구는 사람이 검수하고, 없어진 TSV/런타임 항목은 정리한다.
