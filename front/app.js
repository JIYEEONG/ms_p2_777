const STORAGE_KEY = "moov-app-v2";
const APP_VERSION = "2.6.2";
const DEFAULT_PROFILE_PHOTO = "./assets/profile-male-user.png";

const baseCourses = [
  {
    id: "seongsu",
    author: "지영",
    name: "성수동 감성 카페 투어 🌿",
    desc: "햇살 좋은 로스터리와 감각적인 공간을 잇는 성수 반나절 코스",
    image: "./assets/course-cafe.jpg",
    time: "3곳 · 약 4시간",
    stops: ["어니언 성수", "대림창고 갤러리", "서울숲 카페거리"],
    dwell: ["70분", "60분", "80분"], distance: 1.8, likes: 684, createdAt: "2026-09-12",
    recommend: "평일 오후 2시 이전에 출발하면 대기 시간을 줄이고 자연광이 좋은 좌석을 이용하기 좋아요.",
  },
  {
    id: "hangang",
    author: "민우",
    name: "한강 일몰 드라이브 🌆",
    desc: "강변도로의 노을부터 반포 야경까지 이어지는 로맨틱 드라이브",
    image: "./assets/course-hangang-sunset.jpg",
    time: "3곳 · 약 3시간",
    stops: ["뚝섬 한강공원", "반포대교 달빛광장", "남산 서울타워"],
    dwell: ["40분", "50분", "45분"], distance: 4.6, likes: 921, createdAt: "2026-09-11",
    recommend: "일몰 50분 전에 출발하면 강변의 골든아워와 반포의 야경을 모두 감상할 수 있어요.",
  },
  { id: "baseball", author: "현수", name: "잠실 야구장 응원 데이 ⚾", desc: "경기 전 맛집부터 야간 경기의 열기까지 즐기는 코스", image: "./assets/course-baseball.jpg", time: "3곳 · 약 5시간", stops: ["잠실새내 먹자골목", "잠실야구장", "석촌호수 산책로"], dwell: ["60분", "180분", "40분"], distance: 8.1, likes: 778, createdAt: "2026-09-10", recommend: "경기 시작 90분 전에 도착하면 식사와 입장을 여유롭게 진행할 수 있어요." },
  { id: "jazz", author: "소연", name: "도심 재즈바 나이트 🎷", desc: "저녁 식사 후 라이브 재즈를 가까이에서 즐기는 밤 코스", image: "./assets/course-jazz.jpg", time: "3곳 · 약 4시간", stops: ["이태원 앤틱거리", "한남동 다이닝", "경리단길 재즈바"], dwell: ["40분", "80분", "120분"], distance: 7.2, likes: 592, createdAt: "2026-09-09", recommend: "공연 좌석은 예약을 권장하며, 조용히 음악을 즐기고 싶은 날 선택하기 좋아요." },
  { id: "camping", author: "준호", name: "난지 한강 캠핑 힐링 🏕️", desc: "도심을 벗어나지 않고 노을과 캠핑 감성을 누리는 코스", image: "./assets/course-camping.jpg", time: "3곳 · 약 6시간", stops: ["망원시장", "난지캠핑장", "난지한강공원 전망쉼터"], dwell: ["60분", "240분", "50분"], distance: 10.4, likes: 843, createdAt: "2026-09-08", recommend: "캠핑장 예약과 반입 가능 준비물을 미리 확인하고 일몰 2시간 전에 입장해 보세요." },
  { id: "bugak", author: "태민", name: "북악산 야경 드라이브 🌙", desc: "굽이진 산길과 서울의 파노라마 야경을 즐기는 코스", image: "./assets/course-bugak.jpg", time: "3곳 · 약 2.5시간", stops: ["부암동 카페거리", "북악스카이웨이", "팔각정 전망대"], dwell: ["50분", "35분", "55분"], distance: 6.9, likes: 1024, createdAt: "2026-09-06", recommend: "교통량이 줄어드는 평일 저녁에 이동하면 전망대 주차와 야경 감상이 한결 편해요." },
  { id: "insadong", author: "가은", name: "인사동 전통문화 산책 🏮", desc: "공예 상점과 전통찻집을 천천히 둘러보는 문화 코스", image: "./assets/course-insadong.jpg", time: "3곳 · 약 4시간", stops: ["쌈지길", "인사동길", "익선동 한옥거리"], dwell: ["70분", "90분", "70분"], distance: 5.5, likes: 645, createdAt: "2026-09-05", recommend: "보행 구간이 많아 편한 신발을 준비하고 공방 운영시간을 확인해 주세요." },
  { id: "pottery", author: "은채", name: "이천 도자기 공방 체험 🏺", desc: "흙을 빚고 나만의 작품을 만드는 감성 체험 코스", image: "./assets/course-pottery.jpg", time: "3곳 · 약 5.5시간", stops: ["이천도자예술마을", "도자기 물레 공방", "설봉공원"], dwell: ["70분", "150분", "60분"], distance: 59, likes: 532, createdAt: "2026-09-04", recommend: "물레 체험은 예약이 필요하며 완성품 배송 기간을 공방에 확인하는 것이 좋아요." },
  { id: "seokchon", author: "하린", name: "석촌호수 봄 산책 🌸", desc: "호수와 벚꽃, 도심 스카이라인을 함께 담는 산책 코스", image: "./assets/course-seokchon.jpg", time: "3곳 · 약 3시간", stops: ["석촌호수 서호", "롯데월드타워 전망광장", "송리단길"], dwell: ["70분", "45분", "60분"], distance: 8.4, likes: 1162, createdAt: "2026-09-12", recommend: "주말 오전 10시 이전에 방문하면 비교적 한적한 호숫가를 걸을 수 있어요." },
  { id: "lotteworld", author: "다현", name: "롯데월드 판타지 데이 🎠", desc: "회전목마부터 야간 퍼레이드까지 알차게 즐기는 코스", image: "./assets/course-lotteworld.jpg", time: "3곳 · 약 7시간", stops: ["롯데월드 회전목마", "어드벤처 매직아일랜드", "석촌호수 야경"], dwell: ["150분", "210분", "50분"], distance: 8.7, likes: 1388, createdAt: "2026-09-11", recommend: "오픈 시간에 맞춰 입장하고 인기 시설을 먼저 이용하면 동선을 줄일 수 있어요." },
  { id: "seoulforest", author: "예린", name: "서울숲 피크닉 산책 🌳", desc: "숲길과 잔디밭에서 여유를 채우는 도심 자연 코스", image: "./assets/course-seoulforest.jpg", time: "3곳 · 약 3.5시간", stops: ["서울숲 메타세쿼이아길", "가족마당", "성수 카페거리"], dwell: ["60분", "80분", "70분"], distance: 2.4, likes: 905, createdAt: "2026-09-10", recommend: "돗자리를 준비하면 가족마당에서 여유롭게 쉬기 좋고 자전거 대여도 추천해요." },
  { id: "artscenter", author: "서진", name: "예술의전당 문화 산책 🎭", desc: "전시와 공연, 음악분수를 잇는 품격 있는 저녁 코스", image: "./assets/course-artscenter.jpg", time: "3곳 · 약 4시간", stops: ["한가람미술관", "예술의전당 오페라하우스", "세계음악분수"], dwell: ["100분", "120분", "30분"], distance: 11.8, likes: 487, createdAt: "2026-09-09", recommend: "전시 종료와 공연 시작 사이에 식사 시간을 두고 티켓 수령 시간을 확인해 주세요." },
  { id: "naengmyeon", author: "동욱", name: "서울 평양냉면 미식 코스 🥢", desc: "담백한 육향과 메밀 향을 제대로 즐기는 노포 탐방", image: "./assets/course-naengmyeon.jpg", time: "3곳 · 약 3시간", stops: ["을지로 노포거리", "평양냉면 전문점", "덕수궁 돌담길"], dwell: ["35분", "70분", "60분"], distance: 5.9, likes: 714, createdAt: "2026-09-08", recommend: "점심 혼잡을 피하려면 오전 11시 20분 이전 방문을 권장해요." },
  { id: "tonkatsu", author: "재민", name: "남산 돈까스와 전망대 🍽️", desc: "푸짐한 경양식 돈까스와 남산 전망을 즐기는 코스", image: "./assets/course-tonkatsu.jpg", time: "3곳 · 약 3.5시간", stops: ["남산 돈까스 거리", "남산 케이블카", "N서울타워 전망대"], dwell: ["70분", "40분", "80분"], distance: 6.7, likes: 826, createdAt: "2026-09-07", recommend: "식사 후 케이블카 탑승 시간을 고려해 일몰 90분 전에 출발해 보세요." },
  { id: "library", author: "수민", name: "서울 도서관 북캉스 📚", desc: "따뜻한 열람 공간에서 책과 휴식을 즐기는 하루", image: "./assets/course-library.jpg", time: "3곳 · 약 4시간", stops: ["서울도서관", "정동길", "청계천 책쉼터"], dwell: ["120분", "55분", "60분"], distance: 5.2, likes: 608, createdAt: "2026-09-12", recommend: "열람실 운영시간과 휴관일을 확인하고 조용한 오전 시간대를 이용해 보세요." },
];

const rentalVehicles = [
  { id: "standard", name: "MOOV 컴팩트", seats: "1~2인", price: 22000, desc: "도심 이동에 편한 기본형", image: "./assets/vehicle-compact.png" },
  { id: "premium", name: "MOOV 라운지", seats: "1~4인", price: 29000, desc: "넓은 좌석과 독립형 테이블", image: "./assets/vehicle-lounge.png" },
  { id: "family", name: "MOOV 패밀리", seats: "최대 6인", price: 34000, desc: "가족·짐이 많은 여행용", image: "./assets/vehicle-family.png" },
  { id: "barrierfree", name: "MOOV 이지핏", seats: "1~3인", price: 32000, desc: "휠체어 승하차와 넓은 이동 공간", image: "./assets/vehicle-easyfit.jpg" },
];

const themeAssets = {
  "기본": "./assets/cabin-default.jpg",
  "윈도우": "./assets/theme-window.jpg",
  "콘텐츠": "./assets/theme-contents.jpg",
  "웰니스": "./assets/theme-wellness.jpg",
  "수면": "./assets/theme-sleep.jpg",
  "프라이빗": "./assets/theme-private.jpg",
};

const aiPersonas = [
  { id: "moov", name: "무브", desc: "캐주얼한 잡담, 공감 위주 대화", image: "./assets/luna-moov.svg" },
  { id: "todaki", name: "토닥이", desc: "고민 상담, 공감 기반 대화", image: "./assets/luna-todaki.svg" },
  { id: "doctor", name: "척척박사", desc: "아는 만큼 답해주는 지식 모드", image: "./assets/luna-doctor.svg" },
  { id: "ringo", name: "링고", desc: "실시간 통역과 주변 관광정보 안내", image: "./assets/luna-ringo.svg" },
];
const LUNA_BOT_IMAGE = "./assets/luna-bot.svg"; // 캐빈 라이브 화면 외 모든 곳에서 사용하는 공통 루나 아이콘

const outingFilterConfig = [
  { key: "category", label: "무엇을 할까요", values: ["전체", "음식점", "카페", "전시", "쇼핑", "관광", "체험"] },
  { key: "mood", label: "분위기", values: ["전체", "조용함", "활기참", "감성", "트렌디", "로맨틱"] },
  { key: "companion", label: "동행", values: ["전체", "혼자", "연인", "친구", "가족", "동료"] },
  { key: "purpose", label: "목적", values: ["전체", "식사", "대화", "미팅", "휴식", "쇼핑", "체험", "데이트"] },
  { key: "time", label: "시간대", values: ["전체", "아침", "점심", "오후", "저녁", "야간"] },
];

const courseTagProfiles = {
  seongsu: { category: ["카페"], mood: ["감성", "트렌디"], companion: ["혼자", "친구", "연인"], purpose: ["대화", "휴식"], time: ["오후", "저녁"], price: 32000 },
  hangang: { category: ["관광", "체험"], mood: ["로맨틱", "감성"], companion: ["연인", "친구", "가족"], purpose: ["휴식", "데이트"], time: ["저녁", "야간"], price: 22000 },
  baseball: { category: ["음식점", "체험"], mood: ["활기참", "트렌디"], companion: ["친구", "가족"], purpose: ["식사", "체험"], time: ["저녁", "야간"], price: 45000 },
  jazz: { category: ["음식점", "체험"], mood: ["로맨틱", "트렌디"], companion: ["연인", "친구"], purpose: ["데이트", "대화"], time: ["저녁", "야간"], price: 52000 },
  camping: { category: ["음식점", "관광", "체험"], mood: ["감성", "활기참"], companion: ["친구", "가족"], purpose: ["휴식", "체험"], time: ["오후", "저녁"], price: 58000 },
  bugak: { category: ["카페", "관광"], mood: ["조용함", "로맨틱"], companion: ["혼자", "연인"], purpose: ["휴식", "데이트"], time: ["저녁", "야간"], price: 26000 },
  insadong: { category: ["카페", "쇼핑", "관광"], mood: ["조용함", "감성"], companion: ["혼자", "친구", "가족"], purpose: ["대화", "쇼핑", "휴식"], time: ["점심", "오후"], price: 30000 },
  pottery: { category: ["체험", "관광"], mood: ["조용함", "감성"], companion: ["연인", "친구", "가족"], purpose: ["체험", "데이트"], time: ["점심", "오후"], price: 65000 },
  seokchon: { category: ["카페", "관광"], mood: ["감성", "로맨틱"], companion: ["혼자", "연인", "친구"], purpose: ["휴식", "데이트"], time: ["오후", "저녁"], price: 28000 },
  lotteworld: { category: ["체험", "쇼핑"], mood: ["활기참", "트렌디"], companion: ["연인", "친구", "가족"], purpose: ["체험", "데이트"], time: ["점심", "오후", "저녁"], price: 90000 },
  seoulforest: { category: ["카페", "관광"], mood: ["조용함", "감성"], companion: ["혼자", "친구", "가족"], purpose: ["휴식", "대화"], time: ["아침", "오후"], price: 24000 },
  artscenter: { category: ["전시", "체험"], mood: ["조용함", "로맨틱"], companion: ["혼자", "연인", "동료"], purpose: ["체험", "데이트"], time: ["오후", "저녁"], price: 70000 },
  naengmyeon: { category: ["음식점"], mood: ["조용함"], companion: ["혼자", "친구", "동료"], purpose: ["식사"], time: ["점심", "저녁"], price: 23000 },
  tonkatsu: { category: ["음식점", "관광"], mood: ["활기참"], companion: ["친구", "가족"], purpose: ["식사", "휴식"], time: ["점심", "저녁"], price: 34000 },
  library: { category: ["관광", "체험"], mood: ["조용함"], companion: ["혼자", "동료"], purpose: ["휴식", "미팅"], time: ["아침", "오후"], price: 12000 },
};

const rentalOptionCatalog = [
  { id: "privacy", name: "프라이버시 글라스", price: 3000 },
  { id: "wellness", name: "웰니스 온도·조명", price: 2000 },
  { id: "ott", name: "OTT 엔터테인먼트", price: 4000 },
];

const products = [
  { id: "bottled-water", name: "무라벨 생수", desc: "500ml · 시원하게 보관", price: 1200, image: "./assets/product-01-bottled-water.jpg", category: "음료·간식", recommended: true, stock: 10, location: "냉장함 A-01" },
  { id: "sparkling-water", name: "탄산수", desc: "330ml · 무향 탄산", price: 1800, image: "./assets/product-02-sparkling-water.jpg", category: "음료·간식", recommended: true, stock: 6, location: "냉장함 A-02" },
  { id: "green-tea", name: "무가당 녹차", desc: "350ml · 깔끔한 무가당 음료", price: 2200, image: "./assets/product-03-green-tea.jpg", category: "음료·간식", recommended: false, stock: 5, location: "냉장함 A-03" },
  { id: "protein-bar", name: "프로틴바", desc: "1개 · 이동 중 에너지 보충", price: 3200, image: "./assets/product-04-protein-bar.jpg", category: "음료·간식", recommended: true, stock: 7, location: "수납함 B-01" },
  { id: "mixed-nuts", name: "믹스넛", desc: "30g · 부스러기 적은 포장 스낵", price: 2900, image: "./assets/product-05-mixed-nuts.jpg", category: "음료·간식", recommended: false, stock: 5, location: "수납함 B-02" },
  { id: "honey-butter-chips", name: "과자-허니버터칩", desc: "60g · 달콤한 허니버터 감자칩", price: 2500, image: "./assets/product-16-honey-butter-chips.png", category: "음료·간식", recommended: true, stock: 6, location: "수납함 B-03" },
  { id: "dried-fruit-chips", name: "건조 과일칩", desc: "25g · 산뜻한 과일 간식", price: 3400, image: "./assets/product-06-dried-fruit-chips.jpg", category: "음료·간식", recommended: false, stock: 4, location: "수납함 B-03" },
  { id: "rice-ball", name: "한입 주먹밥", desc: "2개입 · 개별 포장 식사", price: 4200, image: "./assets/product-07-rice-ball.jpg", category: "식사", recommended: true, stock: 4, location: "냉장함 C-01" },
  { id: "mini-sandwich", name: "미니 샌드위치", desc: "1팩 · 오늘 제조 간편식", price: 5900, image: "./assets/product-08-mini-sandwich.jpg", category: "식사", recommended: true, stock: 3, location: "냉장함 C-02" },
  { id: "fruit-cup", name: "컷 과일컵", desc: "180g · 포크 포함 밀폐 컵", price: 4900, image: "./assets/product-09-fruit-cup.jpg", category: "음료·간식", recommended: true, stock: 3, location: "냉장함 C-03" },
  { id: "plain-yogurt", name: "플레인 요거트", desc: "1컵 · 스푼 포함", price: 2800, image: "./assets/product-10-plain-yogurt.jpg", category: "음료·간식", recommended: false, stock: 4, location: "냉장함 C-04" },
  { id: "wet-wipes", name: "손소독 물티슈", desc: "10매 · 차량 내부 청결용", price: 1800, image: "./assets/product-11-wet-wipes.jpg", category: "편의용품", recommended: true, stock: 8, location: "수납함 D-01" },
  { id: "neck-pillow", name: "목베개", desc: "1개 · 장거리 이동 휴식용", price: 8900, image: "./assets/product-12-neck-pillow.jpg", category: "편의용품", recommended: true, stock: 2, location: "수납함 D-02" },
  { id: "eye-mask", name: "수면 안대", desc: "1개 · 수면 모드 추천", price: 3900, image: "./assets/product-13-eye-mask.jpg", category: "편의용품", recommended: false, stock: 3, location: "수납함 D-03" },
  { id: "disposable-slippers", name: "일회용 슬리퍼", desc: "1켤레 · 위생 포장", price: 2500, image: "./assets/product-14-disposable-slippers.jpg", category: "편의용품", recommended: false, stock: 4, location: "수납함 D-04" },
  { id: "travel-blanket", name: "휴대용 담요", desc: "1개 · 웰니스·수면 모드 추천", price: 7900, image: "./assets/product-15-travel-blanket.jpg", category: "편의용품", recommended: true, stock: 2, location: "수납함 D-05" },
];

const appNotices = [
  { id: "notice-1", tag: "공지", title: "차량 내부 개인정보 자동 삭제 안내", date: "2026.09.12", text: "하차가 확인되면 OTT 로그인 토큰, 음성 원본과 차량 디스플레이 기록을 자동으로 삭제합니다." },
  { id: "event-1", tag: "이벤트", title: "첫 렌트 이용 20% 할인", date: "2026.09.30까지", text: "첫 렌트 예약 고객에게 최대 2만원 할인을 제공합니다. 다른 쿠폰과 중복 적용되지 않습니다." },
  { id: "notice-2", tag: "업데이트", title: "관심 상품과 구매 내역 기능 추가", date: "2026.09.12", text: "차량별 재고 확인, 관심 목록 저장과 전자 영수증 조회 기능이 추가되었습니다." },
];

const homePromotions = [
  { id: "food", tag: "프로모션", title: "특별한 오늘, 더 특별한 한 끼", desc: "근처 프리미엄 다이닝 코스를 추천해요.", image: "./assets/배너_음식점.png", action: "browse-courses-home" },
  { id: "exhibit", tag: "추천 코스", title: "큐비스트: 시각의 혁신가들", desc: "전시와 산책을 잇는 문화 나들이.", image: "./assets/배너_전시.png", action: "browse-courses-home" },
  { id: "movie", tag: "광고", title: "스파이더맨 브랜드 뉴 데이", desc: "극장가 이벤트와 주변 코스를 함께 확인하세요.", image: "./assets/배너_스파이더맨.webp", action: "browse-courses-home" },
];

const historyRoutes = [
  { id: "ride-1", date: "2026-09-10", name: "성수 → 한강 야경", meta: "2026.09.10 · 렌트 3시간 12분", stops: ["성수연방", "뚝섬 한강공원", "반포대교 달빛광장"] },
  { id: "ride-2", date: "2026-09-07", name: "북촌 산책 코스", meta: "2026.09.07 · 택시 2시간 5분", stops: ["안국역", "북촌한옥마을", "삼청동 카페거리"] },
  { id: "ride-3", date: "2026-08-22", name: "잠실 호수 나들이", meta: "2026.08.22 · 렌트 4시간 20분", stops: ["서울숲", "석촌호수 서호", "송리단길"] },
  { id: "ride-4", date: "2026-07-18", name: "남산 저녁 드라이브", meta: "2026.07.18 · 택시 1시간 48분", stops: ["명동역", "남산 돈까스 거리", "N서울타워"] },
  { id: "ride-5", date: "2026-05-03", name: "예술의전당 문화 코스", meta: "2026.05.03 · 렌트 5시간 10분", stops: ["한가람미술관", "예술의전당 오페라하우스", "서래마을"] },
  { id: "ride-6", date: "2025-11-14", name: "인사동 공방 산책", meta: "2025.11.14 · 택시 2시간 16분", stops: ["안국역", "쌈지길", "익선동 한옥거리"] },
];

function readSaved() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); }
  catch { return {}; }
}

