// Phat Chance service worker — minimal app-shell cache for offline launch.
// Bumping CACHE_VERSION invalidates old caches.
const CACHE_VERSION = "phat-chance-v1";
const APP_SHELL = [
  "/",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL).catch(() => undefined))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Never intercept API or WebSocket calls — they must always hit the network.
  if (url.pathname.startsWith("/api/")) return;
  if (req.headers.get("upgrade") === "websocket") return;

  // Only same-origin GETs
  if (url.origin !== self.location.origin) return;

  // Navigation requests: network first, fall back to cached shell for offline launch.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put("/", copy)).catch(() => undefined);
          return res;
        })
        .catch(() => caches.match("/").then((c) => c || Response.error())),
    );
    return;
  }

  // Static assets: cache first, then network, then update cache.
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === "basic") {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy)).catch(() => undefined);
          }
          return res;
        })
        .catch(() => cached || Response.error());
      return cached || fetchPromise;
    }),
  );
});
