// OTT 계정 상태와 이어보기 콘텐츠를 한 곳에서 관리합니다.
export const OTT_SERVICES = Object.freeze([
  { id: "netflix", name: "넷플릭스", logo: "N", logoClass: "netflix", loggedIn: true, connected: true },
  { id: "wavve", name: "웨이브", logo: "W", logoClass: "wavve", loggedIn: false, connected: false },
  { id: "disney", name: "디즈니 플러스", logo: "D+", logoClass: "disney", loggedIn: false, connected: true },
  { id: "youtube", name: "유튜브", logo: "▶", logoClass: "youtube", loggedIn: true, connected: false }
]);

export const CONTINUE_CONTENT = Object.freeze([
  { id: "city-night", source: "넷플릭스", sourceClass: "netflix", title: "도시의 밤", remaining: "28분 남음", progress: 42 },
  { id: "moving-day", source: "웨이브", sourceClass: "wavve", title: "무빙 데이", remaining: "16분 남음", progress: 68 },
  { id: "space-log", source: "디즈니+", sourceClass: "disney", title: "우주 항해 일지", remaining: "34분 남음", progress: 31 }
]);