const saved = readSaved();
const state = {
  isAuthenticated: saved.isAuthenticated || false,
  activeTab: "home",
  homeMode: saved.homeMode || "taxi",
  homeStep: saved.tripActive ? "service" : "mode",
  tripActive: saved.tripActive || false,
  usageStartedAt: saved.usageStartedAt || null,
  rentalEndsAt: saved.rentalEndsAt || (saved.tripActive && saved.homeMode === "rent" && saved.usageStartedAt ? saved.usageStartedAt + (saved.rentalHours || 2) * 3600000 : null),
  pickupLocation: (saved.pickupLocation || "현재 위치 · 서울 성수동").replace(/^지도 핀\s*·\s*/, ""),
  mapPinOpen: false,
  returnToHomeAfterCourse: false,
  rentalHours: saved.rentalHours || 2,
  taxiVehicleType: saved.taxiVehicleType || "standard",
  rentalVehicleType: saved.rentalVehicleType || "standard",
  rentalOptions: new Set(saved.rentalOptions || ["privacy"]),
  aiStatus: "idle",
  aiPersona: saved.aiPersona || "무브",
  aiVoiceEnabled: saved.aiVoiceEnabled ?? true,
  aiSaveEnabled: saved.aiSaveEnabled ?? false,
  aiAutoStart: saved.aiAutoStart ?? true,
  aiCrisisOpen: false,
  aiChatExpanded: false,
  aiHistoryDetailId: null,
  personaMenuOpen: false,
  chatFontScale: saved.chatFontScale ?? 1,
  aiSub: "talk",
  // 진행 중인 대화(라이브 스레드)는 대화 기록 저장 동의와 무관하게 항상 이어짐.
  // 저장 동의가 켜져 있을 때만 아래 chatThreads(대화 기록)에 별도로 반영됨.
  liveThread: saved.liveThread || null,
  liveSessionKey: saved.liveSessionKey || null,
  chatThreads: saved.chatThreads || [{
    id: "thread-sample-1",
    title: "오늘 이동 중 나눈 대화",
    updated: "3분 전",
    persona: "무브",
    messages: [
      { role: "ai", text: "오늘따라 차가 좀 막히네요. 심심하지 않으세요?", time: "15:12" },
      { role: "user", text: "응 좀 심심했어", time: "15:12" },
      { role: "ai", text: "그럼 가벼운 얘기 하나 해드릴까요? 요즘 성수동에 재밌는 팝업이 많더라고요.", time: "15:13" },
    ],
  }],
  spaceSub: "purchase",
  purchaseSub: "search",
  productCategory: "추천",
  productQuery: "",
  homeQuery: saved.homeQuery || "",
  productLikes: new Set((saved.productLikes || ["fruit-cup"]).filter((id) => products.some((product) => product.id === id))),
  cart: (saved.cart || [{ id: "bottled-water", qty: 1 }]).filter((line) => products.some((product) => product.id === line.id)),
  orders: saved.orders || [],
  outingSub: "recommend",
  outingSort: saved.outingSort || "popular",
  outingQuery: "",
  outingMapOpen: saved.outingMapOpen || false,
  outingFilters: saved.outingFilters || { category: "전체", mood: "전체", companion: "전체", purpose: "전체", time: "전체", budget: 70000 },
  locationReady: saved.locationReady || false,
  likedCourseIds: new Set(saved.likedCourseIds || []),
  savedCourseIds: new Set((saved.savedCourseIds || ["seongsu"]).filter((id) => id !== "cheomseongdae")),
  customCourses: saved.customCourses || [],
  selectedCourse: saved.selectedCourse?.id === "cheomseongdae" ? null : saved.selectedCourse || null,
  routeStops: (saved.routeStops || ["현재 위치 · 서울 성수동", "한강공원 반포지구"]).map((stop) => String(stop).replace(/^지도 핀\s*·\s*/, "")),
  courseSource: "manual",
  historyQuery: "",
  productDetailQty: 1,
  productDetailMode: "detail",
  securityEnding: false,
  courseDraft: {
    title: "",
    desc: "",
    stops: [
      { type: "경유지", name: "", photo: null },
      { type: "목적지", name: "", photo: null },
    ],
  },
  theme: saved.theme || "기본",
  pendingTheme: null,
  themeConfig: saved.themeConfig || { temperature: 22, tint: 60, light: "민트 앰비언트", privacy: true },
  username: saved.username || "지영",
  profilePhoto: saved.profilePhoto || DEFAULT_PROFILE_PHOTO,
  pendingProfilePhoto: null,
  profileView: "menu",
  paymentCards: saved.paymentCards || [{ id: "card-main", name: "신한카드", number: "•••• 8421", primary: true }],
  securityProof: saved.securityProof || null,
};

if (!rentalVehicles.some((vehicle) => vehicle.id === state.taxiVehicleType)) state.taxiVehicleType = "standard";
if (!rentalVehicles.some((vehicle) => vehicle.id === state.rentalVehicleType)) state.rentalVehicleType = "standard";

const tabMeta = {
  ai: ["Moov", "AI 말동무"],
  space: ["Moov", "공간"],
  home: ["Moov", ""],
  outing: ["Moov", "나들이"],
  profile: ["Moov", "내 정보"],
};

const content = document.querySelector("#app-content");
const title = document.querySelector("#section-title");
const kicker = document.querySelector("#section-kicker");
const modal = document.querySelector("#modal");
let splashTimer;
let toastTimer;
let speechRecognition;
let searchDebounceTimer;
let aiSwipeSuppressUntil = 0;
let aiPersonaMotionClass = "";
let outingLeafletMap;
let outingLeafletLayer;

const SEARCH_LIMIT = 5;
const SEARCH_DEBOUNCE_MS = 260;
const searchUi = { inputId: null, activeIndex: 0 };

function icon(id) { return `<svg aria-hidden="true"><use href="#i-${id}"></use></svg>`; }

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}

function normalizeSearch(value) {
  return String(value || "").trim().toLowerCase();
}

function policyRankCandidates(query, candidates, limit = SEARCH_LIMIT) {
  const q = normalizeSearch(query);
  if (!q) return [];
  const matched = candidates.filter((item) => {
    const fields = [item.name, item.queryValue, ...(item.tags || [])].filter(Boolean);
    return fields.some((field) => normalizeSearch(field).startsWith(q));
  });
  const regionResults = matched
    .filter((item) => item.category === "지역")
    .sort((a, b) => (b.search_count || 0) - (a.search_count || 0) || a.name.localeCompare(b.name, "ko-KR"));
  const placeResults = matched
    .filter((item) => item.category !== "지역")
    .sort((a, b) => (b.search_count || 0) - (a.search_count || 0) || Number(Boolean(b.blue_ribbon)) - Number(Boolean(a.blue_ribbon)) || a.name.localeCompare(b.name, "ko-KR"));
  return [...regionResults, ...placeResults].slice(0, Math.min(limit, SEARCH_LIMIT));
}

function courseSearchCandidates() {
  const regions = [
    { id: "region-seongsu", name: "성수동", category: "지역", area: "서울", search_count: 90000, queryValue: "성수", tags: ["성수역", "서울숲", "카페"] },
    { id: "region-hangang", name: "한강공원", category: "지역", area: "서울", search_count: 76000, queryValue: "한강", tags: ["반포", "잠원", "야경"] },
    { id: "region-insadong", name: "인사동", category: "지역", area: "서울", search_count: 62000, queryValue: "인사", tags: ["전통", "문화", "공예"] },
    { id: "region-jamsil", name: "잠실", category: "지역", area: "서울", search_count: 58000, queryValue: "잠실", tags: ["석촌호수", "롯데월드"] },
  ];
  const places = baseCourses.flatMap((course) => {
    const baseScore = Number(course.likes || 0) * 100;
    const courseItem = {
      id: `course-${course.id}`,
      name: course.name,
      category: "코스",
      sub_category: "나들이",
      area: "서울",
      search_count: baseScore,
      blue_ribbon: Number(course.likes || 0) >= 900,
      itemId: course.id,
      tags: [course.desc, ...(course.stops || [])],
    };
    const stopItems = (course.stops || []).map((stop, index) => ({
      id: `place-${course.id}-${index}`,
      name: stop,
      category: /카페|로스터리|커피/.test(stop) ? "카페" : /맛집|냉면|돈까스|먹자/.test(stop) ? "음식점" : "장소",
      sub_category: course.name,
      area: "서울",
      search_count: Math.max(1000, baseScore - index * 500),
      blue_ribbon: Number(course.likes || 0) >= 900,
      queryValue: stop,
      itemId: course.id,
      tags: [course.name, course.desc],
    }));
    return [courseItem, ...stopItems];
  });
  return [...regions, ...places];
}

function productSearchCandidates() {
  return products.map((product) => ({
    id: `product-${product.id}`,
    name: product.name,
    category: "상품",
    sub_category: product.category,
    area: "차량",
    search_count: (product.stock || 0) * 10000 + (product.recommended ? 5000 : 0),
    blue_ribbon: product.recommended,
    itemId: product.id,
    tags: [product.desc, product.category],
  }));
}

function historySearchCandidates() {
  return historyRoutes.map((route) => ({
    id: `history-${route.id}`,
    name: route.name,
    category: "이용기록",
    area: "서울",
    search_count: Number(new Date(route.date)),
    itemId: route.id,
    tags: [route.meta, ...(route.stops || [])],
  }));
}

function getSearchCandidates(inputId) {
  if (inputId === "home-search") return courseSearchCandidates();
  if (inputId === "product-search") return productSearchCandidates();
  if (inputId === "course-search") return courseSearchCandidates();
  if (inputId === "history-search") return historySearchCandidates();
  return [];
}

function getSearchStateKey(inputId) {
  return { "home-search": "homeQuery", "product-search": "productQuery", "course-search": "outingQuery", "history-search": "historyQuery" }[inputId];
}

function getSearchSuggestions(inputId, query) {
  return policyRankCandidates(query, getSearchCandidates(inputId));
}

function renderSearchField({ inputId, stateKey, className, placeholder, label }) {
  const value = state[stateKey] || "";
  return `<div class="search-shell"><div class="card field-row ${className} search-with-suggest">${icon("search")}<input id="${inputId}" value="${escapeHtml(value)}" placeholder="${placeholder}" aria-label="${label}" autocomplete="off" aria-autocomplete="list" aria-expanded="${searchUi.inputId === inputId && getSearchSuggestions(inputId, value).length ? "true" : "false"}" /></div>${renderSearchSuggestions(inputId, value)}</div>`;
}

function renderSearchSuggestions(inputId, query) {
  if (searchUi.inputId !== inputId) return "";
  const suggestions = getSearchSuggestions(inputId, query);
  if (!normalizeSearch(query)) return "";
  if (!suggestions.length) return `<div class="search-suggestions empty" role="status">검색어와 일치하는 후보가 없어요</div>`;
  const active = Math.min(searchUi.activeIndex, suggestions.length - 1);
  return `<div class="search-suggestions" role="listbox" aria-label="자동완성 후보">${suggestions.map((item, index) => `<button class="${index === active ? "active" : ""}" data-action="search-suggestion" data-input="${inputId}" data-option-id="${escapeHtml(item.id || "")}" data-item="${escapeHtml(item.itemId || "")}" data-value="${escapeHtml(item.queryValue || item.name)}" role="option" aria-selected="${index === active ? "true" : "false"}"><span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.sub_category || item.area || "")}</small></span><em>${escapeHtml(item.category)}${item.blue_ribbon ? " · 블루리본" : ""}</em></button>`).join("")}</div>`;
}

function courseMatchesQuery(course, query) {
  const q = normalizeSearch(query);
  if (!q) return true;
  const fields = [course.name, course.desc, ...(course.stops || [])];
  return fields.some((field) => normalizeSearch(field).startsWith(q));
}

function persist() {
  const data = {
    isAuthenticated: state.isAuthenticated,
    username: state.username,
    profilePhoto: state.profilePhoto,
    theme: state.theme,
    themeConfig: state.themeConfig,
    productLikes: [...state.productLikes],
    cart: state.cart,
    orders: state.orders,
    tripActive: state.tripActive,
    usageStartedAt: state.usageStartedAt,
    rentalEndsAt: state.rentalEndsAt,
    homeMode: state.homeMode,
    homeQuery: state.homeQuery,
    pickupLocation: state.pickupLocation,
    rentalHours: state.rentalHours,
    taxiVehicleType: state.taxiVehicleType,
    rentalVehicleType: state.rentalVehicleType,
    rentalOptions: [...state.rentalOptions],
    outingSort: state.outingSort,
    locationReady: state.locationReady,
    likedCourseIds: [...state.likedCourseIds],
    savedCourseIds: [...state.savedCourseIds],
    customCourses: state.customCourses,
    selectedCourse: state.selectedCourse,
    routeStops: state.routeStops,
    outingMapOpen: state.outingMapOpen,
    outingFilters: state.outingFilters,
    aiPersona: state.aiPersona,
    aiVoiceEnabled: state.aiVoiceEnabled,
    aiSaveEnabled: state.aiSaveEnabled,
    aiAutoStart: state.aiAutoStart,
    chatFontScale: state.chatFontScale,
    chatThreads: state.chatThreads,
    liveThread: state.liveThread,
    liveSessionKey: state.liveSessionKey,
    paymentCards: state.paymentCards,
    securityProof: state.securityProof,
  };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { /* prototype storage can be full after large photos */ }
}

function showScreen(id) {
  document.querySelectorAll(".screen").forEach((el) => el.classList.remove("screen-active"));
  document.querySelector(`#${id}`).classList.add("screen-active");
}

function login() {
  const id = document.querySelector("#user-id").value.trim();
  const password = document.querySelector("#user-password").value.trim();
  if (!id || !password) {
    openModal({ title: "로그인 정보를 입력해 주세요", body: "체험용 앱이므로 어떤 아이디와 비밀번호든 사용할 수 있습니다.", iconName: "user", primary: "확인", secondary: null });
    return;
  }
  state.username = id.slice(0, 12);
  state.isAuthenticated = true;
  if (!state.profilePhoto) state.profilePhoto = DEFAULT_PROFILE_PHOTO;
  state.homeStep = state.tripActive ? "service" : "mode";
  persist();
  showScreen("app");
  setTab("home");
  toast(`${state.username}님, MOOV에 오신 것을 환영해요.`);
}

function setTab(tab) {
  state.activeTab = tab;
  state.mapPinOpen = false;
  const [nextKicker, nextTitle] = tabMeta[tab];
  kicker.textContent = nextKicker;
  title.textContent = nextTitle;
  document.querySelectorAll(".bottom-nav button").forEach((button) => button.classList.toggle("nav-active", button.dataset.tab === tab));
  render();
  content.scrollTop = 0;
}

function render() {
  const views = { ai: renderAi, space: renderSpace, home: renderHome, outing: renderOuting, profile: renderProfile };
  content.innerHTML = views[state.activeTab]();
  if (state.activeTab === "ai" && state.aiSub === "talk") requestAnimationFrame(scrollChat);
  requestAnimationFrame(enableDragScroll);
  // 요청사항: 무브 캐릭터 캐빈은 크기 조절이 되면 안 됨 — 스와이프/리사이즈 기능 비활성화(주석 처리, 삭제하지 않음)
  // requestAnimationFrame(enableAiPersonaSwipe);
  // requestAnimationFrame(enableAiPanelResize);
  if (state.activeTab === "outing" && state.outingSub === "recommend" && state.outingMapOpen) requestAnimationFrame(initOutingMap);
  syncCabinPreview();
  syncHeaderProfile();
}

function currentAiPersona() {
  return aiPersonas.find((persona) => persona.name === state.aiPersona) || aiPersonas[0];
}

function setAiPersona(name, silent = false) {
  const persona = aiPersonas.find((item) => item.name === name) || aiPersonas[0];
  state.aiPersona = persona.name;
  state.personaMenuOpen = false;
  currentThread().persona = persona.name;
  persist();
  render();
  if (aiPersonaMotionClass) {
    const motionClass = aiPersonaMotionClass;
    setTimeout(() => {
      document.querySelectorAll(`.${motionClass}`).forEach((el) => el.classList.remove(motionClass));
      if (aiPersonaMotionClass === motionClass) aiPersonaMotionClass = "";
    }, 520);
  }
  if (!silent) toast(`${persona.name} 모드로 변경했어요.`);
}

function shiftAiPersona(direction) {
  const currentIndex = Math.max(0, aiPersonas.findIndex((persona) => persona.name === state.aiPersona));
  const nextIndex = (currentIndex + direction + aiPersonas.length) % aiPersonas.length;
  aiPersonaMotionClass = direction > 0 ? "persona-slide-left" : "persona-slide-right";
  setAiPersona(aiPersonas[nextIndex].name);
}

function syncHeaderProfile() {
  const avatar = document.querySelector("#header-profile-avatar");
  if (!avatar) return;
  const photo = state.profilePhoto || DEFAULT_PROFILE_PHOTO;
  avatar.innerHTML = `<img src="${photo}" alt="" />`;
}

function enableDragScroll() {
  document.querySelectorAll("[data-drag-scroll]").forEach((scroller) => {
    let dragging = false;
    let startX = 0;
    let startLeft = 0;
    let movedDistance = 0;
    scroller.addEventListener("pointerdown", (event) => {
      dragging = true;
      startX = event.clientX;
      startLeft = scroller.scrollLeft;
      movedDistance = 0;
      scroller.dataset.dragMoved = "false";
      scroller.setPointerCapture(event.pointerId);
      scroller.classList.add("dragging");
      if (scroller.classList.contains("home-promo-slider")) scroller.classList.add("bouncing");
    });
    scroller.addEventListener("pointermove", (event) => {
      if (!dragging) return;
      const distance = event.clientX - startX;
      movedDistance = Math.max(movedDistance, Math.abs(distance));
      if (movedDistance > 12) { event.preventDefault(); scroller.dataset.dragMoved = "true"; }
      scroller.scrollLeft = startLeft - distance;
    });
    const stop = (event) => {
      if (!dragging) return;
      dragging = false;
      scroller.classList.remove("dragging");
      if (scroller.classList.contains("home-promo-slider")) {
        const firstSlide = scroller.querySelector(".home-promo-slide");
        if (firstSlide) {
          const style = getComputedStyle(scroller);
          const gap = Number.parseFloat(style.columnGap || style.gap || "0") || 0;
          const step = firstSlide.getBoundingClientRect().width + gap;
          const target = Math.round(scroller.scrollLeft / step) * step;
          scroller.scrollTo({ left: target, behavior: "smooth" });
        }
        scroller.classList.add("settling");
        setTimeout(() => { if (scroller.isConnected) scroller.classList.remove("bouncing", "settling"); }, 360);
      }
      if (scroller.hasPointerCapture?.(event.pointerId)) scroller.releasePointerCapture(event.pointerId);
    };
    scroller.addEventListener("pointerup", stop);
    scroller.addEventListener("pointercancel", stop);
    scroller.addEventListener("click", (event) => {
      if (scroller.dataset.dragMoved === "true") { event.preventDefault(); event.stopPropagation(); scroller.dataset.dragMoved = "false"; }
    }, true);
  });
}

function enableAiPersonaSwipe() {
  const stage = document.querySelector("[data-ai-persona-swipe]");
  if (!stage) return;
  let startX = 0;
  let startY = 0;
  let pointerId = null;
  let swiped = false;
  stage.addEventListener("pointerdown", (event) => {
    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    swiped = false;
    stage.dataset.swiping = "false";
    stage.setPointerCapture?.(event.pointerId);
  });
  stage.addEventListener("pointermove", (event) => {
    if (pointerId !== event.pointerId) return;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    if (Math.abs(dx) > 14 && Math.abs(dx) > Math.abs(dy) * 1.15) {
      stage.dataset.swiping = "true";
      event.preventDefault();
    }
  });
  const finish = (event) => {
    if (pointerId !== event.pointerId) return;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    if (Math.abs(dx) > 58 && Math.abs(dx) > Math.abs(dy) * 1.25) {
      swiped = true;
      aiSwipeSuppressUntil = Date.now() + 350;
      stage.dataset.personaSwiped = "true";
      shiftAiPersona(dx < 0 ? 1 : -1);
      setTimeout(() => { if (stage.isConnected) stage.dataset.personaSwiped = "false"; }, 250);
    }
    if (stage.hasPointerCapture?.(event.pointerId)) stage.releasePointerCapture(event.pointerId);
    pointerId = null;
    stage.dataset.swiping = "false";
  };
  stage.addEventListener("pointerup", finish);
  stage.addEventListener("pointercancel", finish);
  stage.addEventListener("click", (event) => {
    if (swiped || stage.dataset.personaSwiped === "true") {
      event.preventDefault();
      event.stopPropagation();
      swiped = false;
      stage.dataset.personaSwiped = "false";
    }
  }, true);
}

function enableAiPanelResize() {
  const shell = document.querySelector("[data-ai-resizable]");
  const handle = document.querySelector("[data-ai-resize-handle]");
  if (!shell || !handle || handle.dataset.bound === "true") return;
  handle.dataset.bound = "true";
  const updateRatio = (clientY) => {
    const rect = shell.getBoundingClientRect();
    const ratio = Math.round(((clientY - rect.top) / Math.max(rect.height, 1)) * 100);
    state.aiStageRatio = Math.min(72, Math.max(34, ratio));
    shell.style.setProperty("--ai-stage-ratio", `${state.aiStageRatio}%`);
  };
  handle.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    handle.setPointerCapture?.(event.pointerId);
    shell.classList.add("resizing");
  });
  handle.addEventListener("pointermove", (event) => {
    if (!handle.hasPointerCapture?.(event.pointerId)) return;
    updateRatio(event.clientY);
  });
  const stop = (event) => {
    if (handle.hasPointerCapture?.(event.pointerId)) handle.releasePointerCapture(event.pointerId);
    shell.classList.remove("resizing");
    persist();
  };
  handle.addEventListener("pointerup", stop);
  handle.addEventListener("pointercancel", stop);
  handle.addEventListener("dblclick", () => {
    state.aiStageRatio = 56;
    shell.style.setProperty("--ai-stage-ratio", "56%");
    persist();
  });
}

