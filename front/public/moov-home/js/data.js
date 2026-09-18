/* Shared home assets; prices from policy HTML. */
const rentalVehicles = [
  { id: "standard", name: "MOOV 컴팩트", seats: "1~2인", baggage: "1개", category: "컴팩트", desc: "도심 이동에 편한 2인형 자율주행 차량", image: "assets/8934912b44347ad3.png", about: "짧은 이동이나 혼자·둘이 이용하기 좋은 컴팩트형 차량입니다.", accent: "#53B175" },
  { id: "easyfit", name: "MOOV 이지핏", seats: "최대 4인", baggage: "2개", category: "이지핏", desc: "넓은 출입구와 편안한 승하차", image: "assets/33b13453f88ad262.png", about: "넓은 개방형 도어와 여유로운 실내 공간을 갖춘 이동 편의형 차량입니다.", accent: "#72C9B2" },
  { id: "family", name: "MOOV 패밀리", seats: "최대 6인", baggage: "4개", category: "패밀리", desc: "가족·친구와 함께 이동하기 좋은 다인승", image: "assets/263af28a256b1278.png", about: "가족 나들이와 짐이 많은 이동을 고려한 넓은 실내 중심의 차량입니다.", accent: "#61B48B" },
  { id: "premium", name: "MOOV 라운지", seats: "최대 6인", baggage: "3개", category: "프리미엄", desc: "이동 중에도 머무를 수 있는 라운지형 공간", image: "assets/46edadb897016e6a.png", about: "좌석과 실내 공간을 라운지처럼 활용할 수 있도록 구성한 프리미엄 차량입니다.", accent: "#9F8DD2" },
  { id: "barrierfree", name: "MOOV 배리어프리", seats: "최대 5인", baggage: "2개", category: "배리어프리", desc: "휠체어 승하차를 지원하는 접근성 특화 차량", image: "assets/faa24cc841b99c10.png", about: "경사로와 넓은 승하차 공간을 갖춰 휠체어 이용자도 편하게 탑승할 수 있습니다.", accent: "#49A995" },
];
const rentalFarePolicy = {
  standard: { label: "컴팩트", packages: {3:10180, 6:18950, 9:27000, 12:34340, 18:45330} },
  easyfit: { label: "이지핏", packages: {3:12900, 6:24000, 9:34200, 12:43500, 18:57420} },
  family: { label: "패밀리", packages: {3:29870, 6:55580, 9:79200, 12:100740, 18:132970} },
  premium: { label: "프리미엄", packages: {3:29870, 6:55580, 9:79200, 12:100740, 18:132970} },
  barrierfree: { label: "배리어프리", packages: {3:29870, 6:55580, 9:79200, 12:100740, 18:132970} },
};
const rentalOptionCatalog = [
  { id: "privacy", name: "프라이버시 글라스", price: 3000 },
  { id: "wellness", name: "웰니스 온도·조명", price: 2000 },
  { id: "ott", name: "OTT 엔터테인먼트", price: 4000 },
];
const homePromotions = [
  { id: "food", tag: "프로모션", title: "특별한 오늘, 더 특별한 한 끼", desc: "근처 프리미엄 다이닝 코스를 추천해요.", image: "assets/7b6bdf8819edd612.svg", imageEn: "assets/7b6bdf8819edd612-en.svg", action: "browse-courses-home" },
  { id: "exhibit", tag: "추천 코스", title: "큐비스트: 시각의 혁신가들", desc: "전시와 산책을 잇는 문화 나들이.", image: "assets/8979930f4b10b98d.svg", imageEn: "assets/8979930f4b10b98d-en.svg", action: "browse-courses-home" },
  { id: "movie", tag: "광고", title: "스파이더맨 브랜드 뉴 데이", desc: "극장가 이벤트와 주변 코스를 함께 확인하세요.", image: "assets/181d0e69cc874d8b.svg", imageEn: "assets/181d0e69cc874d8b-en.svg", action: "browse-courses-home" },
];
const appNotices = [
  { id: "notice-1", tag: "공지", title: "차량 내부 개인정보 자동 삭제 안내", date: "2026.09.12", text: "하차가 확인되면 OTT 로그인 토큰, 음성 원본과 차량 디스플레이 기록을 자동으로 삭제합니다." },
  { id: "event-1", tag: "이벤트", title: "첫 렌트 이용 20% 할인", date: "2026.09.30까지", text: "첫 렌트 예약 고객에게 최대 2만원 할인을 제공합니다. 다른 쿠폰과 중복 적용되지 않습니다." },
  { id: "notice-2", tag: "업데이트", title: "관심 상품과 구매 내역 기능 추가", date: "2026.09.12", text: "차량별 재고 확인, 관심 목록 저장과 전자 영수증 조회 기능이 추가되었습니다." },
];
