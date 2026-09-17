const CACHE = "moov-space-v34";
const SHELL = [
  "./", "./index.html", "./asset-library.html", "./manifest.webmanifest", "./css/app.css", "./css/wellness.css",
  "./js/app.js", "./js/config.js", "./js/core/ui.js", "./js/services/data-service.js",
  "./js/core/cabin-preview.js",
  "./js/data/space-content.js", "./js/data/wellness-routines.js",
  "./js/modes/purchase.js", "./js/modes/contents.js", "./js/modes/wellness.js", "./js/modes/window.js",
  "./assets/images/purchase/cabin-market.png",
  "./assets/images/cabin/cabin-three-window.png",
  "./assets/images/window/theme-sky.png", "./assets/images/window/theme-forest.png",
  "./assets/images/window/theme-sea.png", "./assets/images/window/theme-park.png",
  "./assets/images/window/forest/forest_3_left.jpg", "./assets/images/window/forest/forest_1_front.jpg",
  "./assets/images/window/forest/forest_2_right.jpg", "./assets/images/window/sea/sea_3_left.jpg",
  "./assets/images/window/sea/sea_2_front.jpg", "./assets/images/window/sea/sea_1_right.jpg",
  "./assets/images/window/sky/sky_3_left.jpg", "./assets/images/window/sky/sky_2_front.jpg",
  "./assets/images/window/sky/sky_1_right.jpg",
  "./assets/images/window/space/space-left.png", "./assets/images/window/space/space-front.png",
  "./assets/images/window/space/space-right.png",
  "./assets/video/sea/sea-left.mp4", "./assets/video/sea/sea-front.mp4", "./assets/video/sea/sea-right.mp4",
  "./assets/audio/sea-waves.mp3",
  "./assets/audio/birds/japanese-tit.mp3", "./assets/audio/birds/eurasian-tree-sparrow.mp3",
  "./assets/audio/birds/eurasian-magpie-proxy.mp3", "./assets/audio/birds/greater-white-fronted-goose.mp3",
  "./assets/audio/birds/great-spotted-woodpecker.mp3", "./assets/audio/birds/black-naped-oriole.mp3",
  "./assets/audio/birds/oriental-scops-owl.mp3", "./assets/audio/birds/japanese-bush-warbler.mp3",
  "./assets/audio/birds/eurasian-skylark.mp3", "./assets/audio/birds/oriental-turtle-dove.mp3",
  "./assets/images/wellness/lower-body/stretch_01_pelvic_tilt.png",
  "./assets/images/wellness/lower-body/stretch_02_knee_to_chest.png",
  "./assets/images/wellness/lower-body/stretch_03_torso_rotation.png",
  "./assets/images/wellness/lower-body/stretch_04_hip_flexor.png",
  "./assets/images/wellness/lower-body/stretch_05_glute.png",
  "./assets/images/wellness/lower-body/stretch_06_hamstring.png",
  "./assets/images/wellness/lower-body/stretch_07_side_body.png",
  "./assets/images/wellness/neck/neck_01.jpg", "./assets/images/wellness/neck/neck_02.jpg",
  "./assets/images/wellness/neck/neck_03.jpg", "./assets/images/wellness/neck/neck_04.jpg",
  "./assets/images/wellness/shoulder/shoulder_01.jpg", "./assets/images/wellness/shoulder/shoulder_02.jpg",
  "./assets/images/wellness/shoulder/shoulder_03.jpg", "./assets/images/wellness/shoulder/shoulder_04.jpg",
  "./assets/images/wellness/shoulder/arm-shoulder-pull-v2.png",
  "./assets/images/wellness/yoga/seated-mountain.webp", "./assets/images/wellness/yoga/seated-cat-cow.webp",
  "./assets/images/wellness/yoga/seated-side-bend.webp", "./assets/images/wellness/yoga/seated-twist.webp",
  "./assets/images/wellness/yoga/warrior-two.webp", "./assets/images/wellness/yoga/tree-pose.webp",
  "./assets/images/wellness/yoga/chair-pose.webp", "./assets/images/wellness/yoga/high-lunge.webp",
  "./assets/images/wellness/yoga/reverse-warrior.webp", "./assets/images/wellness/yoga/triangle-pose.webp",
  "./assets/images/wellness/yoga/half-moon.webp", "./assets/images/wellness/yoga/dancer-pose.webp",
  "./assets/images/wellness/yoga/eight-angle-pose.webp"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const freshFirst = event.request.mode === "navigate" || ["script", "style", "worker"].includes(event.request.destination);
  if (freshFirst) {
    event.respondWith(fetch(event.request, { cache: "no-store" }).then((response) => {
      const copy = response.clone();
      caches.open(CACHE).then((cache) => cache.put(event.request, copy));
      return response;
    }).catch(() => caches.match(event.request)));
    return;
  }
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