function syncCabinPreview() {
  const preview = document.querySelector("#cabin-live-image");
  const label = document.querySelector("#cabin-live-label");
  if (preview) preview.src = themeAssets[state.theme] || "./assets/cabin-default.jpg";
  if (label) label.textContent = `${state.theme} 모드 적용 중`;
}

function renderHome() {
  if (!state.tripActive && state.homeStep === "mode") return renderHomeModeChoice();
  const route = state.selectedCourse;
  return `<div class="mobility-screen ${state.homeMode}">
    <div class="mobility-mode-bar">
      ${state.tripActive ? `<span class="mode-current">${icon(state.homeMode === "taxi" ? "car" : "key")} ${state.homeMode === "taxi" ? "택시 이용 중" : "렌트 이용 중"}</span><span class="live-indicator"><i></i>LIVE</span>` : `<button class="mode-back" data-action="return-mode-choice" aria-label="이동 모드 선택으로 돌아가기">${icon("back")}</button><span class="mode-current">${icon(state.homeMode === "taxi" ? "car" : "key")} ${state.homeMode === "taxi" ? "택시" : "렌트"}</span>`}
    </div>
    ${renderMobilityMap()}
    ${state.tripActive ? renderUsageStatus() : ""}
    <section class="mobility-sheet">
      <div class="sheet-handle" aria-hidden="true"></div>
      <div class="sheet-title"><div><span>${state.homeMode === "taxi" ? "빠른 이동" : "나만의 이동 공간"}</span><h3>${state.tripActive ? "현재 이용 현황" : state.homeMode === "taxi" ? "어디로 이동할까요?" : "어떤 차량을 이용할까요?"}</h3></div><span class="mode-symbol">${icon(state.homeMode === "taxi" ? "car" : "key")}</span></div>
      ${state.tripActive ? renderActiveRoute(route) : `${renderRoutePlanner(route)}${state.homeMode === "taxi" ? taxiPanel() : rentalPanel()}`}
    </section>
  </div>`;
}

function renderHomeModeChoice() {
  return `<div class="home-mode-entry">${renderSearchField({ inputId: "home-search", stateKey: "homeQuery", className: "home-search", placeholder: "원하는 곳, 코스를 검색하세요", label: "홈 검색" })}<div class="home-mode-grid"><button class="home-mode-card taxi" data-action="select-home-mode" data-value="taxi"><img src="./assets/icon-taxi.png" alt="택시 아이콘" /><span><strong>택시</strong><small>목적지까지 빠르게 이동하고<br />거리만큼 자동 결제해요.</small></span><em>가까운 차량 약 3분 ${icon("chevron")}</em></button><button class="home-mode-card rent" data-action="select-home-mode" data-value="rent"><img src="./assets/icon-rent.png" alt="렌트 아이콘" /><span><strong>렌트</strong><small>차량과 공간 옵션을 골라<br />2~24시간 자유롭게 이용해요.</small></span><em>시간당 22,000원부터 ${icon("chevron")}</em></button></div>${renderHomePromotionSlider()}${renderHomeNoticePreview()}</div>`;
}

function renderHomePromotionSlider() {
  const slides = [...homePromotions, ...homePromotions];
  return `<section class="home-promo-section" aria-label="광고와 추천 코스"><div class="section-row"><strong>광고·프로모션</strong><span class="small muted">추천 코스</span></div><div class="home-promo-slider" data-drag-scroll>${slides.map((promo, index) => `<button class="home-promo-slide promo-${promo.id}" data-action="${promo.action}" aria-label="${escapeHtml(promo.title)}"><img src="${promo.image}" alt="${escapeHtml(promo.title)}" /><span class="home-promo-shade"></span><span class="home-promo-copy"><small>${escapeHtml(promo.tag)}</small><strong>${escapeHtml(promo.title)}</strong><em>${escapeHtml(promo.desc)}</em></span></button>`).join("")}</div></section>`;
}

function renderHomeNoticePreview() {
  return `<section class="card home-notice-preview"><div class="section-row"><strong>공지·이벤트</strong><button class="mini-action" data-action="home-notices">전체보기</button></div>${appNotices.slice(0, 2).map((notice) => `<button class="home-notice-row" data-action="notice-detail" data-value="${notice.id}" data-title="${escapeHtml(notice.title)}" data-text="${escapeHtml(notice.text)}"><span class="badge ${notice.tag === "이벤트" ? "orange" : ""}">${notice.tag}</span><span><strong>${escapeHtml(notice.title)}</strong><small>${escapeHtml(notice.date)}</small></span>${icon("chevron")}</button>`).join("")}</section>`;
}

function renderMobilityMap() {
  const destination = state.routeStops.at(-1) || "목적지를 선택해 주세요";
  const waypoints = state.routeStops.slice(1, -1).filter(Boolean);
  const pinName = state.pickupLocation.replace(/^(현재 위치 확인됨|현재 위치)\s*·\s*/, "");
  const longPinName = Array.from(pinName).length > 8;
  const startLabel = escapeHtml(pinName || "출발지");
  const waypointLabel = escapeHtml(waypoints[0] || "경유지");
  const destinationLabel = escapeHtml(destination);
  const notice = state.tripActive
    ? `${escapeHtml(destination)} 방면으로 이동 중 · 15분 남음`
    : state.locationReady ? "차량이 정차할 수 있는 안전한 승차 지점이에요." : "출발지를 확인하면 가까운 무인차를 찾을게요.";
  return `<section class="mobility-map" aria-label="${state.homeMode === "taxi" ? "택시" : "렌트"} 배차 지도"><img src="./assets/map-seoul.jpg" alt="서울시 도로와 한강이 표시된 이동 지도" /><svg class="map-route-line" viewBox="0 0 360 286" preserveAspectRatio="none" aria-hidden="true"><path d="M82 205 C132 148 165 178 198 125 S267 66 315 87" /></svg><div class="map-shade"></div><div class="map-mode-chip">${icon(state.homeMode === "taxi" ? "car" : "key")} ${state.homeMode === "taxi" ? "MOOV 택시" : "MOOV 렌트"}</div><button class="map-locate" data-action="locate-home" aria-label="현재 위치 찾기">${icon("pin")}</button><button class="map-user-pin" data-action="toggle-map-pin" aria-label="출발 핀 위치 이름 보기" aria-expanded="${state.mapPinOpen}">${icon("pin")}</button><span class="map-start-label">출발지</span><span class="map-marker-label start">${startLabel}</span>${waypoints.length ? `<span class="map-dot waypoint"></span><span class="map-stop-label waypoint">경유지</span><span class="map-marker-label waypoint">${waypointLabel}</span>` : ""}<span class="map-dot end"></span><span class="map-stop-label end">목적지</span><span class="map-marker-label end">${destinationLabel}</span><div class="map-pin-label ${state.mapPinOpen ? "show" : ""} ${longPinName ? "marquee" : ""}"><div>${`<span>${escapeHtml(pinName)}</span>${longPinName ? `<span aria-hidden="true">${escapeHtml(pinName)}</span>` : ""}`}</div></div><span class="map-car-marker">${icon("car")}<small>3분</small></span><div class="map-safety ${state.locationReady || state.tripActive ? "ready" : ""}">${icon(state.locationReady || state.tripActive ? "shield" : "pin")}<span>${notice}</span></div></section>`;
}

function renderRoutePlanner(route) {
  const destination = route ? route.name : state.routeStops.at(-1) || "목적지를 선택해 주세요";
  const waypoints = state.routeStops.slice(1, -1).filter(Boolean);
  const waypointRows = waypoints.map((stop, index) => `<button class="route-line waypoint" data-action="open-destination"><span class="route-mark"></span><span><small>경유지 ${index + 1}</small><strong>${escapeHtml(stop)}</strong></span>${icon("chevron")}</button>`).join("");
  return `<div class="route-planner"><button class="route-line pickup" data-action="open-pin-picker"><span class="route-mark"></span><span><small>출발지</small><strong>${escapeHtml(state.pickupLocation)}</strong></span><em>${state.locationReady ? "위치 확인됨" : "변경"}</em></button>${waypointRows}<button class="route-line destination" data-action="open-destination"><span class="route-mark"></span><span><small>목적지</small><strong>${escapeHtml(destination)}</strong></span>${icon("chevron")}</button></div><div class="route-tools"><button data-action="locate-home">${icon("pin")} 현재 위치</button><button data-action="choose-saved-course">${icon("bookmark")} 관심 코스</button><button data-action="browse-courses-home">${icon("compass")} 나들이 코스</button></div>`;
}

function renderActiveRoute(route) {
  const waypoints = state.routeStops.slice(1, -1).filter(Boolean).map((stop, index) => `<div class="active-route-line waypoint"><span class="route-mark"></span><div><small>경유지 ${index + 1}</small><strong>${escapeHtml(stop)}</strong></div></div>`).join("");
  return `<div class="active-route"><div class="active-route-line"><span class="route-mark"></span><div><small>현재 위치</small><strong>${escapeHtml(state.pickupLocation)}</strong></div></div>${waypoints}<div class="active-route-line destination"><span class="route-mark"></span><div><small>목적지</small><strong>${escapeHtml(route ? route.name : state.routeStops.at(-1))}</strong></div></div><div class="vehicle-health"><span>${icon("car")} MOOV 24</span><span>충전량 <strong>78%</strong></span><span>보안 점검 완료</span></div>${state.homeMode === "taxi" ? `<button class="primary-button full" data-action="request-taxi">실시간 이동 경로 보기</button><button class="ghost-button full" data-action="finish-trip">택시 이용 종료</button>` : `<button class="ghost-button full" data-action="finish-trip">렌트 종료 요청</button>`}</div>`;
}

function renderPickupCard() {
  return `<section class="card destination-box"><div class="row"><div><span class="small muted">출발 위치</span><strong class="location-value">${escapeHtml(state.pickupLocation)}</strong></div><span class="location-state ${state.locationReady ? "ready" : ""}">${state.locationReady ? "확인됨" : "확인 필요"}</span></div><div class="action-grid"><button class="secondary-button compact-button" data-action="locate-home">${icon("pin")} 현재 위치 찾기</button><button class="ghost-button compact-button" data-action="open-pin-picker">${icon("pin")} 지도에서 핀 선택</button></div></section>`;
}

function renderDestinationCard(route) {
  return `<section class="card search-panel"><div class="row"><div><span class="small muted">목적지 선택</span><h3 style="margin:4px 0">${route ? escapeHtml(route.name) : escapeHtml(state.routeStops.at(-1) || "목적지를 선택해 주세요")}</h3></div><button class="mini-action" data-action="open-destination">직접 설정</button></div>${state.routeStops.length ? `<div class="selected-route">${state.routeStops.map((stop, index) => `<div class="route-stop"><span class="route-number">${index + 1}</span><strong>${escapeHtml(stop)}</strong><span>${index === state.routeStops.length - 1 ? "목적지" : index === 0 ? "출발" : "경유"}</span></div>`).join("")}</div>` : ""}<div class="destination-actions"><button data-action="choose-saved-course">${icon("bookmark")}<span><strong>관심 코스</strong><small>저장한 전체 코스 가져오기</small></span></button><button data-action="browse-courses-home">${icon("compass")}<span><strong>나들이 코스</strong><small>AI 코스 추천에서 따라가기</small></span></button></div></section>`;
}

function renderUsageStatus() {
  const modeLabel = state.homeMode === "rent" ? "렌트" : "택시";
  const rent = state.homeMode === "rent";
  const detail = state.tripActive ? (rent ? "렌트 남은 시간" : "이동 이용시간") : "이용 대기 중";
  const timerAttr = rent ? "data-live-remaining" : "data-live-usage";
  const timerValue = state.tripActive ? (rent ? formatElapsed(getRentalRemaining()) : formatElapsed(Date.now() - (state.usageStartedAt || Date.now()))) : "00:00:00";
  return `<section class="usage-status ${state.tripActive ? "active" : ""}"><span class="usage-mode">${icon(rent ? "key" : "car")} ${modeLabel}</span><div><small>${detail}</small><strong ${timerAttr}>${timerValue}</strong></div><span class="live-indicator"><i></i>${state.tripActive ? "LIVE" : "READY"}</span></section>`;
}

function formatElapsed(milliseconds) {
  const seconds = Math.max(0, Math.floor((milliseconds || 0) / 1000));
  const hours = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const remain = String(seconds % 60).padStart(2, "0");
  return `${hours}:${minutes}:${remain}`;
}

function updateUsageTimer() {
  document.querySelectorAll("[data-live-usage]").forEach((timer) => {
    if (state.tripActive && state.usageStartedAt) timer.textContent = formatElapsed(Date.now() - state.usageStartedAt);
  });
  document.querySelectorAll("[data-live-remaining]").forEach((timer) => {
    if (state.tripActive && state.homeMode === "rent") timer.textContent = `${timer.dataset.prefix || ""}${formatElapsed(getRentalRemaining())}`;
  });
  document.querySelectorAll("[data-live-fee]").forEach((fee) => { fee.textContent = `${currentUsageFee().toLocaleString("ko-KR")}원`; });
  if (state.tripActive && state.homeMode === "rent" && state.rentalEndsAt && getRentalRemaining() <= 0) {
    if (!state.securityEnding) {
      state.securityEnding = true;
      openModal({ title: "렌트 시간이 종료됐어요", body: "<p>차량이 안전한 하차 지점에 정차했습니다. 신규 개인 입력과 외부 연결을 차단하고 차량 기록 정리를 자동으로 시작합니다.</p>", iconName: "shield", primary: "정리 준비 중", secondary: null });
      runSecureCleanup("rent");
    }
  }
}

function getRentalRemaining() {
  const endAt = state.rentalEndsAt || ((state.usageStartedAt || Date.now()) + state.rentalHours * 3600000);
  return Math.max(0, endAt - Date.now());
}

function taxiPanel() {
  const vehicle = rentalVehicles.find((item) => item.id === state.taxiVehicleType) || rentalVehicles[0];
  return `<div class="booking-summary taxi-summary"><div class="section-row"><strong>차량 종류</strong></div>${renderVehicleTypeSelector(state.taxiVehicleType, "taxi-vehicle")}<div class="vehicle-arrival"><span class="arrival-icon">${icon("car")}</span><span><small>가장 가까운 차량</small><strong>${escapeHtml(vehicle.name)} · 약 3분</strong></span><span class="battery-pill">충전량 78%</span></div><div class="fare-row"><span><small>예상 요금</small><strong>약 18,900원</strong></span><span><small>결제</small><strong>•••• 8421</strong></span></div><button class="primary-button full call-button" data-action="request-taxi">예약</button><p class="booking-caption">하차 후 이동 거리 기준으로 등록 카드에 자동 결제돼요.</p></div>`;
}

function rentalPanel() {
  const vehicle = rentalVehicles.find((item) => item.id === state.rentalVehicleType) || rentalVehicles[0];
  const optionPrice = rentalOptionCatalog.filter((item) => state.rentalOptions.has(item.id)).reduce((sum, item) => sum + item.price, 0);
  const price = state.rentalHours * vehicle.price + optionPrice;
  return `<div class="rent-config"><div class="section-row"><strong>차량 종류</strong></div>${renderVehicleTypeSelector(state.rentalVehicleType, "rental-vehicle")}<div class="rent-control-row"><div><small>이용 시간</small><strong>2~24시간</strong></div><div class="hour-control"><button data-action="rent-minus" aria-label="대여 시간 줄이기">−</button><strong>${state.rentalHours}시간</strong><button data-action="rent-plus" aria-label="대여 시간 늘리기">＋</button></div></div><div class="section-row option-heading"><strong>공간 옵션</strong><span>복수 선택</span></div><div class="rental-options">${rentalOptionCatalog.map((item) => `<button class="rental-option ${state.rentalOptions.has(item.id) ? "selected" : ""}" data-action="rental-option" data-value="${item.id}">${icon(state.rentalOptions.has(item.id) ? "bookmark" : "plus")}<span>${item.name}</span><strong>+${item.price.toLocaleString("ko-KR")}원</strong></button>`).join("")}</div><div class="rent-total"><span><small>총 예상 요금</small><strong>${price.toLocaleString("ko-KR")}원</strong></span><span>카드 •••• 8421</span></div><button class="primary-button full call-button" data-action="request-rent">예약</button><p class="booking-caption">충전 대기가 예상되면 동일 종류의 충전 완료 차량을 우선 배정해요.</p></div>`;
}

function renderVehicleTypeSelector(selectedId, actionName) {
  return `<div class="vehicle-type-list" data-drag-scroll>${rentalVehicles.map((item) => `<button class="vehicle-type ${selectedId === item.id ? "selected" : ""}" data-action="${actionName}" data-value="${item.id}" aria-pressed="${selectedId === item.id}"><img src="${item.image}" alt="${item.name}" /><span><strong>${item.name}</strong><small>${item.seats} · ${item.desc}</small><em>${item.price.toLocaleString("ko-KR")}원/시간</em></span></button>`).join("")}</div>`;
}

function openDestinationSearch() {
  openModal({
    title: "목적지 검색",
    iconName: "pin",
    body: `<p>목적지와 경유지를 직접 입력하거나 관심 코스 전체를 불러오세요.</p><div class="popup-form"><label class="form-label">출발지<input id="route-start" value="${escapeHtml(state.pickupLocation)}" /></label><label class="form-label">경유지<input id="route-waypoint" placeholder="선택 사항" value="${escapeHtml(state.routeStops.length > 2 ? state.routeStops[1] : "")}" /></label><label class="form-label">목적지<input id="route-end" value="${escapeHtml(state.routeStops.at(-1) || "")}" placeholder="목적지 입력" /></label><button class="secondary-button full" data-action="choose-saved-course">${icon("bookmark")} 관심 코스에서 선택</button><button class="ghost-button full" data-action="browse-courses-home">${icon("compass")} AI 코스 추천 열기</button></div>`,
    primary: "경로 등록",
    secondary: "취소",
    onConfirm: () => {
      const start = document.querySelector("#route-start")?.value.trim();
      const waypoint = document.querySelector("#route-waypoint")?.value.trim();
      const end = document.querySelector("#route-end")?.value.trim();
      if (!end) { toast("목적지를 입력해 주세요."); return false; }
      state.selectedCourse = null;
      state.pickupLocation = start || state.pickupLocation;
      state.routeStops = [start || "현재 위치", waypoint, end].filter(Boolean);
      persist(); render(); toast("목적지 경로를 등록했어요.");
    },
  });
}

function openMapPinPicker() {
  const places = ["성수역 3번 출구", "서울숲 남문", "뚝섬역 5번 출구", "내 위치 주변 승차구역"];
  openModal({ title: "지도에서 출발 위치 선택", iconName: "pin", body: `<p>지도를 움직여 위치를 놓거나 가까운 승차 지점을 선택하세요.</p><div class="pin-picker-map"><img src="./assets/map-seoul.jpg" alt="서울시 출발 위치 선택 지도" /><span class="center-pin">${icon("pin")}</span><span class="pin-picker-name">성수동 685-492</span></div><div class="popup-list">${places.map((place) => `<button class="history-route" data-action="map-pin-select" data-value="${place}"><span class="history-icon">${icon("pin")}</span><span><strong>${place}</strong><small>안전 승차 가능 지점</small></span>${icon("chevron")}</button>`).join("")}</div>`, primary: "이 위치 선택", secondary: "취소", onConfirm: () => { applyPickupLocation("성수동 685-492"); } });
}

function applyPickupLocation(label) {
  state.pickupLocation = label;
  state.locationReady = true;
  if (state.routeStops.length) state.routeStops[0] = label;
  else state.routeStops = [label];
  persist(); render();
}

function locateUser(source = "home") {
  const complete = () => {
    applyPickupLocation("현재 위치 확인됨 · 서울 성수동");
    if (source === "outing") { state.locationReady = true; state.outingSort = "nearby"; persist(); render(); }
    toast(source === "outing" ? "내 위치를 기준으로 가까운 코스를 정렬했어요." : "현재 위치를 출발지로 설정했어요.");
  };
  if (!navigator.geolocation) return complete();
  navigator.geolocation.getCurrentPosition(complete, () => openModal({ title: "위치 권한이 필요해요", iconName: "pin", body: "<p>기기의 위치 권한을 허용하면 가까운 코스와 안전한 승차 지점을 찾을 수 있어요. 지금은 성수동 기준 위치를 사용합니다.</p>", primary: "성수동 기준 사용", secondary: "취소", onConfirm: complete }), { enableHighAccuracy: true, timeout: 5000 });
}

function chooseSavedCourse() {
  const all = getInterestCourses();
  openModal({ title: "관심 코스 선택", iconName: "bookmark", body: all.length ? `<p>저장하거나 직접 등록한 코스의 전체 경로를 가져옵니다.</p><div class="popup-list">${all.map((course) => `<button class="history-route" data-action="select-home-course" data-value="${course.id}"><span class="history-icon">${icon("compass")}</span><span><strong>${escapeHtml(course.name)}</strong><small>${escapeHtml(course.time || `${course.stops.length}곳`)}</small></span>${icon("chevron")}</button>`).join("")}</div>` : emptyState("bookmark", "관심 코스가 없어요", "나들이에서 코스를 저장하거나 등록해 주세요."), primary: "닫기", secondary: null });
}

