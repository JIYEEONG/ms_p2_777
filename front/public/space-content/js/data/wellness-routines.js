// 스트레칭은 8초, 요가는 10초 단위이며 좌·우는 각각 별도 구간으로 진행합니다.
const S = (id, title, image, bilateral, guide, caution, mirrorRight = false, durationSec = 8) => Object.freeze({
  id, title, image, bilateral, durationSec, guide, caution, mirrorRight
});
const Y = (id, title, image, bilateral, guide, caution, mirrorRight = false) => S(id, title, image, bilateral, guide, caution, mirrorRight, 10);

export const WELLNESS_STEPS = Object.freeze({
  neck: S("neck", "목 옆 늘리기", {
    left: "./assets/images/wellness/neck/neck_04.jpg",
    right: "./assets/images/wellness/neck/neck_02.jpg"
  }, true, "고개를 표시된 방향으로 천천히 기울여 목선을 늘려 주세요.", "어깨가 따라 올라가지 않게 합니다."),
  shoulder: S("shoulder", "팔·어깨 당기기", "./assets/images/wellness/shoulder/arm-shoulder-pull-v2.png", true, "한 팔을 가슴 앞으로 보내 반대 손으로 부드럽게 당겨 주세요.", "팔꿈치나 어깨에 통증이 생기면 범위를 줄입니다.", true),
  chest: S("chest", "가슴·어깨 열기", "./assets/images/wellness/shoulder/shoulder_03.jpg", true, "팔꿈치를 양옆으로 열며 가슴과 어깨 앞쪽을 펴 주세요.", "허리를 과하게 젖히지 않습니다."),
  pelvis: S("pelvis", "골반 앞뒤 기울이기", "./assets/images/wellness/lower-body/stretch_01_pelvic_tilt.png", false, "좌석에 앉아 골반을 작게 앞뒤로 움직여 주세요.", "허리를 크게 꺾지 않습니다."),
  knee: S("knee", "한쪽 무릎 당기기", "./assets/images/wellness/lower-body/stretch_02_knee_to_chest.png", true, "한쪽 무릎을 가슴 방향으로 천천히 당겨 주세요.", "사타구니나 허리가 불편하면 멈춥니다."),
  torso: S("torso", "몸통 회전", "./assets/images/wellness/lower-body/stretch_03_torso_rotation.png", true, "골반은 정면에 두고 몸통만 천천히 돌려 주세요.", "반동을 주지 않습니다."),
  hip: S("hip", "둔근 스트레칭", "./assets/images/wellness/lower-body/stretch_05_glute.png", true, "발목을 반대쪽 무릎 위에 올리고 상체를 천천히 기울여 주세요.", "무릎을 억지로 누르지 않습니다."),
  side: S("side", "허리 측면·전신 이완", "./assets/images/wellness/lower-body/stretch_07_side_body.png", true, "한 팔을 머리 위로 올리고 몸통을 반대쪽으로 기울여 주세요.", "상체가 앞뒤로 쏠리지 않게 합니다."),
  hamstring: S("hamstring", "햄스트링 스트레칭", "./assets/images/wellness/lower-body/stretch_06_hamstring.png", true, "한쪽 다리를 펴고 골반부터 앞으로 기울여 주세요.", "허리를 심하게 둥글게 말지 않습니다."),
  hipFlexor: S("hip-flexor", "고관절 앞쪽 스트레칭", "./assets/images/wellness/lower-body/stretch_04_hip_flexor.png", true, "한쪽 다리를 뒤로 보내 골반을 천천히 앞으로 이동해 주세요.", "주차 중 넓은 공간에서만 진행합니다."),
  yogaMountain: Y("yoga-mountain", "앉은 산 자세", "./assets/images/wellness/yoga/seated-mountain.webp", false, "등받이에서 등을 살짝 떼고 척추를 길게 세운 채 천천히 호흡하세요.", "어깨에 힘을 빼고 발바닥을 바닥에 둡니다."),
  yogaCatCow: Y("yoga-cat-cow", "앉은 고양이·소 자세", "./assets/images/wellness/yoga/seated-cat-cow.webp", false, "숨을 들이마시며 가슴을 열고 내쉬며 등을 부드럽게 둥글게 만드세요.", "허리를 과하게 꺾지 말고 작은 범위로 움직입니다."),
  yogaSideBend: Y("yoga-side-bend", "앉은 측면 늘리기", "./assets/images/wellness/yoga/seated-side-bend.webp", true, "한 손으로 좌석을 지지하고 반대 팔을 머리 위로 뻗어 옆구리를 늘리세요.", "몸통이 앞쪽으로 기울지 않게 합니다.", true),
  yogaTwist: Y("yoga-twist", "앉은 척추 비틀기", "./assets/images/wellness/yoga/seated-twist.webp", true, "골반은 정면에 두고 손으로 무릎을 지지하며 몸통을 천천히 돌리세요.", "목부터 억지로 돌리지 않습니다.", true),
  yogaWarrior: Y("yoga-warrior", "전사 자세 2", "./assets/images/wellness/yoga/warrior-two.webp", true, "양팔을 수평으로 펴고 앞무릎을 발목 방향으로 굽혀 시선은 앞손 끝을 향하세요.", "앞무릎이 발끝보다 안쪽으로 무너지지 않게 합니다.", true),
  yogaTree: Y("yoga-tree", "나무 자세", "./assets/images/wellness/yoga/tree-pose.webp", true, "한 발에 체중을 싣고 반대 발을 무릎 아래에 댄 뒤 가슴 앞에서 손을 모으세요.", "균형이 불안하면 좌석이나 손잡이를 잡습니다.", true),
  yogaChair: Y("yoga-chair", "의자 자세", "./assets/images/wellness/yoga/chair-pose.webp", false, "엉덩이를 뒤로 보내 무릎을 굽히고 팔을 머리 위로 길게 뻗으세요.", "무릎이 발끝보다 과하게 앞으로 나가지 않게 합니다."),
  yogaHighLunge: Y("yoga-high-lunge", "하이 런지", "./assets/images/wellness/yoga/high-lunge.webp", true, "앞무릎을 발목 위에 두고 뒤꿈치를 든 채 두 팔을 위로 뻗으세요.", "골반은 정면을 유지하고 보폭을 무리하게 넓히지 않습니다.", true),
  yogaReverseWarrior: Y("yoga-reverse-warrior", "리버스 워리어", "./assets/images/wellness/yoga/reverse-warrior.webp", true, "앞무릎을 굽힌 상태에서 앞쪽 팔을 위와 뒤로 길게 뻗으세요.", "허리를 꺾기보다 옆구리를 길게 늘립니다.", true),
  yogaTriangle: Y("yoga-triangle", "삼각 자세", "./assets/images/wellness/yoga/triangle-pose.webp", true, "두 다리를 편 상태에서 몸통을 옆으로 기울이고 가슴을 열어 주세요.", "아래 손으로 무릎을 누르지 않습니다.", true),
  yogaHalfMoon: Y("yoga-half-moon", "반달 자세", "./assets/images/wellness/yoga/half-moon.webp", true, "한 손을 블록에 가볍게 대고 반대 다리를 들어 몸통과 일직선으로 만드세요.", "균형이 흔들리면 좌석 가까이에서 진행합니다.", true),
  yogaDancer: Y("yoga-dancer", "무용수 자세", "./assets/images/wellness/yoga/dancer-pose.webp", true, "한 발로 서서 반대 발목을 잡고 상체를 앞으로 보내며 팔을 뻗으세요.", "허리를 과하게 젖히지 말고 고정물을 가까이 둡니다.", true),
  yogaEightAngle: Y("yoga-eight-angle", "팔각 자세", "./assets/images/wellness/yoga/eight-angle-pose.webp", true, "두 손으로 바닥을 밀어 골반을 들고, 두 다리를 한쪽 위팔에 걸어 옆으로 길게 뻗으세요.", "고급 수련자만 주차된 차량의 넓은 바닥에서 매트를 깔고 진행하세요. 손목이나 어깨가 불편하면 즉시 중단합니다.", true)
});

