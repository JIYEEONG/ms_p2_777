/* Shared home assets; prices from policy HTML. */
const rentalVehicles = MoovVehicleCatalog.vehicles.map(vehicle => ({
  ...vehicle, baggage: `${vehicle.baggage}개`, image: vehicle.image.replace('./moov-home/', '')
}));
const rentalFarePolicy = MoovVehicleCatalog.rentalRates;
const rentalOptionCatalog = [
  { id: "privacy", name: "프라이버시 글라스", price: 3000 },
  { id: "wellness", name: "웰니스 온도·조명", price: 2000 },
  { id: "ott", name: "OTT 엔터테인먼트", price: 4000 },
];
const homePromotions = [
  { id: "food", tag: "프로모션", title: "특별한 오늘, 더 특별한 한 끼", desc: "근처 프리미엄 다이닝 코스를 추천해요.", image: "../assets/배너_음식점.png", imageEn:"../assets/배너_음식점.png", action: "browse-courses-home" },
  { id: "exhibit", tag: "추천 코스", title: "큐비스트: 시각의 혁신가들", desc: "전시와 산책을 잇는 문화 나들이.", image: "../assets/배너_전시.png", imageEn: "../assets/배너_전시.png", action: "browse-courses-home" },
  { id: "movie", tag: "광고", title: "스파이더맨 브랜드 뉴 데이", desc: "극장가 이벤트와 주변 코스를 함께 확인하세요.", image: "../assets/배너_스파이더맨.webp", imageEn: "../assets/배너_스파이더맨.webp", action: "browse-courses-home" },
];
const appNotices = [
  { id: "notice-1", tag: "공지", title: "차량 내부 개인정보 자동 삭제 안내", date: "2026.09.12", text: "하차가 확인되면 OTT 로그인 토큰, 음성 원본과 차량 디스플레이 기록을 자동으로 삭제합니다." },
  { id: "event-1", tag: "이벤트", title: "첫 렌트 이용 20% 할인", date: "2026.09.30까지", text: "첫 렌트 예약 고객에게 최대 2만원 할인을 제공합니다. 다른 쿠폰과 중복 적용되지 않습니다." },
  { id: "notice-2", tag: "업데이트", title: "관심 상품과 구매 내역 기능 추가", date: "2026.09.12", text: "차량별 재고 확인, 관심 목록 저장과 전자 영수증 조회 기능이 추가되었습니다." },
];