function renderAi() {
  const tabs = [["talk", "대화"], ["history", "대화 기록"], ["settings", "루나 설정"]];
  if (state.aiSub === "history") return `${subtabs(tabs, state.aiSub, "ai-sub")}${renderAiHistory()}`;
  if (state.aiSub === "settings") return `${subtabs(tabs, state.aiSub, "ai-sub")}${renderAiSettings()}`;
  const thread = currentThread();
  const listening = state.aiStatus === "listening";
  const off = state.aiStatus === "off";
  const persona = currentAiPersona();
  if (off) {
    return `${subtabs(tabs, state.aiSub, "ai-sub")}<section class="ai-off-stage card">
      <div class="ai-off-orb"><img src="${LUNA_BOT_IMAGE}" alt="" /></div>
      <h3>루나를 종료했어요</h3>
      <p>"알겠습니다. 대화 모드를 종료할게요." 다시 대화하고 싶을 때 언제든 시작할 수 있어요.</p>
      <button class="primary-button" type="button" data-action="ai-restart">루나 다시 시작</button>
    </section>`;
  }
  const recording = state.aiSaveEnabled;
  const voiceOn = state.aiVoiceEnabled;
  return `<div id="ai-live-block" class="luna-live ${state.aiChatExpanded ? "chat-expanded" : ""}">
    ${subtabs(tabs, state.aiSub, "ai-sub")}
    <div class="ai-cabin-wrap">
      <div class="ai-cabin-stage ${listening ? "listening" : ""}">
        <div class="ai-cabin-shade"></div>
        <div class="spatial-ai persona-${persona.id}">
          <img class="luna-bot-image" src="${persona.image}" alt="${persona.name} 캐릭터" />
        </div>
        <span class="ai-ring one"></span>
        <span class="ai-ring two"></span>
        <div class="ai-status-badges">
          ${recording ? `<span class="ai-status-badge recording"><i class="dot"></i>대화를 기록 중입니다</span>` : ""}
          ${voiceOn ? `<span class="ai-status-badge">음성 제어가 가능한 상태입니다</span>` : ""}
        </div>
        <div class="crisis-overlay ${state.aiCrisisOpen ? "open" : ""}">
          <div class="crisis-overlay-head">
            <div class="crisis-overlay-icon">${icon("shield")}</div>
            <div><h4>혼자 두지 않을게요</h4><p>지금 벅찬 감정, 괜찮다면 조금 더 이야기해줄래요? 필요하면 아래 번호로 언제든 연결할 수 있어요.</p></div>
            <button class="crisis-overlay-close" type="button" data-action="crisis-close" aria-label="위기 안내 닫기">${icon("x")}</button>
          </div>
          <div class="crisis-overlay-actions"><button class="crisis-call-button" type="button" data-action="crisis-call">${icon("shield")}자살예방상담전화 1393 연결</button></div>
        </div>
      </div>
      <button class="ai-persona-badge ${state.personaMenuOpen ? "open" : ""}" type="button" data-action="persona-menu" aria-label="페르소나 선택">
        <span>${persona.name}</span>${icon("chevron")}
      </button>
      <div class="ai-persona-dropdown ${state.personaMenuOpen ? "open" : ""}">
        ${aiPersonas.map(({ name, desc }) => `<button class="ai-persona-option ${state.aiPersona === name ? "selected" : ""}" type="button" data-action="persona" data-value="${name}"><strong>${name}</strong><small>${desc}</small></button>`).join("")}
      </div>
    </div>
    <div class="luna-chat-panel">
      <div class="luna-chat-log" id="main-chat-log">
        <div class="chat-font-size-control">
          <button type="button" data-action="font-size" data-value="-1" aria-label="채팅 글자 작게" ${state.chatFontScale <= 0.85 ? "disabled" : ""}>−</button>
          <button type="button" data-action="font-size" data-value="1" aria-label="채팅 글자 크게" ${state.chatFontScale >= 1.3 ? "disabled" : ""}>＋</button>
        </div>
        <button type="button" class="chat-expand-toggle" data-action="chat-expand" aria-label="${state.aiChatExpanded ? "채팅창 축소" : "채팅창 확대"}">${icon(state.aiChatExpanded ? "shrink" : "expand")}</button>
        <div class="chat-date-divider"><span>${new Date().toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" })}</span></div>
        ${thread.messages.map((m) => `<div class="detail-message-row ${m.role === "user" ? "user" : ""}"><div class="detail-message-bubble">${escapeHtml(m.text)}<small>${escapeHtml(m.time || "방금 전")}</small></div></div>`).join("")}
      </div>
      ${voiceOn ? `<div class="ai-mic-stage" id="ai-voice-stage">
        <div id="ai-voice-widget">
          ${!listening ? `<p class="ai-example-text"><strong>이런 걸 물어볼 수 있어요</strong>"요즘 운전하면서 듣기 좋은 얘기 없어?"</p>` : ""}
          <div class="voice-wave ${listening ? "active" : ""}" style="display:${listening ? "flex" : "none"};" aria-hidden="true">
            <i style="--wave:1"></i><i style="--wave:2"></i><i style="--wave:3"></i><i style="--wave:4"></i><i style="--wave:5"></i><i style="--wave:1"></i><i style="--wave:3"></i><i style="--wave:5"></i><i style="--wave:2"></i><i style="--wave:4"></i>
          </div>
          <button class="ai-main-control ai-mic-toggle ${listening ? "listening" : ""}" type="button" data-action="voice-toggle" aria-label="${listening ? "음성 입력 멈춤" : "음성 대화 시작"}">${icon("mic")}</button>
          <p class="ai-status-line ${listening ? "listening" : ""}">${listening ? "듣고 있어요" : "루나 대기 중"}</p>
        </div>
      </div>` : `<p class="ai-status-line" style="text-align:center; margin-top:10px;">텍스트로 말씀해 주세요</p>`}
      <form id="main-text-form" class="chat-input" style="grid-template-columns:1fr 44px; margin-top:${voiceOn ? "0" : "6px"};">
        <input id="main-text-input" autocomplete="off" placeholder="메시지를 입력하세요" aria-label="루나에게 메시지 입력" />
        <button class="send-button" type="submit" aria-label="메시지 보내기">${icon("send")}</button>
      </form>
    </div>
  </div>`;
}

// 진행 중인(라이브) 대화 스레드 — 대화 기록 저장 동의 여부와 무관하게 항상 존재/유지됨.
function currentThread() {
  if (!state.liveThread) {
    state.liveThread = { messages: [{ role: "ai", text: "안녕하세요! 이동 중에 저와 얘기하고 싶으시면 언제든 \"루나야\"라고 불러주세요.", time: "방금 전" }] };
  }
  return state.liveThread;
}

// 대화 기록 저장이 켜져 있는 동안에만 사용되는 "저장된 세션" — liveSessionKey가 바뀔 때마다(저장을 새로 켤 때마다) 새 항목으로 시작됨.
function getOrCreateSavedSession() {
  let session = state.chatThreads.find((item) => item.sessionKey === state.liveSessionKey);
  if (!session) {
    session = { id: `thread-${Date.now()}`, sessionKey: state.liveSessionKey, title: "새 대화", updated: "방금 전", persona: state.aiPersona, messages: [] };
    state.chatThreads.unshift(session);
  }
  return session;
}

function renderAiHistory() {
  if (state.aiHistoryDetailId) return renderAiHistoryDetail();
  return `<section class="section-lead"><h3>대화 기록</h3><p>저장에 동의한 대화만 여기 남아요. 카드의 휴지통 아이콘으로 원하는 기록만 골라 지울 수 있어요.</p></section>${state.chatThreads.length ? `<section class="card">${state.chatThreads.map((thread) => `<div class="history-item deletable" data-action="open-thread-detail" data-value="${thread.id}" role="button" tabindex="0"><span class="history-icon">${icon("chat")}</span><span><strong>${escapeHtml(thread.title)}</strong><small>${escapeHtml(thread.updated)} · ${escapeHtml(thread.messages.length)}개 메시지</small></span><span class="badge gray">${escapeHtml(thread.persona)}</span><button class="history-delete" type="button" data-action="delete-thread" data-value="${thread.id}" aria-label="삭제">${icon("trash")}</button></div>`).join("")}</section>` : emptyState("chat", "아직 저장된 대화가 없어요", "설정에서 대화 기록 저장을 켜면 다음 대화부터 여기 남길 수 있어요.")}`;
}

function renderAiHistoryDetail() {
  const thread = state.chatThreads.find((item) => item.id === state.aiHistoryDetailId);
  if (!thread) { state.aiHistoryDetailId = null; return renderAiHistory(); }
  return `<div class="thread-detail-head"><button class="back-button" type="button" data-action="close-thread-detail" aria-label="목록으로">${icon("back")}</button><div><strong>${escapeHtml(thread.title)}</strong><small>${escapeHtml(thread.updated)}</small></div><button class="header-delete" type="button" data-action="delete-thread" data-value="${thread.id}" aria-label="삭제">${icon("trash")}</button></div><div class="policy-note">위기 감지 관련 대화는 이 기록에 포함되지 않아요.</div><div class="luna-chat-log static-log">${thread.messages.map((m) => `<div class="detail-message-row ${m.role === "user" ? "user" : ""}"><div class="detail-message-bubble">${escapeHtml(m.text)}<small>${escapeHtml(m.time || "")}</small></div></div>`).join("")}</div>`;
}

function renderAiSettings() {
  return `<p class="settings-group-label">대화 방식</p><section class="card">${toggleItem("루나", "끄면 루나 전체 기능이 종료돼요. \"그만 대화하고 싶어\"라고 말해도 동일하게 꺼져요.", state.aiStatus !== "off", "ai-power", "luna-bot")}<div class="menu-item settings-sub-item">${toggleItemInner("음성으로 대화하기", "기본적으로 루나 on/off와 같이 움직여요. 필요하면 이것만 따로 켜고 끌 수 있어요.", state.aiVoiceEnabled, "ai-voice-setting")}</div></section><p class="settings-group-label" style="margin-top:18px;">이용 설정</p><section class="card">${toggleItem("승차 후 자동 시작", "차량 탑승이 확인되면 먼저 인사해요. 인사말에서 \"루나야\"라고 부르면 언제든 대화를 시작할 수 있다고 안내해요.", state.aiAutoStart, "ai-autostart-setting")}${toggleItem("대화 기록 저장", "동의해야만 대화 내용이 남아요 (기본 꺼짐)", state.aiSaveEnabled, "ai-save-setting")}</section>`;
}

function sendMessage(text, voice = false) {
  const clean = text.trim();
  if (!clean) return;
  const now = () => new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
  const thread = currentThread();
  thread.messages.push({ role: "user", text: clean, time: now() });
  if (checkCrisisKeywords(clean)) state.aiCrisisOpen = true;
  const reply = voice ? "음성 내용을 확인했어요. 원하시면 관련 장소를 목적지나 나들이 코스로 이어드릴게요." : pickLunaReply(clean);
  thread.messages.push({ role: "ai", text: reply, time: now() });
  // 대화 기록 저장에 동의한 경우에만 별도의 저장 세션에도 같은 내용을 반영한다.
  if (state.aiSaveEnabled) {
    const session = getOrCreateSavedSession();
    session.messages.push({ role: "user", text: clean, time: now() });
    session.messages.push({ role: "ai", text: reply, time: now() });
    session.title = clean.slice(0, 18) || session.title;
    session.updated = "방금 전";
    session.persona = state.aiPersona;
    state.chatThreads = [session, ...state.chatThreads.filter((item) => item.id !== session.id)];
  }
  persist(); render();
  speakReply(reply);
}

function pickLunaReply(text) {
  if (state.aiPersona === "토닥이") return "많이 힘드셨겠어요. 천천히 이야기해주셔도 괜찮아요. 제가 옆에서 같이 들어볼게요.";
  if (state.aiPersona === "척척박사") return "제가 아는 선에서 정리해드릴게요. 이동 중이라면 핵심부터 짧게 안내할게요.";
  if (state.aiPersona === "링고") return "주변에 관심 있는 곳이 있는지 한번 찾아볼게요. 말해주신 표현도 자연스럽게 다듬어드릴 수 있어요.";
  return `좋아요. “${text.slice(0, 18)}${text.length > 18 ? "…" : ""}” 이야기부터 편하게 이어가 볼게요.`;
}

// 기획서 원안(말동무_html.html)의 위기 키워드 목록 그대로 복원 — 띄어쓰기 유무 변형까지 포함.
function checkCrisisKeywords(text) {
  return ["우울해", "우울하", "죽고싶", "죽고 싶", "살기싫", "살기 싫", "힘들어 죽겠", "자살"].some((keyword) => text.includes(keyword));
}

function scrollChat() {
  const box = document.querySelector(".luna-chat-log") || document.querySelector("#chat-window");
  if (box) box.scrollTop = box.scrollHeight;
}

function speakReply(text) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ko-KR";
  utterance.rate = 1;
  window.speechSynthesis.speak(utterance);
}

function startVoiceConversation() {
  if (!state.aiVoiceEnabled) {
    toast("음성 대화가 꺼져 있어요. 설정에서 다시 켤 수 있어요.");
    return;
  }
  // 기획서 B-11 정책: 마이크를 누르면 즉시 듣는 중 상태(빨간 버튼 + 파형)로 전환한다.
  // 실제 브라우저 음성 인식 성공 여부와 무관하게 UI 상태를 먼저 반영한다(원본 목업과 동일).
  state.aiStatus = "listening";
  render();

  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    toast("이 브라우저는 음성 인식을 지원하지 않아요. 화면은 데모로 표시돼요.");
    return;
  }
  if (speechRecognition) speechRecognition.abort();
  speechRecognition = new Recognition();
  speechRecognition.lang = "ko-KR";
  speechRecognition.interimResults = false;
  speechRecognition.continuous = false;
  // 무음 임계값: Azure Speech SDK 연동 시 SegmentationSilenceTimeoutMs를 800ms로 설정 (정책 B-11).
  // 브라우저 내장 SpeechRecognition은 이 값을 직접 노출하지 않아 브라우저 기본 동작을 따름.
  speechRecognition.onresult = (event) => {
    const transcript = event.results?.[0]?.[0]?.transcript || "";
    state.aiStatus = "idle";
    if (transcript) sendMessage(transcript, true);
  };
  speechRecognition.onerror = () => {
    state.aiStatus = "idle";
    render();
    toast("음성을 확인하지 못했어요. 다시 말하거나 텍스트로 입력해 주세요.");
  };
  speechRecognition.onend = () => {
    if (state.aiStatus === "listening") { state.aiStatus = "idle"; render(); }
  };
  try {
    speechRecognition.start();
  } catch {
    toast("마이크 권한을 확인할 수 없어 데모로 표시돼요. 텍스트로도 대화할 수 있어요.");
  }
}

function stopVoiceConversation(status = "idle") {
  if (speechRecognition) { speechRecognition.abort(); speechRecognition = null; }
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  state.aiStatus = status;
  render();
}

function applyChatFontScale() {
  document.documentElement.style.setProperty("--chat-font-scale", state.chatFontScale);
}

function openAiSaveConsent() {
  openModal({
    title: "대화를 저장할까요?",
    iconName: "bookmark",
    body: `<p>대화 내용, 사용한 루나 모드, 대화 시각이 저장돼요. 다음 승차에서 이어서 대화할 수 있어요.</p><p style="margin-top:10px">"저장해줘"라고 말해도 동일하게 처리돼요.</p>`,
    primary: "저장할게요",
    secondary: "지금은 안 할게요",
    onConfirm: () => {
      state.aiSaveEnabled = true;
      state.liveSessionKey = Date.now(); // 지금부터 이어지는 대화만 새 기록으로 남긴다.
      persist(); render(); toast("대화 기록 저장을 켰어요.");
    },
  });
}

function openDeleteThreadConfirm(threadId) {
  openModal({
    title: "이 대화를 삭제할까요?",
    iconName: "trash",
    body: `<p>삭제하면 되돌릴 수 없어요.</p>`,
    primary: "삭제할게요",
    secondary: "취소",
    onConfirm: () => {
      state.chatThreads = state.chatThreads.filter((item) => item.id !== threadId);
      if (state.aiHistoryDetailId === threadId) state.aiHistoryDetailId = null;
      if (state.activeThreadId === threadId) state.activeThreadId = null;
      persist(); render(); toast("대화 기록을 삭제했어요.");
    },
  });
}

function notifyRideEndSaveStatus() {
  if (!state.chatThreads.length) return;
  toast(state.aiSaveEnabled ? "이번 대화는 저장됐어요. 대화 기록에서 확인할 수 있어요." : "이번 대화는 저장되지 않아 하차와 함께 사라져요.");
}

function renderSpace() {
  const tabs = [["purchase", "상품 구매"], ["ott", "OTT"]];
  return `${subtabs(tabs, state.spaceSub, "space-sub")}${state.spaceSub === "purchase" ? renderPurchase() : renderOtt()}`;
}

function renderPurchase() {
  const tabs = [["search", "상품 찾기"], ["cart", "장바구니"], ["orders", "구매 내역"], ["favorites", "관심 목록"]];
  const bodies = { search: renderProducts, cart: renderCart, orders: renderOrders, favorites: renderFavoriteProducts };
  if (!bodies[state.purchaseSub]) state.purchaseSub = "search";
  return `<div class="subtabs purchase-tabs" role="tablist">${tabs.map(([id, label]) => `<button class="${state.purchaseSub === id ? "active" : ""}" data-action="purchase-sub" data-value="${id}"><span>${label}</span>${id === "cart" && cartCount() ? `<em class="cart-dot">${Math.min(cartCount(), 99)}</em>` : ""}</button>`).join("")}</div>${bodies[state.purchaseSub]()}`;
}

function renderProducts() {
  const query = normalizeSearch(state.productQuery);
  const rankedProductIds = query ? new Set(policyRankCandidates(query, productSearchCandidates(), products.length).map((item) => item.itemId)) : null;
  const list = products.filter((product) => {
    const categoryMatch = state.productCategory === "전체" || (state.productCategory === "추천" ? product.recommended : product.category === state.productCategory);
    return categoryMatch && (!rankedProductIds || rankedProductIds.has(product.id));
  }).sort((a, b) => query ? (b.stock || 0) - (a.stock || 0) || Number(b.recommended) - Number(a.recommended) || a.name.localeCompare(b.name, "ko-KR") : 0);
  const categories = [["전체", "전체 메뉴"], ["추천", "추천 상품"], ["음료·간식", "음료·간식"], ["식사", "식사"], ["편의용품", "편의용품"]];
  return `<section class="card shop-banner"><span class="badge">현재 차량 재고</span><h3>이동 중 바로 먹고 사용할 수 있어요</h3><p>결제 완료 후 지정 수납함이 자동으로 열립니다.</p></section>${renderSearchField({ inputId: "product-search", stateKey: "productQuery", className: "product-search", placeholder: "상품명을 입력하세요", label: "상품 검색" })}<div class="category-row compact" style="margin:12px 0">${categories.map(([id, label]) => `<button class="category-card ${state.productCategory === id ? "active" : ""}" data-action="product-category" data-value="${id}">${label}</button>`).join("")}</div>${list.length ? `<div class="product-grid">${list.map(productCard).join("")}</div>` : emptyState("search", "검색 결과가 없어요", "앞글자가 일치하는 다른 상품명으로 찾아보세요.")}`;
}

function productCard(product) {
  const liked = state.productLikes.has(product.id);
  return `<article class="card product-card"><button class="product-thumb" data-action="product-detail" data-value="${product.id}" aria-label="${escapeHtml(product.name)} 상세 보기"><img src="${product.image}" alt="${escapeHtml(product.name)} 상품 사진" /></button><div class="row product-labels"><span class="stock-label ${product.stock ? "" : "soldout"}">${product.stock ? `차량 재고 ${product.stock}` : "현재 차량 품절"}</span><button class="heart-button ${liked ? "active" : ""}" data-action="like-product" data-value="${product.id}" aria-label="관심 상품 저장">${icon("heart")}</button></div><h4>${escapeHtml(product.name)}</h4><p>${escapeHtml(product.desc)}</p><button class="add-wide-button" data-action="add-product" data-value="${product.id}" aria-label="${escapeHtml(product.name)} 담기" ${product.stock ? "" : "disabled"}>${product.stock ? `${icon("bag")} 담기` : "품절"}</button></article>`;
}

function openProductDetail(product, resetQuantity = true, compact = false) {
  if (resetQuantity) state.productDetailQty = state.cart.find((line) => line.id === product.id)?.qty || 1;
  state.productDetailMode = compact ? "compact" : "detail";
  const qty = Math.min(product.stock || 1, Math.max(1, state.productDetailQty || 1));
  state.productDetailQty = qty;
  const total = (product.price * qty).toLocaleString("ko-KR");
  const compactBody = `<div class="product-add-sheet"><img src="${product.image}" alt="${escapeHtml(product.name)} 상품 사진" /><div><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(product.desc)}</small><em>${product.price.toLocaleString("ko-KR")}원</em></div></div><div class="product-detail-purchase single"><div><small>수량</small><div class="quantity detail-quantity"><button data-action="detail-qty-minus" data-value="${product.id}" aria-label="수량 줄이기">−</button><strong>${qty}</strong><button data-action="detail-qty-plus" data-value="${product.id}" aria-label="수량 늘리기">＋</button></div></div><div><small>담을 금액</small><strong>${total}원</strong></div></div>`;
  const detailBody = `<div class="product-detail-image"><img src="${product.image}" alt="${escapeHtml(product.name)} 확대 이미지" /></div><p>${escapeHtml(product.desc)}<br />${product.stock ? `${escapeHtml(product.location)}에 ${product.stock}개 남아 있어 바로 구매할 수 있습니다.` : "현재 이용 중인 차량에는 재고가 없습니다."}</p>${product.stock ? `<div class="product-detail-purchase"><div><small>수량</small><div class="quantity detail-quantity"><button data-action="detail-qty-minus" data-value="${product.id}" aria-label="수량 줄이기">−</button><strong>${qty}</strong><button data-action="detail-qty-plus" data-value="${product.id}" aria-label="수량 늘리기">＋</button></div></div><div><small>담을 금액</small><strong>${total}원</strong></div></div>` : ""}`;
  openModal({
    title: compact ? "상품 담기" : product.name,
    iconName: "bag",
    body: product.stock ? (state.productDetailMode === "compact" ? compactBody : detailBody) : detailBody,
    primary: product.stock ? "담기" : "관심 목록에 저장",
    secondary: "닫기",
    onConfirm: () => product.stock ? setCartQuantity(product.id, qty) : (state.productLikes.add(product.id), persist(), render(), toast("관심 목록에 저장했어요.")),
  });
}

function cartCount() { return state.cart.reduce((sum, item) => sum + item.qty, 0); }

