// Offline support and installability. Code, styles and pages: network first (fresh after a deploy), cache when offline
// or slow. Images, fonts and the Supabase library: cache first. Supabase API calls are never cached.
// Bump VERSION when CORE changes; new published files belong in CORE so they work offline from the first start.
const VERSION = "valdrien-1";
const NETWORK_TIMEOUT = 3500;

const CORE = [
  "./", "index.html", "manifest.webmanifest", "connection.js", "css/game.css", "content/initial-content.js",
  "js/shared/helpers.js", "js/shared/catalog.js", "js/shared/content-format.js", "js/lib/qrcode.js",
  "js/game/rules.js", "js/game/server.js", "js/game/content.js", "js/game/state.js", "js/game/artwork.js",
  "js/game/frame.js", "js/game/install.js", "js/game/menu.js", "js/game/rulebook.js", "js/game/setup.js",
  "js/game/material.js", "js/game/overview.js", "js/game/timer.js", "js/game/guessing.js", "js/game/abilities.js",
  "js/game/events.js", "js/game/effects.js", "js/game/minigames.js", "js/game/keys.js", "js/game/hand-cards.js",
  "js/game/ending.js", "js/game/player-page.js", "js/game/speech.js", "js/game/music.js", "js/game/main.js",
  "images/forest-guild.jpg", "images/dungeon-castle.jpg", "images/dungeon-hall.jpg", "images/dungeon-keys.jpg",
  "images/key-iron.webp", "images/key-silver.webp", "images/key-bone.webp",
  "images/cobweb-left.webp", "images/cobweb-right.webp",
  "images/icons/icon-192.png", "images/icons/icon-512.png", "images/icons/apple-touch-icon.png", "images/icons/favicon-32.png",
  ...["Wolfram", "Roderick", "Zacharias", "Magnus", "Hilda", "Vlad", "Dietrich", "Heinrich", "Gregor", "Gunther"]
    .map(name => `images/roles/${name}.jpeg`)
];
const SUPABASE_LIBRARY = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js";
const FONTS = "https://fonts.googleapis.com/css2?family=IM+Fell+English+SC&family=IM+Fell+English&family=Alegreya+Sans:wght@400;500;700&display=swap";
const CACHE_FIRST_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com", "cdn.jsdelivr.net"];

// One missing file must not stop the install, so every file is cached on its own.
async function precache() {
  const cache = await caches.open(VERSION);
  const put = (url, response) => (response.ok || response.type === "opaque") && cache.put(url, response);
  await Promise.allSettled([
    ...CORE.map(url => fetch(url, { cache: "no-cache" }).then(r => put(url, r))),
    fetch(SUPABASE_LIBRARY, { mode: "no-cors" }).then(r => put(SUPABASE_LIBRARY, r)),
    fetch(FONTS).then(async r => {
      const css = await r.clone().text();
      await put(FONTS, r);
      const files = [...css.matchAll(/url\((https:[^)]+)\)/g)].map(m => m[1]);
      await Promise.allSettled(files.map(url => fetch(url).then(f => put(url, f))));
    })
  ]);
}

self.addEventListener("install", event => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

function store(request, response) {
  if (response.ok || response.type === "opaque") {
    const copy = response.clone();
    caches.open(VERSION).then(cache => cache.put(request, copy));
  }
  return response;
}

function fromCache(request) {
  const navigation = request.mode === "navigate";
  return caches.match(request, { ignoreSearch: navigation })
    .then(hit => hit || (navigation ? caches.match("index.html") : undefined));
}

async function networkFirst(request) {
  const network = fetch(request, { cache: "no-cache" }).then(r => store(request, r));
  const quick = await Promise.race([
    network.catch(() => null),
    new Promise(resolve => setTimeout(() => resolve(null), NETWORK_TIMEOUT))
  ]);
  if (quick) return quick;
  return (await fromCache(request)) || network;
}

async function cacheFirst(request) {
  return (await caches.match(request)) || fetch(request).then(r => store(request, r));
}

// Images: answer from the cache at once and refresh it in the background.
async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const fresh = fetch(request).then(r => store(request, r));
  if (cached) { fresh.catch(() => {}); return cached; }
  return fresh;
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin === location.origin) {
    event.respondWith(request.destination === "image" ? staleWhileRevalidate(request) : networkFirst(request));
  } else if (CACHE_FIRST_HOSTS.includes(url.hostname)) {
    event.respondWith(cacheFirst(request));
  }
});