const P = (id, name, subtitle, states, stepIds, activity = "stretch", difficulty = null) => Object.freeze({ id, name, subtitle, states, stepIds, activity, difficulty });
export const WELLNESS_PROGRAMS = Object.freeze([
  P("stopped-all", "전체", "정차중 모든 프로그램 이어서 진행", ["stopped"], ["neck", "shoulder", "chest", "pelvis", "knee", "torso", "hip", "side", "hamstring"]),
  P("parked-all", "전체", "주차중 모든 프로그램 이어서 진행", ["parked"], ["neck", "shoulder", "chest", "pelvis", "knee", "torso", "hip", "side", "hamstring", "hipFlexor", "hip", "hamstring"]),
  P("upper", "목어깨", "목·팔·어깨 48초", ["stopped", "parked"], ["neck", "shoulder", "chest"]),
  P("pelvis-knee", "골반무릎", "골반·무릎·몸통 40초", ["stopped", "parked"], ["pelvis", "knee", "torso"]),
  P("hip-back", "엉덩이허리", "엉덩이·허리·다리 48초", ["stopped", "parked"], ["hip", "side", "hamstring"]),
  P("hip-care", "고관절", "주차 중 하체 48초", ["parked"], ["hipFlexor", "hip", "hamstring"]),
  P("yoga-stopped-all", "전체", "정차중 좌석 요가 모두 이어서 진행", ["stopped"], ["yogaMountain", "yogaCatCow", "yogaSideBend", "yogaTwist"], "yoga"),
  P("yoga-breath", "호흡·정렬", "앉아서 호흡과 척추 정렬", ["stopped"], ["yogaMountain", "yogaCatCow", "yogaMountain", "yogaCatCow"], "yoga"),
  P("yoga-seated-flow", "좌석 요가", "측면과 척추를 부드럽게 이완", ["stopped"], ["yogaSideBend", "yogaTwist", "yogaSideBend", "yogaTwist"], "yoga"),
  P("yoga-parked-all", "전체", "주차중 요가 전체 코스", ["parked"], ["yogaMountain", "yogaCatCow", "yogaSideBend", "yogaTwist", "yogaChair", "yogaWarrior", "yogaHighLunge", "yogaReverseWarrior", "yogaTriangle", "yogaTree", "yogaHalfMoon", "yogaDancer", "yogaEightAngle"], "yoga", "all"),

  P("yoga-low-foundation", "기초 밸런스 플로우", "정렬과 균형을 차분히 연결", ["parked"], ["yogaMountain", "yogaCatCow", "yogaSideBend", "yogaTwist", "yogaMountain", "yogaCatCow", "yogaSideBend", "yogaTwist"], "yoga", "low"),
  P("yoga-low-mobility", "전신 가동성 플로우", "척추와 옆선을 부드럽게 깨우기", ["parked"], ["yogaCatCow", "yogaSideBend", "yogaTwist", "yogaChair", "yogaMountain", "yogaCatCow", "yogaSideBend", "yogaTwist", "yogaChair"], "yoga", "low"),
  P("yoga-low-standing", "스탠딩 입문 플로우", "서 있는 자세의 기본 흐름", ["parked"], ["yogaMountain", "yogaChair", "yogaWarrior", "yogaTriangle", "yogaMountain", "yogaChair", "yogaWarrior", "yogaTriangle"], "yoga", "low"),

  P("yoga-mid-warrior", "워리어 시퀀스", "전사 자세를 연결하는 하체 강화", ["parked"], ["yogaHighLunge", "yogaWarrior", "yogaReverseWarrior", "yogaTriangle", "yogaChair", "yogaTree", "yogaMountain"], "yoga", "mid"),
  P("yoga-mid-balance", "밸런스 시퀀스", "한 발 균형과 코어 집중", ["parked"], ["yogaChair", "yogaTree", "yogaHalfMoon", "yogaDancer", "yogaMountain", "yogaChair", "yogaTree", "yogaMountain"], "yoga", "mid"),
  P("yoga-mid-strength", "하체 근력 플로우", "런지와 스탠딩 자세의 연속", ["parked"], ["yogaChair", "yogaChair", "yogaHighLunge", "yogaWarrior", "yogaTriangle", "yogaReverseWarrior", "yogaTree"], "yoga", "mid"),
  P("yoga-mid-endurance", "스탠딩 인듀어런스", "스탠딩 자세를 길게 이어가는 코스", ["parked"], ["yogaChair", "yogaChair", "yogaHighLunge", "yogaWarrior", "yogaReverseWarrior", "yogaTriangle", "yogaTree"], "yoga", "mid"),

  P("yoga-high-power", "파워 밸런스", "근력과 암밸런스를 끊김 없이 연결", ["parked"], ["yogaChair", "yogaHighLunge", "yogaHalfMoon", "yogaDancer", "yogaEightAngle", "yogaTree", "yogaWarrior", "yogaMountain"], "yoga", "high"),
  P("yoga-high-peak", "피크 포즈 플로우", "팔각 자세까지 이어지는 고난도 흐름", ["parked"], ["yogaHighLunge", "yogaWarrior", "yogaReverseWarrior", "yogaTriangle", "yogaHalfMoon", "yogaDancer", "yogaEightAngle"], "yoga", "high"),
  P("yoga-high-arm-balance", "암 밸런스 마스터", "팔각 자세 중심의 최상급 근력·균형 코스", ["parked"], ["yogaEightAngle", "yogaHalfMoon", "yogaDancer", "yogaEightAngle", "yogaTree", "yogaEightAngle"], "yoga", "high")
]);

export const WELLNESS_SAFETY_NOTICES = Object.freeze([
  "가볍게 당기는 정도까지만 진행하세요.",
  "저림·날카로운 통증·어지럼이 있으면 즉시 중단하세요.",
  "차량이 이동을 시작하면 프로그램이 즉시 정지됩니다."
]);