function renderCart() {
  const items = state.cart.map((line) => ({ ...line, product: products.find((p) => p.id === line.id) })).filter((line) => line.product);
  const total = items.reduce((sum, line) => sum + line.product.price * line.qty, 0);
  if (!items.length) return emptyState("bag", "장바구니가 비어 있어요", "상품 찾기에서 원하는 상품을 담아보세요.");
  return `<section class="section-lead"><h3>장바구니</h3><p>결제 후 좌석 옆 수납함이 자동으로 열립니다.</p></section><section class="card padded">${items.map((line) => `<div class="cart-item"><button class="cart-remove" data-action="cart-remove" data-value="${line.id}" aria-label="${escapeHtml(line.product.name)} 삭제">${icon("x")}</button><img src="${line.product.image}" alt="${line.product.name}" /><div><strong>${line.product.name}</strong><div class="small muted">${line.product.price.toLocaleString("ko-KR")}원</div></div><div class="quantity"><button data-action="cart-minus" data-value="${line.id}">−</button><strong>${line.qty}</strong><button data-action="cart-plus" data-value="${line.id}">＋</button></div></div>`).join("")}<div class="row" style="margin-top:15px"><span>총 결제금액</span><strong class="price-main">${total.toLocaleString("ko-KR")}원</strong></div><button class="primary-button full" style="margin-top:15px" data-action="checkout">등록 카드로 결제</button></section>`;
}

function renderOrders() {
  if (!state.orders.length) return `<section class="section-lead"><h3>구매 내역</h3><p>결제한 상품과 전자 영수증을 확인하세요.</p></section>${emptyState("bag", "아직 구매 내역이 없어요", "장바구니에서 결제를 완료하면 이곳에 자동으로 저장됩니다.")}`;
  return `<section class="section-lead"><h3>구매 내역</h3><p>항목을 선택하면 상품, 결제수단과 수령 위치를 확인할 수 있어요.</p></section><section class="card order-list">${state.orders.map((order) => `<button class="order-row" data-action="order-detail" data-value="${order.id}"><span class="history-icon">${icon("bag")}</span><span><strong>${escapeHtml(order.items[0].name)}${order.items.length > 1 ? ` 외 ${order.items.length - 1}건` : ""}</strong><small>${formatOrderDate(order.createdAt)} · ${order.total.toLocaleString("ko-KR")}원 · ${order.status}</small></span>${icon("chevron")}</button>`).join("")}</section>`;
}

function renderFavoriteProducts() {
  const liked = products.filter((product) => state.productLikes.has(product.id));
  return `<section class="section-lead"><h3>관심 목록</h3><p>하트를 누른 상품입니다. 현재 차량에 재고가 있으면 바로 구매할 수 있어요.</p></section>${liked.length ? `<div class="product-grid">${liked.map(productCard).join("")}</div>` : emptyState("heart", "관심 상품이 없어요", "상품 찾기에서 하트를 눌러 저장해 보세요.")}`;
}

