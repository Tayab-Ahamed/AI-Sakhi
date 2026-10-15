/* Public assets only. Authenticated APIs and writes always use the network. */
const CACHE_NAME = "sakhi-public-v3";
const ASSETS = ["/offline.html", "/icon-192.png", "/icon-512.png"];
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith("sakhi-") && key !== CACHE_NAME) await caches.delete(key);
    }
    // Old workers persisted authenticated requests. Never replay those credentials.
    await new Promise((resolve) => {
      const deletion = indexedDB.deleteDatabase("sakhi-sw-queue");
      deletion.onsuccess = deletion.onerror = deletion.onblocked = resolve;
    });
    await self.clients.claim();
  })());
});
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
  if (event.data?.type === "CLEAR_PRIVATE_DATA") {
    event.waitUntil((async () => {
      for (const key of await caches.keys()) {
        if (key.startsWith("sakhi-") && key !== CACHE_NAME) await caches.delete(key);
      }
    })());
  }
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || request.method !== "GET" || url.pathname.startsWith("/api/")) return;
  if (url.pathname.startsWith("/_next/static/") || ASSETS.includes(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      const immutable = /(?:^|,)\s*immutable\s*(?:,|$)/i.test(response.headers.get("cache-control") || "");
      if (response.ok && response.type === "basic" && !response.headers.has("set-cookie") && (ASSETS.includes(url.pathname) || immutable)) await cache.put(request, response.clone());
      return response;
    })());
  } else if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(async () => (await caches.match("/offline.html")) || new Response("Offline", { status: 503 })));
  }
});
