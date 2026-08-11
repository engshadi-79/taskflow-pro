// MONJEZ app-shell service worker.
//
// Deliberately narrow: caches only Next's content-hashed static build
// assets plus the PWA icons/manifest (non-sensitive, safe to reuse offline).
// Every page navigation, every /api/* call, and every Server Action always
// goes straight to the network - dashboard data is per-user/per-organization
// and protected by RLS, so it must never be cached or served stale/offline.
const CACHE_NAME = "monjez-shell-v1";
const PRECACHE_URLS = ["/manifest.json", "/icon-192.png", "/icon-512.png", "/apple-touch-icon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;

  const isStaticAsset = url.pathname.startsWith("/_next/static/") || PRECACHE_URLS.includes(url.pathname);
  if (!isStaticAsset) return;

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