function formatOrderDate(value) {
  return new Date(value).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function openOrderDetail(id) {
  const order = state.orders.find((item) => item.id === id);
  if (!order) return;
  const itemRows = order.items.map((item) => `<div class="receipt-line"><span>${escapeHtml(item.name)} × ${item.qty}</span><strong>${(item.price * item.qty).toLocaleString("ko-KR")}원</strong></div>`).join("");
  openModal({ title: "구매 내역 상세", iconName: "bag", body: `<div class="receipt"><div class="row"><span class="badge">${order.status}</span><small class="muted">주문번호 ${escapeHtml(order.id.slice(-8))}</small></div><div class="receipt-items">${itemRows}</div><div class="receipt-line total"><span>총 결제금액</span><strong>${order.total.toLocaleString("ko-KR")}원</strong></div><div class="receipt-info"><span>결제수단</span><strong>${escapeHtml(order.card)}</strong><span>수령 위치</span><strong>${escapeHtml(order.pickup)}</strong><span>결제 일시</span><strong>${formatOrderDate(order.createdAt)}</strong></div></div>`, primary: "전자 영수증 확인", secondary: "닫기", onConfirm: () => toast("전자 영수증을 확인했어요.") });
}

function completeCheckout() {
  const lines = state.cart.map((line) => ({ ...line, product: products.find((product) => product.id === line.id) })).filter((line) => line.product);
  if (!lines.length) return false;
  const items = lines.map((line) => ({ id: line.id, name: line.product.name, price: line.product.price, qty: line.qty }));
  const total = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const paymentCard = state.paymentCards.find((card) => card.primary) || state.paymentCards[0];
  state.orders.unshift({ id: `MOOV-${Date.now()}`, createdAt: new Date().toISOString(), items, total, status: "수령 완료", card: paymentCard ? `${paymentCard.name} ${paymentCard.number}` : "등록 카드", pickup: "좌석 오른쪽 B-02 수납함" });
  state.cart = [];
  state.purchaseSub = "orders";
  persist();
  render();
  toast("결제 상품을 구매 내역에 저장했어요.");
}

function renderOtt() {
  return `<section class="section-lead"><h3>차량 디스플레이로 이어보기</h3><p>하차 시 계정 토큰과 시청 기록을 차량에서 자동 삭제합니다.</p></section><div class="stack">${serviceCard("N", "넷플릭스", "원격 인포테인먼트 연결", "red", true)}${serviceCard("W", "웨이브", "로그인 후 바로 시청", "blue", false)}${serviceCard("M", "MOOV 뮤직", "드라이브 플레이리스트", "", true)}</div><section class="card padded" style="margin-top:13px"><div class="row"><div><span class="badge">이어 보기</span><h4 style="margin:8px 0 4px">도시의 밤 · 28분 남음</h4><p class="small muted">차량 디스플레이 연결됨</p></div><button class="icon-button" data-action="play-ott">${icon("play")}</button></div></section>`;
}

function serviceCard(letter, name, desc, color, on) { return `<article class="card service-card"><span class="service-logo ${color}">${letter}</span><div style="flex:1"><h4>${name}</h4><p>${desc}</p></div><button class="switch ${on ? "on" : ""}" data-action="toggle" aria-label="${name} 연결"></button></article>`; }

function renderOuting() {
  const tabs = [["recommend", "AI 코스 추천"], ["register", "코스 등록"], ["interest", "관심 코스"]];
  const bodies = { recommend: renderRecommendation, register: renderRegisterCourse, interest: renderInterestCourses };
  if (!bodies[state.outingSub]) state.outingSub = "recommend";
  const searchZone = state.outingSub === "recommend" ? renderOutingSearchZone() : "";
  return `${searchZone}<div class="subtabs outing-tabs" role="tablist">${tabs.map(([id, label]) => `<button class="${state.outingSub === id ? "active" : ""}" data-action="outing-sub" data-value="${id}">${label}</button>`).join("")}</div>${bodies[state.outingSub]()}`;
}

function renderOutingSearchZone() {
  return `<section class="outing-search-zone">${renderSearchField({ inputId: "course-search", stateKey: "outingQuery", className: "course-search", placeholder: "지역명, 음식점, 카페를 입력하세요", label: "코스 검색" })}<div class="outing-search-actions"><button class="mini-action" data-action="locate-outing">${icon("pin")} ${state.locationReady ? "내 위치 다시 찾기" : "내 위치 찾기"}</button><button class="mini-action ${state.outingMapOpen ? "active" : ""}" data-action="toggle-outing-map">${icon("compass")} 지도로 보기</button></div></section>`;
}

function renderOutingMap() {
  const courses = getFilteredOutingCourses().slice(0, 12);
  return `<section class="outing-map-shell">
    ${renderOutingFilterBar(courses.length)}
    <section class="card outing-map-card">
      <div id="outing-osm-map" class="outing-osm-map" role="application" aria-label="나들이 코스 지도"></div>
      <div class="outing-map-toolbar">
        <button class="mini-action" data-action="outing-map-reset">${icon("pin")} 지도 초기화</button>
        <a class="mini-action" href="https://www.openstreetmap.org/#map=12/37.5421/126.9360" target="_blank" rel="noreferrer">OSM 열기</a>
      </div>
    </section>
    <section class="card map-data-panel">
      <div class="section-row"><strong>필터 결과</strong><span class="small muted">${courses.length}개 코스</span></div>
      ${courses.length ? courses.map((course) => `<button class="map-data-row" data-action="map-course-focus" data-value="${course.id}"><span class="history-icon">${icon("pin")}</span><span><strong>${escapeHtml(course.name)}</strong><small>${escapeHtml(getCourseTags(course).category.join(" · "))} · ${escapeHtml(course.stops.join(" · "))}</small></span>${icon("chevron")}</button>`).join("") : emptyState("search", "조건에 맞는 코스가 없어요", "필터를 넓히거나 예산 범위를 올려 보세요.")}
    </section>
  </section>`;
}

function getCourseTags(course) {
  const fallback = { category: ["관광"], mood: ["감성"], companion: ["친구"], purpose: ["휴식"], time: ["오후"], price: 30000 };
  return courseTagProfiles[course.id] || course.tagProfile || fallback;
}

function getFilteredOutingCourses() {
  const query = normalizeSearch(state.outingQuery);
  return [...baseCourses, ...state.customCourses].filter((course) => {
    if (query && !courseMatchesQuery(course, query)) return false;
    const tags = getCourseTags(course);
    return outingFilterConfig.every(({ key }) => {
      const selected = state.outingFilters?.[key] || "전체";
      if (selected === "전체") return true;
      return (tags[key] || []).includes(selected);
    }) && Number(tags.price || 0) <= Number(state.outingFilters?.budget || 70000);
  });
}

function renderOutingFilterBar(count) {
  const budget = Number(state.outingFilters?.budget || 70000);
  return `<section class="card outing-filter-card">
    <div class="section-row"><strong>취향 필터</strong><span class="small muted">${count}개 결과</span></div>
    ${outingFilterConfig.map(({ key, label, values }) => `<div class="map-filter-group"><h4>${label}</h4><div class="filter-chips">${values.map((value) => `<button class="${(state.outingFilters?.[key] || "전체") === value ? "selected" : ""}" data-action="outing-filter" data-filter="${key}" data-value="${value}">${value}</button>`).join("")}</div></div>`).join("")}
    <div class="map-filter-group budget-filter"><div class="row"><h4>예산</h4><strong>${budget.toLocaleString("ko-KR")}원 이하</strong></div><input type="range" min="10000" max="100000" step="5000" value="${budget}" data-action="outing-budget" aria-label="코스 예산" /></div>
  </section>`;
}

function getCourseMapPoints(course, courseIndex = 0) {
  const seed = course.id.split("").reduce((sum, char) => sum + char.charCodeAt(0), courseIndex * 17);
  const baseLat = 37.5421 + ((seed % 9) - 4) * 0.006;
  const baseLng = 126.9360 + (((seed / 7) % 11) - 5) * 0.009;
  return course.stops.map((stop, index) => ({
    name: stop,
    lat: baseLat + index * 0.006 + Math.sin(seed + index) * 0.002,
    lng: baseLng + index * 0.009 + Math.cos(seed + index) * 0.003,
  }));
}

function initOutingMap(focusCourseId = null) {
  const el = document.querySelector("#outing-osm-map");
  if (!el || !window.L) return;
  const center = [37.5421, 126.9360];
  if (!outingLeafletMap || outingLeafletMap._container !== el) {
    outingLeafletMap = L.map(el, { zoomControl: true, attributionControl: true }).setView(center, 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(outingLeafletMap);
  } else {
    setTimeout(() => outingLeafletMap.invalidateSize(), 0);
  }
  if (outingLeafletLayer) outingLeafletLayer.remove();
  outingLeafletLayer = L.layerGroup().addTo(outingLeafletMap);
  const courses = getFilteredOutingCourses().slice(0, 12);
  const bounds = [];
  courses.forEach((course, courseIndex) => {
    const points = getCourseMapPoints(course, courseIndex);
    const latLngs = points.map((point) => [point.lat, point.lng]);
    const selected = focusCourseId === course.id;
    L.polyline(latLngs, { color: selected ? "#111111" : "#53B175", weight: selected ? 5 : 3, opacity: selected ? 0.9 : 0.55 }).addTo(outingLeafletLayer);
    points.forEach((point, index) => {
      const marker = L.circleMarker([point.lat, point.lng], {
        radius: selected ? 7 : 5,
        color: "white",
        weight: 2,
        fillColor: index === points.length - 1 ? "#E88D2A" : "#53B175",
        fillOpacity: 1,
      }).addTo(outingLeafletLayer);
      marker.bindPopup(`<strong>${escapeHtml(course.name)}</strong><br>${escapeHtml(index + 1)}. ${escapeHtml(point.name)}`);
      bounds.push([point.lat, point.lng]);
    });
  });
  if (focusCourseId) {
    const course = courses.find((item) => item.id === focusCourseId);
    if (course) outingLeafletMap.fitBounds(getCourseMapPoints(course).map((point) => [point.lat, point.lng]), { padding: [30, 30] });
  } else if (bounds.length) {
    outingLeafletMap.fitBounds(bounds, { padding: [24, 24] });
  }
}

function renderCourseBrowse() {
  const query = normalizeSearch(state.outingQuery);
  const filtered = baseCourses.filter((course) => courseMatchesQuery(course, query));
  const list = [...filtered].sort((a, b) => state.outingSort === "latest" ? b.createdAt.localeCompare(a.createdAt) : state.outingSort === "nearby" ? a.distance - b.distance : b.likes - a.likes);
  const sorts = [["popular", "인기순"], ["latest", "최신순"], ["nearby", "가까운 순"]];
  return `${state.outingMapOpen ? renderOutingMap() : ""}<div class="filter-chips course-sort" style="margin-top:10px">${sorts.map(([id, label]) => `<button class="${state.outingSort === id ? "selected" : ""}" data-action="course-sort" data-value="${id}">${label}</button>`).join("")}</div><div class="course-result-count">총 ${list.length}개 코스</div>${list.length ? `<div class="stack">${list.map(courseCard).join("")}</div>` : emptyState("search", "검색 결과가 없어요", "앞글자가 일치하는 다른 지역이나 장소로 검색해 보세요.")}`;
}

function courseCard(course) {
  const savedCourse = state.savedCourseIds.has(course.id);
  const likedCourse = state.likedCourseIds.has(course.id);
  const visual = course.image ? `<button class="course-visual" data-action="course-detail" data-value="${course.id}" aria-label="${escapeHtml(course.name)} 상세 보기"><img src="${course.image}" alt="${escapeHtml(course.name)} 코스 이미지" /><span class="photo-detail-hint">${icon("search")} 상세 보기</span></button>` : `<button class="course-visual no-image" data-action="course-detail" data-value="${course.id}">${icon("image")}<span class="small">장소 이미지 없음</span></button>`;
  const stopPhotos = course.stopDetails ? `<div class="registered-stops">${course.stopDetails.map((stop) => `<div>${stop.photo ? `<img src="${stop.photo}" alt="${escapeHtml(stop.name)} 사진" />` : `<span class="no-stop-photo">${icon("image")}</span>`}<small>${escapeHtml(stop.type)} · ${escapeHtml(stop.name)}</small></div>`).join("")}</div>` : "";
  return `<article class="course-card">${visual}<div class="course-body"><div class="row"><span class="small muted">${escapeHtml(course.author || state.username)}님의 코스 · ${Number(course.distance || 0).toLocaleString("ko-KR")}km</span><span class="badge orange">${escapeHtml(course.time || `${course.stops.length}곳`)}</span></div><h4>${escapeHtml(course.name)}</h4><p>${escapeHtml(course.desc)}</p>${stopPhotos}<div class="course-stats"><span>${icon("heart")} ${(course.likes || 0) + (likedCourse ? 1 : 0)}</span><span>${icon("chat")} ${Math.max(12, Math.round((course.likes || 100) / 9))}</span><span>${icon("compass")} ${course.stops.length}개 장소</span></div><div class="course-actions"><button class="${likedCourse ? "liked" : ""}" data-action="course-like" data-value="${course.id}">${icon("heart")}<span>${likedCourse ? "좋아요 취소" : "좋아요"}</span></button><button class="${savedCourse ? "saved" : ""}" data-action="course-save" data-value="${course.id}">${icon("bookmark")}<span>${savedCourse ? "저장됨" : "관심 저장"}</span></button><button class="follow" data-action="follow-course" data-value="${course.id}">${icon("pin")}<span>따라가기</span></button></div></div></article>`;
}

function getCourseStopRole(index, count) {
  if (index === 0) return "출발지";
  if (index === count - 1) return "목적지";
  return `경유지 ${index}`;
}

function getCourseStopImage(course, stop, index) {
  const uploaded = course.stopDetails?.[index]?.photo;
  if (uploaded) return uploaded;
  const imageByPlace = [
    [/서울숲|가족마당|성수|카페|로스터리|대림창고|어니언/, "./assets/course-cafe.jpg"],
    [/뚝섬|반포|한강|달빛광장/, "./assets/course-hangang-sunset.jpg"],
    [/야구장|잠실새내/, "./assets/course-baseball.jpg"],
    [/재즈|이태원|한남동|경리단/, "./assets/course-jazz.jpg"],
    [/캠핑|난지|망원시장/, "./assets/course-camping.jpg"],
    [/북악|팔각정|부암동/, "./assets/course-bugak.jpg"],
    [/인사동|익선동|쌈지길|한옥/, "./assets/course-insadong.jpg"],
    [/이천|도자|설봉/, "./assets/course-pottery.jpg"],
    [/석촌|송리단길/, "./assets/course-seokchon.jpg"],
    [/롯데월드|매직아일랜드|회전목마/, "./assets/course-lotteworld.jpg"],
    [/예술의전당|한가람|오페라|음악분수/, "./assets/course-artscenter.jpg"],
    [/냉면|을지로|덕수궁/, "./assets/course-naengmyeon.jpg"],
    [/돈까스|케이블카|서울타워|N서울/, "./assets/course-tonkatsu.jpg"],
    [/도서관|정동길|청계천|책쉼터/, "./assets/course-library.jpg"],
  ];
  return imageByPlace.find(([pattern]) => pattern.test(stop))?.[1] || course.image || "./assets/course-cafe.jpg";
}

function getCourseStopDescription(course, stop, index) {
  const role = getCourseStopRole(index, course.stops.length);
  const dwell = course.dwell?.[index] || "60분";
  if (role === "출발지") return `${course.name} 코스를 시작하는 장소입니다. ${dwell} 동안 주변을 둘러본 뒤 다음 장소로 이동해 보세요.`;
  if (role === "목적지") return `코스의 마지막 장소입니다. ${dwell} 정도 머물며 ${course.desc}`;
  return `${role}로 들르는 장소입니다. 약 ${dwell} 동안 여유 있게 방문하고 다음 경로를 이어가세요.`;
}

function getCourseStopTip(stop) {
  const tips = [
    [/카페|로스터리|다이닝|냉면|돈까스|먹자골목|시장/, "혼잡 시간과 운영 시간을 확인하고, 차량에서 내리기 전에 대기 여부를 확인해 보세요."],
    [/한강|호수|공원|숲|산책로|정동길|인사동길|한옥거리/, "걷기 좋은 신발과 날씨에 맞는 겉옷을 준비하면 장소를 더 여유롭게 즐길 수 있어요."],
    [/야구장|롯데월드|공연|오페라|미술관/, "입장 시간과 모바일 티켓을 미리 확인하면 현장에서의 대기 시간을 줄일 수 있어요."],
    [/타워|전망|팔각정|북악|케이블카/, "일몰 시간과 현지 기상 상태를 확인하면 가장 좋은 전망 시간을 고르기 쉬워요."],
    [/캠핑|공방|도자/, "예약 여부와 준비물을 확인하고 체험 시작 15분 전 도착을 권장해요."],
  ];
  return tips.find(([pattern]) => pattern.test(stop))?.[1] || "운영 시간과 현장 혼잡도를 확인하고, 추천 체류 시간에 맞춰 여유롭게 둘러보세요.";
}

function buildCourseMap(course) {
  const count = Math.max(course.stops.length, 1);
  const points = course.stops.map((stop, index) => {
    const ratio = count === 1 ? .5 : index / (count - 1);
    return { x: 11 + ratio * 78, y: 60 - ratio * 36 + Math.sin(ratio * Math.PI) * 15 };
  });
  const line = points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const markers = points.map((point, index) => `<button class="course-map-marker ${index === 0 ? "start" : index === count - 1 ? "destination" : "waypoint"}" style="left:${point.x}%;top:${point.y}%" data-action="course-stop-detail" data-value="${index}" aria-label="${getCourseStopRole(index, count)} ${escapeHtml(course.stops[index])} 상세 보기"><span>${index + 1}</span><small>${getCourseStopRole(index, count)}</small></button>`).join("");
  return `<div class="course-detail-map"><img src="./assets/map-seoul.jpg" alt="서울시 코스 이동 지도" /><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polyline points="${line}" /></svg>${markers}<span>예상 이동 경로 · ${Number(course.distance || 0).toLocaleString("ko-KR")}km</span></div>`;
}

function openCourseStopDetail(course, index) {
  const stop = course.stops[index];
  if (!stop) return;
  const role = getCourseStopRole(index, course.stops.length);
  const image = getCourseStopImage(course, stop, index);
  openModal({
    title: stop,
    iconName: "pin",
    body: `<div class="stop-detail-role"><span>${index + 1}</span><div><small>${role}</small><strong>${escapeHtml(course.name)}</strong></div></div><div class="stop-detail-image"><img src="${image}" alt="${escapeHtml(stop)} 장소 이미지" /></div><div class="stop-detail-copy"><strong>${escapeHtml(stop)}</strong><p>${escapeHtml(getCourseStopDescription(course, stop, index))}</p></div><div class="receipt-info"><span>장소 구분</span><strong>${role}</strong><span>추천 체류</span><strong>${escapeHtml(course.dwell?.[index] || "60분")}</strong><span>방문 순서</span><strong>${index + 1} / ${course.stops.length}</strong></div><div class="recommend-box"><strong>${icon("pin")} 장소 추천</strong><p>${escapeHtml(getCourseStopTip(stop))}</p></div>`,
    primary: "코스 상세로 돌아가기",
    secondary: null,
    onConfirm: () => setTimeout(() => openCourseDetail(course), 0),
  });
}

function openCourseDetail(course) {
  state.activeDetailCourse = course;
  const stops = course.stops.map((stop, index) => {
    const role = getCourseStopRole(index, course.stops.length);
    return `<button class="course-detail-stop ${index === 0 ? "start" : index === course.stops.length - 1 ? "destination" : "waypoint"}" data-action="course-stop-detail" data-value="${index}"><span>${index + 1}</span><div><small>${role}</small><strong>${escapeHtml(stop)}</strong><em>${escapeHtml(course.dwell?.[index] || "60분")} 머무름</em></div>${icon("chevron")}</button>`;
  }).join("");
  const cover = course.image || getCourseStopImage(course, course.stops[0] || "", 0);
  openModal({ title: course.name, iconName: "compass", body: `<div class="detail-cover"><img src="${cover}" alt="${escapeHtml(course.name)}" /></div><p>${escapeHtml(course.desc)}</p>${buildCourseMap(course)}<div class="course-detail-meta"><div><small>전체 시간</small><strong>${escapeHtml(course.time)}</strong></div><div><small>장소</small><strong>${course.stops.length}곳</strong></div><div><small>추천 순서</small><strong>번호 순서대로</strong></div></div><div class="course-route-heading"><strong>빠른 이동 경로</strong><small>장소를 누르면 상세 내용을 볼 수 있어요.</small></div><div class="detail-stop-list">${stops}</div><div class="recommend-box"><strong>${icon("heart")} MOOV 추천</strong><p>${escapeHtml(course.recommend || "여유 있게 출발해 각 장소의 운영시간을 확인해 주세요.")}</p></div>`, primary: "이 코스 따라가기", secondary: "닫기", onConfirm: () => useCourseForHome(course) });
}

function useCourseForHome(course) {
  state.selectedCourse = course;
  state.routeStops = [state.pickupLocation, ...course.stops];
  state.homeStep = state.tripActive ? "service" : state.returnToHomeAfterCourse ? "setup" : "mode";
  const returnsToSetup = state.returnToHomeAfterCourse;
  state.returnToHomeAfterCourse = false;
  persist(); setTab("home");
  toast(returnsToSetup ? "코스 전체를 현재 이동 설정에 등록했어요." : "코스 전체를 목적지에 등록했어요. 이동 모드를 선택해 주세요.");
}

function renderRecommendation() {
  return `<section class="section-lead"><h3>어떤 나들이를 원하세요?</h3><p>${escapeHtml(state.username)}님의 취향과 예산으로 코스를 만들고, 기존 코스도 함께 추천합니다.</p></section><section class="card preference-panel">${choiceGroup("나들이 관심사", ["맛집 투어", "감성 카페", "쇼핑", "관광 명소", "야경 힐링"], 1)}${choiceGroup("선호하는 분위기", ["활기찬", "여유로운", "로맨틱", "가족과 함께"], 1)}<div class="choice-group"><div class="row"><h4>예산 설정</h4><strong class="green">약 10만원</strong></div><input class="budget" type="range" min="3" max="30" value="10" /></div>${choiceGroup("누구와 함께 하나요?", ["혼자", "커플", "친구", "가족"], 0)}<button class="primary-button full" data-action="recommend-course">코스 추천받기</button></section><section class="section-lead compact"><h3>추천 코스 둘러보기</h3><p>검색과 지도 필터로 원하는 코스를 골라 직접 만들 수 있어요.</p></section>${renderCourseBrowse()}`;
}

function buildAiRecommendedCourse() {
  const selected = [...document.querySelectorAll(".preference-panel .choice-chip.selected")].map((button) => button.textContent.trim()).filter(Boolean);
  const budget = Number(document.querySelector(".preference-panel .budget")?.value || 10);
  const mood = selected.includes("로맨틱") || selected.includes("야경 힐링") ? "노을과 야경" : selected.includes("가족과 함께") ? "가족 휴식" : "감성 산책";
  const name = selected.includes("야경 힐링") || selected.includes("로맨틱") ? "AI 추천 한강 노을·남산 야경 코스" : selected.includes("관광 명소") ? "AI 추천 서울 명소 반나절 코스" : "AI 추천 성수 감성 카페 코스";
  const stops = selected.includes("관광 명소")
    ? ["서울숲 메타세쿼이아길", "석촌호수 서호", "롯데월드타워 전망광장"]
    : selected.includes("야경 힐링") || selected.includes("로맨틱")
      ? ["뚝섬 한강공원", "반포대교 달빛광장", "남산 서울타워"]
      : ["어니언 성수", "대림창고 갤러리", "서울숲 카페거리"];
  return {
    id: "ai-recommend",
    author: "MOOV AI",
    name,
    desc: `${state.username}님의 선택 취향을 반영해 ${mood} 중심으로 구성한 추천 코스입니다.`,
    image: selected.includes("야경 힐링") || selected.includes("로맨틱") ? "./assets/course-hangang-sunset.jpg" : "./assets/course-cafe.jpg",
    time: selected.includes("관광 명소") ? "3곳 · 약 4.5시간" : "3곳 · 약 4시간",
    stops,
    dwell: selected.includes("야경 힐링") || selected.includes("로맨틱") ? ["45분", "55분", "60분"] : ["70분", "60분", "80분"],
    distance: selected.includes("관광 명소") ? 8.4 : selected.includes("야경 힐링") || selected.includes("로맨틱") ? 4.6 : 1.8,
    likes: 0,
    createdAt: new Date().toISOString().slice(0, 10),
    recommend: `예산 약 ${budget}만원 안에서 이동 시간과 체류 시간을 맞췄어요. 운영시간과 혼잡도를 확인한 뒤 출발 20분 전에 차량을 호출하는 것을 추천합니다.`,
  };
}

function renderRegisterCourse() {
  const draft = state.courseDraft;
  return `<section class="section-lead"><h3>나만의 코스 등록</h3><p>장소를 직접 입력하거나 최근 1년 이용 기록에서 경로를 불러올 수 있어요.</p></section><div class="source-switch"><button class="${state.courseSource === "manual" ? "active" : ""}" data-action="course-source" data-value="manual">직접 입력</button><button class="${state.courseSource === "history" ? "active" : ""}" data-action="course-source" data-value="history">이용 기록에서 가져오기</button></div>${state.courseSource === "history" ? renderHistoryRoutes() : ""}<section class="card padded stack"><label class="form-label">코스 제목<input id="course-title" data-course-field="title" value="${escapeHtml(draft.title)}" placeholder="코스 제목 입력" /></label><label class="form-label">코스 설명<textarea id="course-desc" data-course-field="desc" rows="3" placeholder="코스를 소개해 주세요">${escapeHtml(draft.desc)}</textarea></label><div class="row"><span class="strong small">경유지·목적지</span><span class="badge orange">목적지 1곳만</span></div>${draft.stops.map(stopEditor).join("")}<button class="ghost-button full" data-action="add-course-stop">${icon("plus")} 경유지 추가</button><div class="register-actions"><button class="secondary-button" data-action="preview-course">${icon("search")} 미리보기</button><button class="primary-button" data-action="publish-course">관심 코스에 등록</button></div></section>`;
}

function renderHistoryRoutes() {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 1);
  const query = normalizeSearch(state.historyQuery);
  const rankedHistoryIds = query ? new Set(policyRankCandidates(query, historySearchCandidates(), historyRoutes.length).map((item) => item.itemId)) : null;
  const recent = historyRoutes.filter((route) => new Date(route.date) >= cutoff && (!rankedHistoryIds || rankedHistoryIds.has(route.id)));
  return `<section class="history-picker">${renderSearchField({ inputId: "history-search", stateKey: "historyQuery", className: "course-search", placeholder: "날짜, 장소, 코스 검색", label: "이용 기록 검색" })}<div class="row history-summary"><span>최근 1년 전체 이용 기록</span><strong>${recent.length}건</strong></div><div class="stack">${recent.length ? recent.map((route) => `<button class="history-route" data-action="use-history-route" data-value="${route.id}"><span class="history-icon">${icon("clock")}</span><span><strong>${route.name}</strong><small>${route.meta}</small></span>${icon("chevron")}</button>`).join("") : emptyState("search", "검색 결과가 없어요", "최근 1년 내 앞글자가 일치하는 장소나 코스를 검색해 보세요.")}</div><p class="history-retention">이용 기록은 이용일로부터 최대 1년간 보관 후 자동 삭제됩니다.</p></section>`;
}

function stopEditor(stop, index) {
  const destination = stop.type === "목적지";
  const waypointOrder = state.courseDraft.stops.slice(0, index + 1).filter((item) => item.type !== "목적지").length;
  const waypointIndexes = state.courseDraft.stops.map((item, itemIndex) => item.type !== "목적지" ? itemIndex : -1).filter((itemIndex) => itemIndex >= 0);
  const waypointPosition = waypointIndexes.indexOf(index);
  return `<div class="stop-editor ${destination ? "destination" : ""}"><label class="photo-slot" for="stop-photo-${index}">${stop.photo ? `<img src="${stop.photo}" alt="${escapeHtml(stop.name || "장소")} 사진" />` : `${icon("image")}<span>장소 이미지<br />없음</span>`}</label><input id="stop-photo-${index}" type="file" accept="image/*" data-stop-photo="${index}" hidden /><div class="stop-fields"><div class="stop-editor-head"><span class="stop-type-chip">${destination ? "목적지 · 1곳" : `경유지 ${waypointOrder}`}</span>${destination ? "" : `<span class="stop-order"><button data-action="move-stop-up" data-value="${index}" ${waypointPosition <= 0 ? "disabled" : ""} aria-label="경유지 위로 이동">↑</button><button data-action="move-stop-down" data-value="${index}" ${waypointPosition === waypointIndexes.length - 1 ? "disabled" : ""} aria-label="경유지 아래로 이동">↓</button></span>`}</div><input data-stop-name="${index}" value="${escapeHtml(stop.name)}" placeholder="${destination ? "최종 목적지를 입력하세요" : `경유지 ${waypointOrder} 장소명을 입력하세요`}" />${destination ? `<small class="muted">최종 목적지는 한 곳만 설정할 수 있어요.</small>` : `<button class="mini-action" data-action="remove-course-stop" data-value="${index}">경유지 삭제</button>`}</div></div>`;
}

function renderInterestCourses() {
  const list = getInterestCourses();
  return `<section class="section-lead"><h3>관심 코스</h3><p>저장한 코스와 직접 등록한 코스를 한곳에서 확인하세요.</p></section>${list.length ? `<div class="stack">${list.map(courseCard).join("")}</div>` : emptyState("bookmark", "관심 코스가 없어요", "AI 코스 추천에서 저장하거나 새 코스를 등록해 주세요.")}`;
}

function getCourse(id) { return baseCourses.find((course) => course.id === id) || state.customCourses.find((course) => course.id === id); }
function getInterestCourses() { return [...baseCourses.filter((course) => state.savedCourseIds.has(course.id)), ...state.customCourses]; }

function renderProfile() {
  if (state.profileView !== "menu") return renderProfileSection();
  const avatar = `<img src="${state.profilePhoto || DEFAULT_PROFILE_PHOTO}" alt="프로필 사진" />`;
  const primaryCard = state.paymentCards.find((card) => card.primary) || state.paymentCards[0];
  return `<div class="stack"><section class="card profile-card"><div class="avatar">${avatar}</div><div style="flex:1"><h3>${escapeHtml(state.username)}님</h3><p>MOOV Explorer · 누적 이동 128km</p></div><button class="mini-action" data-action="edit-profile">${icon("edit")} 편집</button></section><section class="card mode-hero"><div class="mode-hero-visual"><img src="${themeAssets[state.theme]}" alt="${escapeHtml(state.theme)} 공간 테마가 적용된 차량 내부" /><span class="badge">공간 모드</span></div><div class="mode-hero-body"><h3>${escapeHtml(state.theme)} 모드 적용 중</h3><p class="small">${state.themeConfig.temperature}℃ · 창문 농도 ${state.themeConfig.tint}% · ${escapeHtml(state.themeConfig.light)}</p><button class="secondary-button full" data-action="open-theme">공간 테마 상세 설정</button></div></section><section class="card menu-list">${menuItem("bell", "공지·이벤트", "새로운 MOOV 소식과 혜택", "profile-section", "notices")}${menuItem("clock", "이용 기록", "택시·렌트·공간·구매 내역", "profile-section", "usage")}${menuItem("bookmark", "관심 코스", `저장·등록한 코스 ${getInterestCourses().length}개`, "profile-section", "courses")}${menuItem("card", "결제수단 관리", primaryCard ? `${primaryCard.name} ${primaryCard.number}` : "등록된 결제수단 없음", "profile-section", "payments")}${menuItem("shield", "약관 및 정책", "개인정보·차량 보안 정책", "profile-section", "policies")}${menuItem("space", "버전 정보", `MOOV ${APP_VERSION}`, "profile-section", "version")}${menuItem("user", "로그아웃", "로그인 화면으로 돌아가기", "logout", "logout")}</section><button class="card security-summary" data-action="open-security-proof">${icon("shield")}<span><strong>차량 보안 상태</strong><small>${state.securityProof ? `삭제 검증 완료 · ${escapeHtml(state.securityProof.reference)}` : "배차 전 이전 이용 데이터 삭제 확인"}</small></span><span class="badge">안전</span></button></div>`;
}

function renderProfileSection() {
  const sections = {
    notices: ["공지·이벤트", "서비스 소식과 이용 혜택", renderNotices()],
    usage: ["이용 기록", "이동·공간·구매 기록을 한곳에서 확인", renderUsageHistory()],
    courses: ["관심 코스", "저장하거나 직접 등록한 나들이 코스", renderProfileCourses()],
    payments: ["결제수단 관리", "자동 결제에 사용할 카드를 관리", renderPaymentMethods()],
    policies: ["약관 및 정책", "MOOV 이용과 개인정보·차량 보안 기준", renderPolicies()],
    version: ["버전 정보", "현재 설치된 MOOV 앱 정보", renderVersionInfo()],
  };
  const [heading, desc, body] = sections[state.profileView] || sections.version;
  return `<div class="profile-detail"><button class="back-button" data-action="profile-back" aria-label="내 정보로 돌아가기">${icon("back")}</button><section class="section-lead"><h3>${heading}</h3><p>${desc}</p></section>${body}</div>`;
}

function renderNotices() {
  return `<section class="card notice-list">${appNotices.map((notice) => `<button class="notice-row" data-action="notice-detail" data-value="${notice.id}" data-title="${escapeHtml(notice.title)}" data-text="${escapeHtml(notice.text)}"><span class="badge ${notice.tag === "이벤트" ? "orange" : ""}">${notice.tag}</span><span><strong>${notice.title}</strong><small>${notice.date}</small></span>${icon("chevron")}</button>`).join("")}</section>`;
}

function renderUsageHistory() {
  const rentActive = state.homeMode === "rent";
  const active = state.tripActive ? `<button class="usage-row active" data-action="usage-detail" data-value="active"><span class="history-icon">${icon(rentActive ? "key" : "car")}</span><span><strong>현재 ${rentActive ? "렌트" : "택시"} 이용 중</strong><small><span ${rentActive ? "data-live-remaining data-prefix=\"남은 시간 \"" : "data-live-usage"}>${rentActive ? `남은 시간 ${formatElapsed(getRentalRemaining())}` : formatElapsed(Date.now() - (state.usageStartedAt || Date.now()))}</span> · ${escapeHtml(state.routeStops.at(-1))}</small></span><span class="badge">LIVE</span></button>` : "";
  const rides = historyRoutes.map((route) => `<button class="usage-row" data-action="usage-detail" data-value="${route.id}"><span class="history-icon">${icon(route.meta.includes("렌트") ? "key" : "car")}</span><span><strong>${route.name}</strong><small>${route.meta}</small></span>${icon("chevron")}</button>`).join("");
  const purchases = state.orders.map((order) => `<button class="usage-row" data-action="order-detail" data-value="${order.id}"><span class="history-icon">${icon("bag")}</span><span><strong>차량 상품 구매</strong><small>${formatOrderDate(order.createdAt)} · ${order.total.toLocaleString("ko-KR")}원</small></span>${icon("chevron")}</button>`).join("");
  return `<section class="card usage-list">${active}${rides}${purchases}</section>`;
}

function renderProfileCourses() {
  const courses = getInterestCourses();
  return courses.length ? `<div class="stack">${courses.map(courseCard).join("")}</div>` : emptyState("bookmark", "관심 코스가 없어요", "나들이에서 코스를 저장하거나 등록해 주세요.");
}

function renderPaymentMethods() {
  return `<div class="stack"><section class="card payment-list">${state.paymentCards.length ? state.paymentCards.map((card) => `<div class="payment-card"><span class="payment-brand">${icon("card")}</span><span><strong>${escapeHtml(card.name)}</strong><small>${escapeHtml(card.number)}</small></span><div>${card.primary ? `<span class="badge">기본</span>` : `<button class="mini-action" data-action="payment-primary" data-value="${card.id}">기본 설정</button>`}<button class="text-danger" data-action="payment-remove" data-value="${card.id}" ${state.paymentCards.length === 1 ? "disabled" : ""}>삭제</button></div></div>`).join("") : emptyState("card", "결제수단이 없어요", "카드를 등록하면 택시·렌트·상품 결제를 바로 진행할 수 있어요.")}</section><button class="primary-button full" data-action="payment-add">카드 추가</button></div>`;
}

function renderPolicies() {
  const policies = [["service", "서비스 이용약관", "택시·렌트·공간 이용 기준"], ["privacy", "개인정보 처리방침", "위치·결제·프로필 정보 처리 기준"], ["security", "차량 보안 정책", "탑승 인증·데이터 삭제·긴급 대응"], ["refund", "취소 및 환불 정책", "배차·렌트·상품 주문 취소 기준"]];
  return `<section class="card menu-list">${policies.map(([id, name, desc]) => menuItem("shield", name, desc, "policy-detail", id)).join("")}</section>`;
}

function renderVersionInfo() {
  return `<section class="card version-card"><div class="version-logo">M</div><h3>MOOV ${APP_VERSION}</h3><p>무인차 이동·공간·나들이 통합 서비스</p><div class="divider"></div><div class="receipt-info"><span>업데이트</span><strong>2026.09.13</strong><span>빌드</span><strong>Prototype 262</strong><span>오픈소스 라이선스</span><button class="mini-action" data-action="license-info">확인</button></div><button class="secondary-button full" data-action="check-update">업데이트 확인</button></section>`;
}

function openProfileEditor() {
  state.pendingProfilePhoto = state.profilePhoto || DEFAULT_PROFILE_PHOTO;
  openModal({ title: "프로필 편집", iconName: "user", body: `<div class="popup-form"><div class="avatar" style="margin:auto" id="profile-photo-preview"><img src="${state.pendingProfilePhoto}" alt="프로필 미리보기" /></div><label class="secondary-button full" style="display:grid;place-items:center" for="profile-photo-input">${icon("camera")} 프로필 사진 선택</label><input id="profile-photo-input" type="file" accept="image/*" hidden /><label class="form-label">이름<input id="profile-name" value="${escapeHtml(state.username)}" /></label><button type="button" class="ghost-button full" data-action="logout">로그아웃</button></div>`, primary: "저장", secondary: "취소", onConfirm: () => { const name = document.querySelector("#profile-name")?.value.trim(); if (name) state.username = name.slice(0,12); state.profilePhoto = state.pendingProfilePhoto || DEFAULT_PROFILE_PHOTO; persist(); render(); toast("프로필을 저장했어요."); } });
}

function openThemeSettings() {
  state.pendingTheme = state.theme;
  openModal({ title: "공간 테마 설정", iconName: "space", body: `<p>테마를 선택하면 차량 내부가 어떻게 바뀌는지 먼저 확인할 수 있어요.</p><div class="popup-form"><figure class="theme-main-preview"><img id="theme-example-image" src="${themeAssets[state.theme]}" alt="${escapeHtml(state.theme)} 공간 테마 예시" /><figcaption id="theme-example-label">${escapeHtml(state.theme)} 모드 미리보기</figcaption></figure><div class="theme-preview">${["윈도우", "콘텐츠", "웰니스", "수면", "프라이빗"].map((mode) => `<button class="${state.theme === mode ? "active" : ""}" data-action="theme-choice" data-value="${mode}"><img src="${themeAssets[mode]}" alt="" /><span>${mode}</span></button>`).join("")}</div><label class="range-row"><span class="row small"><strong>실내 온도</strong><span id="temp-value">${state.themeConfig.temperature}℃</span></span><input id="theme-temp" type="range" min="18" max="28" value="${state.themeConfig.temperature}" /></label><label class="range-row"><span class="row small"><strong>창문 투명도</strong><span id="tint-value">${state.themeConfig.tint}%</span></span><input id="theme-tint" type="range" min="0" max="100" value="${state.themeConfig.tint}" /></label><label class="form-label">조명<select id="theme-light">${["민트 앰비언트", "따뜻한 독서등", "콘텐츠 몰입등", "수면 저조도"].map((light) => `<option ${state.themeConfig.light === light ? "selected" : ""}>${light}</option>`).join("")}</select></label><label class="row card padded" style="font-size:.76rem"><span><strong>프라이버시 글라스</strong><br /><small class="muted">외부 시야 차단</small></span><input id="theme-privacy" type="checkbox" style="width:22px;min-height:22px" ${state.themeConfig.privacy ? "checked" : ""} /></label></div>`, primary: "차량에 적용", secondary: "취소", onCancel: () => { state.pendingTheme = null; syncCabinPreview(); }, onConfirm: () => { state.theme = state.pendingTheme || state.theme; state.pendingTheme = null; state.themeConfig.temperature = Number(document.querySelector("#theme-temp")?.value || 22); state.themeConfig.tint = Number(document.querySelector("#theme-tint")?.value || 60); state.themeConfig.light = document.querySelector("#theme-light")?.value || "민트 앰비언트"; state.themeConfig.privacy = Boolean(document.querySelector("#theme-privacy")?.checked); persist(); render(); toast(`${state.theme} 모드를 차량에 적용했어요.`); } });
}

function openPaymentEditor() {
  openModal({ title: "결제 카드 추가", iconName: "card", body: `<div class="popup-form"><label class="form-label">카드사<input id="new-card-name" placeholder="예: 현대카드" /></label><label class="form-label">카드번호 뒤 4자리<input id="new-card-number" inputmode="numeric" maxlength="4" placeholder="1234" /></label><p>프로토타입에서는 실제 카드 인증이나 결제가 진행되지 않습니다.</p></div>`, primary: "카드 등록", secondary: "취소", onConfirm: () => { const name = document.querySelector("#new-card-name")?.value.trim(); const number = document.querySelector("#new-card-number")?.value.trim(); if (!name || !/^\d{4}$/.test(number)) { toast("카드사와 숫자 4자리를 확인해 주세요."); return false; } state.paymentCards.push({ id: `card-${Date.now()}`, name, number: `•••• ${number}`, primary: !state.paymentCards.length }); persist(); render(); toast("결제 카드를 등록했어요."); } });
}

function openPolicyDetail(id) {
  const policies = {
    service: ["서비스 이용약관", "MOOV 택시·렌트·공간 서비스는 본인 인증과 차량 배정 완료 후 이용할 수 있습니다. 운행 중 안전 지시와 차량 이용 규칙을 따라야 합니다."],
    privacy: ["개인정보 처리방침", "배차와 경로 제공을 위해 위치정보를 이용하며 결제·프로필 정보는 서비스 제공 목적에 한해 처리합니다. 차량 내 음성 원본과 OTT 로그인 정보는 하차 후 자동 삭제합니다."],
    security: ["차량 보안 정책", "이용 종료 즉시 신규 인증과 외부 연결을 차단하고, 차량 내 토큰·연결·콘텐츠 캐시를 삭제한 뒤 잔존 0건을 검증합니다. 삭제·연결 해제·증명 중 하나라도 완료되지 않으면 차량은 안전 모드로 격리되어 재배차되지 않습니다. 결제 영수증과 법정 사고 증적은 차량 일반 영역과 분리해 승인된 보존 기준으로 관리합니다."],
    refund: ["취소 및 환불 정책", "배차 전 취소는 무료이며 차량 접근 이후에는 호출 비용이 발생할 수 있습니다. 렌트는 시작 전 정책에 따라 환불하며, 개봉 또는 수령한 차량 내 상품은 품질 이상을 제외하고 환불되지 않습니다."],
  };
  const policy = policies[id] || policies.service;
  openModal({ title: policy[0], iconName: "shield", body: `<p>${policy[1]}</p><div class="policy-note">시행일: 2026년 9월 12일 · 상세 정책은 정식 서비스 출시 전 고지됩니다.</div>`, primary: "확인", secondary: null });
}

function openUsageDetail(id) {
  if (id === "active") {
    const rent = state.homeMode === "rent";
    openModal({ title: `현재 ${rent ? "렌트" : "택시"} 이용`, iconName: rent ? "key" : "car", body: `<div class="receipt-info"><span>${rent ? "남은 시간" : "이용시간"}</span><strong ${rent ? "data-live-remaining" : "data-live-usage"}>${rent ? formatElapsed(getRentalRemaining()) : formatElapsed(Date.now() - (state.usageStartedAt || Date.now()))}</strong><span>목적지</span><strong>${escapeHtml(state.routeStops.at(-1))}</strong><span>차량</span><strong>MOOV 24</strong></div>`, primary: "홈에서 보기", secondary: "닫기", onConfirm: () => setTab("home") });
    return;
  }
  const route = historyRoutes.find((item) => item.id === id);
  if (route) openModal({ title: route.name, iconName: route.meta.includes("렌트") ? "key" : "car", body: `<p>${route.meta}</p><div class="receipt-items">${route.stops.map((stop, index) => `<div class="receipt-line"><span>${index === route.stops.length - 1 ? "목적지" : "경유지"}</span><strong>${escapeHtml(stop)}</strong></div>`).join("")}</div>`, primary: "코스로 등록", secondary: "닫기", onConfirm: () => { state.courseDraft.title = route.name; state.courseDraft.stops = route.stops.map((name, index) => ({ type: index === route.stops.length - 1 ? "목적지" : "경유지", name, photo: null })); state.outingSub = "register"; setTab("outing"); } });
}

function subtabs(items, active, action) { return `<div class="subtabs" role="tablist">${items.map(([id, label]) => `<button class="${active === id ? "active" : ""}" data-action="${action}" data-value="${id}">${label}</button>`).join("")}</div>`; }
function choiceGroup(name, values, selected) { return `<div class="choice-group"><h4>${name}</h4><div class="filter-chips">${values.map((value, index) => `<button class="${index === selected ? "selected" : ""}" data-action="chip">${value}</button>`).join("")}</div></div>`; }

function toggleItem(titleText, desc, on, action = "toggle", iconVariant = null) {
  const iconHtml = iconVariant === "luna-bot" ? `<img src="${LUNA_BOT_IMAGE}" alt="" />` : icon("chat");
  return `<div class="menu-item ${action === "ai-power" ? "ai-master-toggle" : ""}"><span class="menu-icon">${iconHtml}</span><span><strong>${titleText}</strong><small>${desc}</small></span><button class="switch ${on ? "on" : ""}" data-action="${action}" aria-label="${titleText} 전환"></button></div>`;
}
function toggleItemInner(titleText, desc, on, action) { return `<span><strong>${titleText}</strong><small>${desc}</small></span><button class="switch ${on ? "on" : ""}" data-action="${action}" aria-label="${titleText} 전환"></button>`; }
function menuItem(iconName, titleText, desc, action = "menu-info", value = titleText) { return `<button class="menu-item" data-action="${action}" data-value="${value}"><span class="menu-icon">${icon(iconName)}</span><span><strong>${titleText}</strong><small>${desc}</small></span>${icon("chevron")}</button>`; }
function emptyState(iconName, heading, text) { return `<section class="card empty-state">${icon(iconName)}<h4>${heading}</h4><p>${text}</p></section>`; }

function openModal({ title: modalTitle, body, iconName = "shield", primary = "확인", secondary = "닫기", onConfirm = null, onCancel = null }) {
  document.querySelector("#modal-title").textContent = modalTitle;
  const modalBody = document.querySelector("#modal-body");
  modalBody.innerHTML = body;
  modalBody.scrollTop = 0;
  document.querySelector("#modal-icon").innerHTML = icon(iconName);
  const actions = document.querySelector("#modal-actions");
  actions.innerHTML = `${secondary ? `<button class="ghost-button" data-modal-cancel>${secondary}</button>` : ""}<button class="primary-button" data-modal-confirm>${primary}</button>`;
  actions.querySelector("[data-modal-cancel]")?.addEventListener("click", () => { if (onCancel) onCancel(); closeModal(); });
  actions.querySelector("[data-modal-confirm]").onclick = () => { const shouldClose = onConfirm ? onConfirm() !== false : true; if (shouldClose) closeModal(); };
  modal.classList.add("open"); modal.setAttribute("aria-hidden", "false");
}

function closeModal() { if (state.pendingTheme) { state.pendingTheme = null; syncCabinPreview(); } modal.classList.remove("open"); modal.setAttribute("aria-hidden", "true"); }
function toast(message) { const el = document.querySelector("#toast"); el.textContent = message; el.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 2200); }

