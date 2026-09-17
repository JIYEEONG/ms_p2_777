// 앱 전역 설정: 브랜드 문구, 기본값, 미디어 경로와 API 주소를 한 곳에서 관리합니다.
export const CONFIG = Object.freeze({
  appName: "MOOV Space",
  api: {
    useLiveData: false,
    baseUrl: "",
    endpoints: {
      vehicle: "/api/vehicle",
      vehicleState: "/api/vehicle/state"
    }
  },
  defaults: {
    windowTheme: "sky",
    windowBrightness: 72,
    windowWeather: 78,
    contentTab: "ott",
    primaryTab: "contents"
  },
  wellness: {
    // 실제 차량 미연결 상태는 null입니다. 사용자가 정차/주차 목록을 직접 미리 봅니다.
    mockVehicleState: null,
    preparationSeconds: 3,
    sideTransitionSeconds: 0
  },
  media: {
    cabinPreview: {
      src: "./assets/images/cabin/cabin-three-window.png",
      alt: "좌측·정면·우측 창문이 보이는 MOOV 무인차량 실내"
    },
    purchaseHero: {
      src: "./assets/images/purchase/cabin-market.png",
      alt: "자율주행 차량 실내에 준비된 생수와 간식 셀프서비스 보관함"
    },
    // Window 3면 이미지 경로는 이 목록 한 곳에서만 관리합니다.
    windowThemes: [
      {
        id: "forest",
        label: "Forest",
        mood: "숲길 속으로 걸어가는 몰입형 자연 테마",
        alt: "곧고 높은 나무 사이로 이어지는 울창한 숲길",
        screens: {
          left: "./assets/images/window/forest/forest_3_left.jpg",
          front: "./assets/images/window/forest/forest_1_front.jpg",
          right: "./assets/images/window/forest/forest_2_right.jpg"
        }
      },
      {
        id: "sea",
        label: "Sea",
        mood: "끊임없이 밀려오는 파도와 해변 사운드",
        alt: "같은 해안선으로 이어진 노을빛 바다",
        screens: {
          left: { type: "video", src: "./assets/video/sea/sea-left.mp4", poster: "./assets/images/window/sea/sea_3_left.jpg" },
          front: { type: "video", src: "./assets/video/sea/sea-front.mp4", poster: "./assets/images/window/sea/sea_2_front.jpg" },
          right: { type: "video", src: "./assets/video/sea/sea-right.mp4", poster: "./assets/images/window/sea/sea_1_right.jpg" }
        },
        ambient: "./assets/audio/sea-waves.mp3"
      },
      {
        id: "sky",
        label: "Sky",
        mood: "구름 위를 유영하듯 지나가는 하늘 테마",
        alt: "같은 고도와 조명으로 연결된 구름 바다",
        screens: {
          left: "./assets/images/window/sky/sky_3_left.jpg",
          front: "./assets/images/window/sky/sky_2_front.jpg",
          right: "./assets/images/window/sky/sky_1_right.jpg"
        }
      },
      {
        id: "private",
        label: "Space",
        mood: "어두운 우주 사진과 움직임 없는 휴식 테마",
        alt: "우주선에서 바라본 별빛 파노라마",
        screens: {
          left: "./assets/images/window/space/space-left.png",
          front: "./assets/images/window/space/space-front.png",
          right: "./assets/images/window/space/space-right.png"
        }
      }
    ],
    rainSound: "./assets/audio/sea-waves.mp3"
  }
});