document.addEventListener("submit", (event) => {
  if (event.target.id === "login-form") { event.preventDefault(); login(); }
  if (event.target.id === "chat-form" || event.target.id === "main-text-form") { event.preventDefault(); const input = document.querySelector("#chat-text, #main-text-input"); sendMessage(input?.value || ""); if (input) input.value = ""; }
});

document.addEventListener("input", (event) => {
  if (event.target.dataset.courseField) state.courseDraft[event.target.dataset.courseField] = event.target.value;
  if (event.target.dataset.stopName !== undefined) state.courseDraft.stops[Number(event.target.dataset.stopName)].name = event.target.value;
  if (event.target.id === "course-search") handleSearchInput(event, "outingQuery", "course-search");
  if (event.target.dataset.action === "outing-budget") {
    state.outingFilters.budget = Number(event.target.value);
    persist();
    render();
  }
  if (event.target.id === "home-search") handleSearchInput(event, "homeQuery", "home-search");
  if (event.target.id === "product-search") handleSearchInput(event, "productQuery", "product-search");
  if (event.target.id === "history-search") handleSearchInput(event, "historyQuery", "history-search");
  if (event.target.id === "theme-temp") { const value = document.querySelector("#temp-value"); if (value) value.textContent = `${event.target.value}℃`; }
  if (event.target.id === "theme-tint") { const value = document.querySelector("#tint-value"); if (value) value.textContent = `${event.target.value}%`; }
});

document.addEventListener("compositionstart", (event) => {
  if (event.target.matches?.("#home-search, #course-search, #product-search, #history-search")) event.target.dataset.composing = "true";
});

document.addEventListener("compositionend", (event) => {
  if (!event.target.matches?.("#home-search, #course-search, #product-search, #history-search")) return;
  event.target.dataset.composing = "false";
  const map = { "home-search": "homeQuery", "course-search": "outingQuery", "product-search": "productQuery", "history-search": "historyQuery" };
  handleSearchInput(event, map[event.target.id], event.target.id, true);
});

function handleSearchInput(event, stateKey, inputId, forceRender = false) {
  if (!stateKey) return;
  state[stateKey] = event.target.value;
  searchUi.inputId = inputId;
  searchUi.activeIndex = 0;
  if (!forceRender && (event.isComposing || event.target.dataset.composing === "true")) return;
  const cursor = event.target.selectionStart;
  clearTimeout(searchDebounceTimer);
  const rerender = () => {
    render();
    const nextInput = document.querySelector(`#${inputId}`);
    if (nextInput) { nextInput.focus(); nextInput.setSelectionRange(cursor, cursor); }
  };
  forceRender ? rerender() : searchDebounceTimer = setTimeout(rerender, SEARCH_DEBOUNCE_MS);
}

document.addEventListener("change", (event) => {
  if (event.target.dataset.stopType !== undefined) state.courseDraft.stops[Number(event.target.dataset.stopType)].type = event.target.value;
  if (event.target.dataset.stopPhoto !== undefined && event.target.files?.[0]) {
    const index = Number(event.target.dataset.stopPhoto); const reader = new FileReader();
    reader.onload = () => { state.courseDraft.stops[index].photo = reader.result; render(); };
    reader.readAsDataURL(event.target.files[0]);
  }
  if (event.target.id === "profile-photo-input" && event.target.files?.[0]) {
    const reader = new FileReader();
    reader.onload = () => { state.pendingProfilePhoto = reader.result; const preview = document.querySelector("#profile-photo-preview"); if (preview) preview.innerHTML = `<img src="${reader.result}" alt="프로필 미리보기" />`; };
    reader.readAsDataURL(event.target.files[0]);
  }
});

document.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  const action = button.dataset.action; const value = button.dataset.value;
  if (button.dataset.tab) { if (button.dataset.tab === "home") state.homeStep = state.tripActive ? "service" : "mode"; return setTab(button.dataset.tab); }
  if (action === "skip-splash") { clearTimeout(splashTimer); if (state.isAuthenticated) { showScreen("app"); setTab(state.activeTab || "home"); } else showScreen("login"); }
  if (action === "close-modal") closeModal();
  if (action === "search-suggestion") { applySearchSuggestion(button); return; }
  if (action === "open-status") openVehicleStatus();
  if (action === "open-security-proof") openVehicleStatus();
  if (action === "header-profile") setTab("profile");
  if (action === "select-home-mode") { state.homeMode = value; state.homeStep = "setup"; persist(); render(); }
  if (action === "return-mode-choice") { state.homeStep = "mode"; render(); }
  if (action === "locate-home") locateUser("home");
  if (action === "locate-outing") locateUser("outing");
  if (action === "open-pin-picker") openMapPinPicker();
  if (action === "toggle-map-pin") { state.mapPinOpen = !state.mapPinOpen; render(); }
  if (action === "map-pin-select") { applyPickupLocation(value); closeModal(); toast("선택한 위치를 출발지로 설정했어요."); }
  if (action === "browse-courses-home") { closeModal(); state.returnToHomeAfterCourse = true; state.outingSub = "recommend"; setTab("outing"); toast("AI 코스 추천에서 원하는 코스를 골라 주세요."); }
  if (action === "open-destination") openDestinationSearch();
  if (action === "choose-saved-course") chooseSavedCourse();
  if (action === "select-home-course") { const course = getCourse(value); if (course) { state.selectedCourse = course; state.routeStops = [state.pickupLocation, ...course.stops]; state.homeStep = "setup"; persist(); closeModal(); render(); toast("관심 코스 전체를 목적지에 등록했어요."); } }
  if (action === "home-mode") { if (state.tripActive && value === "rent" && state.homeMode === "taxi") return openModal({ title: "렌트로 전환할까요?", body: "<p>렌트 조건과 결제가 확정될 때까지 현재 택시 이동은 계속됩니다.</p>", iconName: "key", primary: "전환 요청", onConfirm: () => { state.homeMode = "rent"; state.tripActive = true; state.usageStartedAt = Date.now(); state.rentalEndsAt = state.usageStartedAt + state.rentalHours * 3600000; persist(); render(); toast("안전 정차 후 렌트 이용을 시작했어요."); } }); state.homeMode = value; persist(); render(); }
  if (action === "rent-minus") { state.rentalHours = Math.max(2, state.rentalHours - 1); render(); }
  if (action === "rent-plus") { state.rentalHours = Math.min(24, state.rentalHours + 1); render(); }
  if (action === "taxi-vehicle") { state.taxiVehicleType = value; persist(); render(); toast("택시 차량 종류를 변경했어요."); }
  if (action === "rental-vehicle") { state.rentalVehicleType = value; persist(); render(); toast("렌트 차량 종류를 변경했어요."); }
  if (action === "rental-option") { if (state.tripActive) return toast("이용 중 옵션 변경은 고객센터 연결이 필요해요."); state.rentalOptions.has(value) ? state.rentalOptions.delete(value) : state.rentalOptions.add(value); persist(); render(); }
  if (action === "request-taxi") { const vehicle = rentalVehicles.find((item) => item.id === state.taxiVehicleType) || rentalVehicles[0]; if (state.tripActive) return toast("실시간 이동 경로를 표시하고 있어요."); if (!state.routeStops.at(-1) || state.routeStops.length < 2) return toast("출발지와 목적지를 먼저 설정해 주세요."); openModal({ title: "MOOV 택시를 호출할까요?", body: `<p>${state.routeStops.length - 1}개 이동 장소를 경로에 등록했습니다. ${escapeHtml(vehicle.name)}을 ${escapeHtml(state.pickupLocation)}으로 배정하고 하차 후 등록 카드로 자동 결제합니다.</p>`, iconName: "car", primary: "예약", onConfirm: () => { state.tripActive = true; state.homeStep = "service"; state.usageStartedAt = Date.now(); state.rentalEndsAt = null; persist(); render(); toast(`${vehicle.name}이 배정됐어요.`); } }); }
  if (action === "switch-to-rent") openModal({ title: "렌트로 전환할까요?", body: "<p>렌트 조건과 결제가 확정될 때까지 현재 택시 이동은 계속됩니다. 안전 정차 후 차량 옵션을 선택합니다.</p>", iconName: "key", primary: "전환 설정", secondary: "취소", onConfirm: () => { state.tripActive = false; state.usageStartedAt = null; state.rentalEndsAt = null; state.homeMode = "rent"; state.homeStep = "setup"; persist(); render(); toast("렌트 조건을 선택해 주세요."); } });
  if (action === "request-rent") { const vehicle = rentalVehicles.find((item) => item.id === state.rentalVehicleType) || rentalVehicles[0]; const optionPrice = rentalOptionCatalog.filter((item) => state.rentalOptions.has(item.id)).reduce((sum, item) => sum + item.price, 0); const total = state.rentalHours * vehicle.price + optionPrice; if (!state.routeStops.at(-1) || state.routeStops.length < 2) return toast("출발지와 목적지를 먼저 설정해 주세요."); openModal({ title: `${vehicle.name} ${state.rentalHours}시간 렌트`, body: `<p>${escapeHtml(state.pickupLocation)}으로 차량을 배정합니다. 예상 요금은 ${total.toLocaleString("ko-KR")}원이며 선택 옵션 ${state.rentalOptions.size}개가 적용됩니다.</p>`, iconName: "key", primary: "예약", onConfirm: () => { state.tripActive = true; state.homeStep = "service"; state.usageStartedAt = Date.now(); state.rentalEndsAt = state.usageStartedAt + state.rentalHours * 3600000; persist(); render(); toast("렌트 차량이 출발지로 이동 중이에요."); } }); }
  if (action === "finish-trip") openEndConfirmation();
  if (action === "ai-sub") { state.aiSub = value; state.personaMenuOpen = false; state.aiHistoryDetailId = null; render(); }
  if (action === "persona-menu") { state.personaMenuOpen = !state.personaMenuOpen; render(); }
  if (action === "persona") setAiPersona(value);
  if (action === "starter-prompt") sendMessage(value || "");
  if (action === "voice-toggle") { if (state.aiStatus === "listening") { stopVoiceConversation(); } else startVoiceConversation(); }
  if (action === "ai-restart") { state.aiStatus = "idle"; state.aiVoiceEnabled = true; persist(); render(); toast("루나를 다시 시작했어요."); }
  if (action === "ai-power") {
    const turningOn = state.aiStatus === "off";
    state.aiStatus = turningOn ? "idle" : "off";
    state.aiVoiceEnabled = turningOn; // 루나 on/off와 음성은 기본적으로 함께 움직임
    if (!turningOn) stopVoiceConversation("off"); else render();
    persist();
    toast(turningOn ? "루나를 다시 시작했어요." : "루나를 종료했어요.");
  }
  if (action === "ai-voice-setting") { state.aiVoiceEnabled = !state.aiVoiceEnabled; if (!state.aiVoiceEnabled && state.aiStatus === "listening") stopVoiceConversation(); persist(); render(); toast(state.aiVoiceEnabled ? "음성으로 대화할 수 있어요." : "음성을 껐어요. 이제 텍스트로만 대화해요."); }
  if (action === "ai-autostart-setting") { state.aiAutoStart = !state.aiAutoStart; persist(); render(); toast(state.aiAutoStart ? "승차 후 자동 시작을 켰어요." : "승차 후 자동 시작을 껐어요."); }
  if (action === "ai-save-setting") {
    if (!state.aiSaveEnabled) openAiSaveConsent();
    else { state.aiSaveEnabled = false; persist(); render(); toast("대화 기록 저장을 껐어요."); }
  }
  if (action === "crisis-close") { state.aiCrisisOpen = false; render(); }
  if (action === "crisis-call") toast("프로토타입에서는 전화 연결 대신 안내만 표시해요. 실제 상황에서는 1393 또는 119에 연락해 주세요.");
  if (action === "chat-expand") { state.aiChatExpanded = !state.aiChatExpanded; persist(); render(); }
  if (action === "font-size") { state.chatFontScale = Math.min(1.3, Math.max(0.85, state.chatFontScale + Number(value) * 0.12)); persist(); applyChatFontScale(); }
  if (action === "open-thread-detail") { state.aiHistoryDetailId = value; render(); }
  if (action === "close-thread-detail") { state.aiHistoryDetailId = null; render(); }
  if (action === "delete-thread") { openDeleteThreadConfirm(value); }
  if (action === "resume-thread" || action === "open-thread") { state.activeThreadId = value; state.aiSub = "talk"; persist(); render(); toast("최근 대화를 이어갑니다."); }
  if (action === "space-sub") { state.spaceSub = value; render(); }
  if (action === "purchase-sub") { state.purchaseSub = value; render(); }
  if (action === "product-category") { state.productCategory = value; render(); }
  if (action === "like-product") { state.productLikes.has(value) ? state.productLikes.delete(value) : state.productLikes.add(value); persist(); render(); toast(state.productLikes.has(value) ? "관심 목록에 저장했어요." : "관심 목록에서 삭제했어요."); }
  if (action === "product-detail") { const product = products.find((item) => item.id === value); if (product) openProductDetail(product, true); }
  if (action === "detail-qty-minus" || action === "detail-qty-plus") { const product = products.find((item) => item.id === value); if (product) { state.productDetailQty = Math.min(product.stock, Math.max(1, state.productDetailQty + (action === "detail-qty-plus" ? 1 : -1))); openProductDetail(product, false, state.productDetailMode === "compact"); } }
  if (action === "add-product") { const product = products.find((item) => item.id === value); if (product) openProductDetail(product, true, true); }
  if (action === "cart-minus") changeCart(value, -1);
  if (action === "cart-plus") changeCart(value, 1);
  if (action === "cart-remove") removeFromCart(value);
  if (action === "checkout") openModal({ title: "등록 카드로 결제할까요?", body: `<p>총 ${cartCount()}개 상품을 결제합니다. 완료 후 좌석 오른쪽 수납함이 자동으로 열리고 구매 내역에 저장됩니다.</p>`, iconName: "bag", primary: "결제하기", secondary: "취소", onConfirm: completeCheckout });
  if (action === "order-detail") openOrderDetail(value);
  if (action === "toggle") { button.classList.toggle("on"); toast(button.classList.contains("on") ? "연결했어요." : "연결을 해제했어요."); }
  if (action === "play-ott") toast("차량 디스플레이에서 재생을 시작했어요.");
  if (action === "outing-sub") { state.outingSub = value; render(); }
  if (action === "toggle-outing-map") { state.outingMapOpen = !state.outingMapOpen; state.outingSub = "recommend"; persist(); render(); }
  if (action === "outing-map-reset") { state.outingMapOpen = true; render(); requestAnimationFrame(() => initOutingMap()); }
  if (action === "outing-filter") { state.outingFilters[button.dataset.filter] = value; state.outingMapOpen = true; persist(); render(); }
  if (action === "map-course-focus") { const course = getCourse(value); if (course) { state.courseDraft.title = course.name; state.courseDraft.desc = course.desc; state.courseDraft.stops = course.stops.map((name, index) => ({ type: index === course.stops.length - 1 ? "목적지" : "경유지", name, photo: course.stopDetails?.[index]?.photo || null })); state.outingSub = "register"; persist(); render(); toast("선택한 코스를 코스 등록 화면에 불러왔어요."); } }
  if (action === "course-sort") { state.outingSort = value; persist(); render(); }
  if (action === "course-detail") { const course = getCourse(value); if (course) openCourseDetail(course); }
  if (action === "course-stop-detail") { const course = state.activeDetailCourse; if (course) openCourseStopDetail(course, Number(value)); }
  if (action === "course-save") { state.savedCourseIds.has(value) ? state.savedCourseIds.delete(value) : state.savedCourseIds.add(value); persist(); render(); toast(state.savedCourseIds.has(value) ? "관심 코스에 저장했어요." : "관심 코스에서 삭제했어요."); }
  if (action === "course-like") { state.likedCourseIds.has(value) ? state.likedCourseIds.delete(value) : state.likedCourseIds.add(value); persist(); render(); toast(state.likedCourseIds.has(value) ? "코스에 좋아요를 남겼어요." : "좋아요를 취소했어요."); }
  if (action === "follow-course") { const course = getCourse(value); if (course) useCourseForHome(course); }
  if (action === "chip") { button.parentElement.querySelectorAll("button").forEach((item) => item.classList.remove("selected")); button.classList.add("selected"); }
  if (action === "recommend-course") openCourseDetail(buildAiRecommendedCourse());
  if (action === "course-source") { state.courseSource = value; render(); }
  if (action === "use-history-route") { const route = historyRoutes.find((item) => item.id === value); if (route) { state.courseDraft.title = route.name; state.courseDraft.desc = `${route.meta} 이동 기록에서 만든 코스입니다.`; state.courseDraft.stops = route.stops.map((name, index) => ({ type: index === route.stops.length - 1 ? "목적지" : "경유지", name, photo: null })); render(); toast("이용 기록을 불러왔어요."); } }
  if (action === "add-course-stop") { const destinationIndex = state.courseDraft.stops.findIndex((stop) => stop.type === "목적지"); state.courseDraft.stops.splice(destinationIndex < 0 ? state.courseDraft.stops.length : destinationIndex, 0, { type: "경유지", name: "", photo: null }); render(); }
  if (action === "remove-course-stop") { if (state.courseDraft.stops.length <= 1) return toast("장소는 한 곳 이상 필요해요."); state.courseDraft.stops.splice(Number(value), 1); render(); }
  if (action === "move-stop-up") moveCourseStop(Number(value), -1);
  if (action === "move-stop-down") moveCourseStop(Number(value), 1);
  if (action === "preview-course") previewCourse();
  if (action === "publish-course") publishCourse();
  if (action === "edit-profile") openProfileEditor();
  if (action === "open-theme") openThemeSettings();
  if (action === "theme-choice") { state.pendingTheme = value; document.querySelectorAll('[data-action="theme-choice"]').forEach((item) => item.classList.toggle("active", item === button)); const preview = document.querySelector("#theme-example-image"); const label = document.querySelector("#theme-example-label"); const livePreview = document.querySelector("#cabin-live-image"); const liveLabel = document.querySelector("#cabin-live-label"); if (preview) { preview.src = themeAssets[value]; preview.alt = `${value} 공간 테마 예시`; } if (label) label.textContent = `${value} 모드 미리보기`; if (livePreview) livePreview.src = themeAssets[value]; if (liveLabel) liveLabel.textContent = `${value} 모드 미리보기`; }
  if (action === "open-interest") { state.outingSub = "interest"; setTab("outing"); }
  if (action === "profile-section") { state.profileView = value; render(); content.scrollTop = 0; }
  if (action === "profile-back") { state.profileView = "menu"; render(); }
  if (action === "home-notices") { state.profileView = "notices"; setTab("profile"); }
  if (action === "logout") { state.isAuthenticated = false; persist(); closeModal(); showScreen("login"); document.querySelector("#user-password").value = ""; toast("로그아웃했어요."); }
  if (action === "notice-detail") openModal({ title: button.dataset.title, body: `<p>${escapeHtml(button.dataset.text)}</p>`, iconName: "bell", primary: "확인", secondary: null });
  if (action === "usage-detail") openUsageDetail(value);
  if (action === "payment-add") openPaymentEditor();
  if (action === "payment-primary") { state.paymentCards.forEach((card) => { card.primary = card.id === value; }); persist(); render(); toast("기본 결제수단을 변경했어요."); }
  if (action === "payment-remove") { const target = state.paymentCards.find((card) => card.id === value); if (!target || state.paymentCards.length === 1) return toast("결제수단은 한 개 이상 필요해요."); openModal({ title: "결제수단을 삭제할까요?", body: `<p>${escapeHtml(target.name)} ${escapeHtml(target.number)} 카드를 삭제합니다.</p>`, iconName: "card", primary: "삭제", secondary: "취소", onConfirm: () => { const wasPrimary = target.primary; state.paymentCards = state.paymentCards.filter((card) => card.id !== value); if (wasPrimary && state.paymentCards[0]) state.paymentCards[0].primary = true; persist(); render(); toast("결제수단을 삭제했어요."); } }); }
  if (action === "policy-detail") openPolicyDetail(value);
  if (action === "check-update") toast("현재 최신 버전을 사용 중이에요.");
  if (action === "license-info") openModal({ title: "오픈소스 라이선스", body: "<p>프로토타입에 사용된 오픈소스 구성요소의 라이선스는 정식 배포 시 앱 설정에서 제공합니다.</p>", iconName: "space", secondary: null });
  if (action === "menu-info") openModal({ title: value, body: `<p>${value} 상세 화면은 서비스 정책과 연결되는 프로토타입 영역입니다.</p>`, iconName: "user", secondary: null });
});

function addToCart(id) { const product = products.find((item) => item.id === id); if (!product?.stock) return toast("현재 차량에는 상품 재고가 없어요."); const line = state.cart.find((item) => item.id === id); if (line && line.qty >= product.stock) return toast("현재 차량의 재고 수량을 모두 담았어요."); if (line) line.qty += 1; else state.cart.push({ id, qty: 1 }); persist(); render(); toast("장바구니에 담았어요."); }
function changeCart(id, delta) { const line = state.cart.find((item) => item.id === id); const product = products.find((item) => item.id === id); if (!line || !product) return; if (delta > 0 && line.qty >= product.stock) return toast("현재 차량의 재고 수량을 모두 담았어요."); line.qty += delta; if (line.qty <= 0) state.cart = state.cart.filter((item) => item.id !== id); persist(); render(); }
function removeFromCart(id) { const product = products.find((item) => item.id === id); state.cart = state.cart.filter((item) => item.id !== id); persist(); render(); toast(`${product ? product.name : "상품"}을 장바구니에서 삭제했어요.`); }

function setCartQuantity(id, qty) {
  const product = products.find((item) => item.id === id);
  if (!product?.stock) return false;
  const safeQty = Math.min(product.stock, Math.max(1, Number(qty) || 1));
  const line = state.cart.find((item) => item.id === id);
  if (line) line.qty = safeQty;
  else state.cart.push({ id, qty: safeQty });
  persist(); render(); toast(`${product.name} ${safeQty}개를 장바구니에 담았어요.`);
}

function moveCourseStop(index, direction) {
  const waypointIndexes = state.courseDraft.stops.map((stop, stopIndex) => stop.type !== "목적지" ? stopIndex : -1).filter((stopIndex) => stopIndex >= 0);
  const current = waypointIndexes.indexOf(index);
  const target = waypointIndexes[current + direction];
  if (current < 0 || target === undefined) return;
  [state.courseDraft.stops[index], state.courseDraft.stops[target]] = [state.courseDraft.stops[target], state.courseDraft.stops[index]];
  render();
}

function getDraftCourse() {
  const titleText = state.courseDraft.title.trim();
  const validStops = state.courseDraft.stops.filter((stop) => stop.name.trim());
  if (!titleText || !validStops.length) {
    openModal({ title: "필수 정보를 확인해 주세요", body: "<p>코스 제목과 최종 목적지를 입력해 주세요.</p>", iconName: "pin", secondary: null });
    return null;
  }
  const destinations = validStops.filter((stop) => stop.type === "목적지");
  if (destinations.length !== 1 || validStops.at(-1).type !== "목적지") {
    openModal({ title: "목적지는 마지막 한 곳만 필요해요", body: "<p>최종 목적지 한 곳을 이동 순서의 마지막에 두고 나머지 장소는 경유지로 등록해 주세요.</p>", iconName: "pin", secondary: null });
    return null;
  }
  return { titleText, validStops };
}

function previewCourse() {
  const draft = getDraftCourse();
  if (!draft) return;
  const { titleText, validStops } = draft;
  const cover = validStops.find((stop) => stop.photo)?.photo;
  const stops = validStops.map((stop, index) => `<div class="course-detail-stop"><span>${index + 1}</span><div><strong>${escapeHtml(stop.name)}</strong><small>${stop.type === "목적지" ? "최종 목적지" : `경유지 ${index + 1}`}</small></div></div>`).join("");
  openModal({ title: "등록 전 코스 미리보기", iconName: "compass", body: `${cover ? `<div class="detail-cover"><img src="${cover}" alt="${escapeHtml(titleText)} 대표 이미지" /></div>` : `<div class="course-preview-empty">${icon("image")}<span>등록된 장소 이미지가 없어요</span></div>`}<h4 class="preview-title">${escapeHtml(titleText)}</h4><p>${escapeHtml(state.courseDraft.desc.trim() || "내 이동 경험으로 등록한 코스")}</p><div class="course-detail-map"><img src="./assets/map-seoul.jpg" alt="서울시 코스 미리보기 지도" /><svg viewBox="0 0 320 150" preserveAspectRatio="none" aria-hidden="true"><path d="M30 120 C80 30 128 118 176 62 S255 35 292 28" /><circle cx="30" cy="120" r="7" /><circle cx="176" cy="62" r="7" /><circle cx="292" cy="28" r="8" /></svg><span>등록 예정 이동 경로</span></div><div class="detail-stop-list">${stops}</div>`, primary: "미리보기 확인", secondary: null });
}

function publishCourse() {
  const draft = getDraftCourse();
  if (!draft) return;
  const { titleText, validStops } = draft;
  const course = { id: `mine-${Date.now()}`, author: state.username, name: titleText, desc: state.courseDraft.desc.trim() || "내 이동 경험으로 등록한 코스", image: validStops.find((stop) => stop.photo)?.photo || null, time: `${validStops.length}곳 · 나의 코스`, stops: validStops.map((stop) => stop.name), dwell: validStops.map(() => "60분"), distance: 0, likes: 0, createdAt: new Date().toISOString().slice(0, 10), recommend: "각 장소의 운영시간을 확인하고 여유 있게 이동해 보세요.", stopDetails: validStops.map((stop) => ({ type: stop.type, name: stop.name, photo: stop.photo || null })), tagProfile: { category: [state.outingFilters.category].filter((item) => item && item !== "전체"), mood: [state.outingFilters.mood].filter((item) => item && item !== "전체"), companion: [state.outingFilters.companion].filter((item) => item && item !== "전체"), purpose: [state.outingFilters.purpose].filter((item) => item && item !== "전체"), time: [state.outingFilters.time].filter((item) => item && item !== "전체"), price: Number(state.outingFilters.budget || 30000) }, visual: "" };
  state.customCourses.unshift(course); state.savedCourseIds.add(course.id); state.courseDraft = { title: "", desc: "", stops: [{ type: "경유지", name: "", photo: null }, { type: "목적지", name: "", photo: null }] }; state.outingSub = "interest"; persist(); render(); toast("내 코스를 관심 코스에 등록했어요.");
}

function currentUsageFee() {
  if (!state.tripActive || !state.usageStartedAt) return 0;
  const elapsedHours = Math.max(0, Date.now() - state.usageStartedAt) / 3600000;
  if (state.homeMode === "rent") {
    const vehicle = rentalVehicles.find((item) => item.id === state.rentalVehicleType) || rentalVehicles[0];
    const optionPrice = rentalOptionCatalog.filter((item) => state.rentalOptions.has(item.id)).reduce((sum, item) => sum + item.price, 0);
    return Math.round((elapsedHours * vehicle.price + optionPrice) / 100) * 100;
  }
  return Math.round((4800 + elapsedHours * 25800) / 100) * 100;
}

function openVehicleStatus() {
  const vehicle = state.homeMode === "rent" ? (rentalVehicles.find((item) => item.id === state.rentalVehicleType)?.name || "MOOV 컴팩트") : "MOOV 택시";
  const proof = state.securityProof;
  openModal({ title: state.tripActive ? "이용 중인 무인차" : "배차 가능한 무인차", iconName: "car", body: `<div class="vehicle-status-card"><div class="receipt-info"><span>차량</span><strong>${escapeHtml(vehicle)}</strong><span>차량 번호</span><strong>MOOV 24</strong><span>충전량</span><strong>78%</strong><span>현재 사용 요금</span><strong data-live-fee>${currentUsageFee().toLocaleString("ko-KR")}원</strong></div><div class="security-gate ${proof ? "verified" : ""}">${icon("shield")}<span><strong>${proof ? "이전 세션 삭제 검증 완료" : "보안 게이트 통과"}</strong><small>${proof ? `${escapeHtml(proof.reference)} · 잔존 0건` : "배차 전 차량 내부 기록 정리를 확인했어요."}</small></span></div></div>`, primary: "확인", secondary: null });
}

function openEndConfirmation() {
  const modeLabel = state.homeMode === "rent" ? "렌트" : "택시";
  openModal({
    title: `${modeLabel} 이용을 종료할까요?`,
    iconName: "shield",
    body: `<p>안전한 장소에 정차한 뒤 개인 기록 정리를 시작합니다. 정리가 끝나기 전에는 다음 이용자에게 차량이 배정되지 않습니다.</p><div class="security-scope"><div><strong>차량에서 삭제</strong><span>로그인 토큰, 블루투스·USB·미러링 연결, OTT 세션, 음성 버퍼, 검색·경로 캐시, 임시 공간 설정</span></div><div><strong>계정·서버에 보존</strong><span>결제 영수증, 법정 사고 증적, 동의한 관심 목록과 이용 기록</span></div></div><details class="security-exceptions"><summary>예외 상황과 처리 기준</summary><ul><li>주행 중이면 안전 정차 후 자동으로 시작합니다.</li><li>통신이 끊겨도 차량 로컬 정리는 계속하고 복구 후 결과를 확정합니다.</li><li>전원이 중단되면 재부팅 후 미완료 단계부터 재개합니다.</li><li>연결 잔존이나 삭제 증명 불일치 시 차량을 안전 모드로 격리하고 추가 요금 없이 인계를 보류합니다.</li></ul></details>`,
    primary: "종료 및 정리 시작",
    secondary: "계속 이용",
    onConfirm: () => { runSecureCleanup(state.homeMode); return false; },
  });
}

function setSecurityProgress(titleText, percent, activeIndex, message) {
  document.querySelector("#modal-title").textContent = titleText;
  document.querySelector("#modal-body").innerHTML = `<div class="security-progress"><div class="security-progress-head"><strong>${percent}%</strong><span>${escapeHtml(message)}</span></div><div class="security-progress-bar"><i style="width:${percent}%"></i></div><div class="security-steps">${["접근 차단", "기록 삭제", "잔존 검증"].map((step, index) => `<span class="${index < activeIndex ? "done" : index === activeIndex ? "active" : ""}">${icon(index < activeIndex ? "shield" : "clock")}<strong>${step}</strong></span>`).join("")}</div><p>앱을 닫아도 차량 내부 정리는 계속됩니다. 서버 연결이 지연되면 차량은 배차되지 않고 안전 모드로 유지됩니다.</p></div>`;
  document.querySelector("#modal-actions").innerHTML = `<button class="primary-button" disabled>개인정보 정리 중</button>`;
}

function runSecureCleanup(mode) {
  if (!state.tripActive && !state.securityEnding) return;
  state.securityEnding = true;
  if (speechRecognition) { speechRecognition.abort(); speechRecognition = null; }
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  setSecurityProgress("차량 기록을 정리하고 있어요", 18, 0, "신규 인증과 외부 연결을 차단했습니다.");
  setTimeout(() => setSecurityProgress("차량 기록을 정리하고 있어요", 56, 1, "개인 데이터와 연결 정보를 삭제하고 있습니다."), 700);
  setTimeout(() => setSecurityProgress("삭제 결과를 확인하고 있어요", 84, 2, "잔존 데이터 0건과 차량 상태를 검증합니다."), 1400);
  setTimeout(() => completeSecureCleanup(mode), 2200);
}

function completeSecureCleanup(mode) {
  notifyRideEndSaveStatus();
  const completedAt = new Date();
  const reference = `ZT-${String(completedAt.getTime()).slice(-8)}`;
  state.securityProof = { reference, completedAt: completedAt.toISOString(), mode, wipedTargets: 7, retainedTargets: 3 };
  state.tripActive = false;
  state.usageStartedAt = null;
  state.rentalEndsAt = null;
  state.securityEnding = false;
  state.homeStep = "mode";
  state.locationReady = false;
  state.pickupLocation = "현재 위치 · 서울 성수동";
  state.routeStops = [state.pickupLocation];
  state.selectedCourse = null;
  state.returnToHomeAfterCourse = false;
  state.cart = [];
  state.aiStatus = "idle";
  state.chatThreads = [{ id: `thread-${Date.now()}`, title: "새 대화", updated: "방금 전", persona: state.aiPersona, messages: [{ role: "ai", text: "안녕하세요. 새 차량 세션에서 무엇을 함께 이야기해볼까요?" }] }];
  state.activeThreadId = state.chatThreads[0].id;
  state.theme = "기본";
  state.themeConfig = { temperature: 22, tint: 60, light: "민트 앰비언트", privacy: true };
  persist();
  render();
  document.querySelector("#modal-title").textContent = "개인 기록 정리가 완료됐어요";
  document.querySelector("#modal-body").innerHTML = `<div class="security-complete"><span class="security-check">${icon("shield")}</span><strong>삭제 검증 PASS · 잔존 0건</strong><p>차량의 인증·연결·콘텐츠 흔적을 삭제하고 다음 이용자의 접근을 차단했습니다.</p><div class="receipt-info"><span>완료 시각</span><strong>${completedAt.toLocaleString("ko-KR")}</strong><span>확인 번호</span><strong>${reference}</strong><span>삭제 대상</span><strong>7개 범주</strong><span>서버 보존</span><strong>결제·법정 증적·동의 기록</strong></div><div class="policy-note">감사 기록에는 결과와 가명 세션만 남으며 원문 대화, 검색어, 토큰 값은 저장하지 않습니다.</div></div>`;
  document.querySelector("#modal-actions").innerHTML = `<button class="primary-button" data-action="close-modal">완료 확인</button>`;
}

modal.addEventListener("click", (event) => { if (event.target === modal) closeModal(); });
document.addEventListener("keydown", (event) => {
  if (getSearchStateKey(event.target.id)) {
    handleSearchKeydown(event);
    return;
  }
  if (event.key === "Escape") closeModal();
});

function applySearchSuggestion(button) {
  const inputId = button.dataset.input;
  const stateKey = getSearchStateKey(inputId);
  if (!stateKey) return;
  state[stateKey] = button.dataset.value || "";
  searchUi.inputId = null;
  searchUi.activeIndex = 0;
  render();
  const itemId = button.dataset.item;
  if (inputId === "product-search" && itemId) {
    const product = products.find((item) => item.id === itemId);
    if (product) openProductDetail(product, true, true);
  }
  if (inputId === "home-search") {
    const candidate = getSearchCandidates(inputId).find((item) => item.id === button.dataset.optionId);
    applyHomeSearchSelection(candidate, button.dataset.value || state.homeQuery);
  }
}

function applyHomeSearchSelection(candidate, fallbackValue) {
  const course = candidate?.itemId ? getCourse(candidate.itemId) : null;
  if (course && candidate.category === "코스") {
    state.selectedCourse = course;
    state.routeStops = [state.pickupLocation, ...course.stops];
    state.homeStep = "setup";
    persist();
    render();
    toast("검색한 코스를 목적지에 등록했어요.");
    return;
  }
  state.selectedCourse = null;
  state.routeStops = [state.pickupLocation, candidate?.queryValue || candidate?.name || fallbackValue || state.homeQuery];
  state.homeStep = "setup";
  persist();
  render();
  toast("검색한 장소를 목적지로 설정했어요.");
}

function handleSearchKeydown(event) {
  const inputId = event.target.id;
  const suggestions = getSearchSuggestions(inputId, state[getSearchStateKey(inputId)]);
  if (event.key === "Escape") {
    if (searchUi.inputId === inputId) {
      event.preventDefault();
      searchUi.inputId = null;
      render();
    } else closeModal();
    return;
  }
  if (!suggestions.length) return;
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    searchUi.inputId = inputId;
    searchUi.activeIndex = (searchUi.activeIndex + (event.key === "ArrowDown" ? 1 : -1) + suggestions.length) % suggestions.length;
    const cursor = event.target.selectionStart;
    render();
    const nextInput = document.querySelector(`#${inputId}`);
    if (nextInput) { nextInput.focus(); nextInput.setSelectionRange(cursor, cursor); }
    return;
  }
  if (event.key === "Enter" && searchUi.inputId === inputId) {
    event.preventDefault();
    const suggestion = suggestions[Math.min(searchUi.activeIndex, suggestions.length - 1)];
    if (!suggestion) return;
    state[getSearchStateKey(inputId)] = suggestion.queryValue || suggestion.name;
    searchUi.inputId = null;
    if (inputId === "home-search") {
      applyHomeSearchSelection(suggestion, state.homeQuery);
      return;
    }
    render();
  }
}

function updateClock() { document.querySelector("#clock").textContent = new Date().toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit", hour12: false }); }
updateClock(); setInterval(updateClock, 30000); setInterval(updateUsageTimer, 1000);
applyChatFontScale();
splashTimer = setTimeout(() => {
  if (state.isAuthenticated) {
    showScreen("app");
    setTab(state.activeTab || "home");
  } else {
    showScreen("login");
  }
}, 1200);
