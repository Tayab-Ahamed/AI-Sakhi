/**
 * AI Sakhi — Service Worker (Phase 11 Offline Mode)
 *
 * Strategy:
 *  - Static assets (JS/CSS/fonts/images): Cache-First
 *  - Navigation (HTML pages): Network-First with cache fallback
 *  - Quiz API calls: Network-First, cache successful responses for offline use
 *  - Progress/chat writes: Queue in IndexedDB and sync when back online
 */

const CACHE_VERSION = "v1";
const STATIC_CACHE  = `sakhi-static-${CACHE_VERSION}`;
const API_CACHE     = `sakhi-api-${CACHE_VERSION}`;
const SYNC_QUEUE    = "sakhi-sync-queue";

const STATIC_PRECACHE = [
  "/",
  "/quiz",
  "/flashcards",
  "/dashboard",
  "/offline.html",
];

const QUIZ_API_PATTERN    = /\/quiz\/generate/;
const PROGRESS_API_PATTERN = /\/progress/;
const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// ── Install: precache shell ──────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      cache.addAll(STATIC_PRECACHE).catch(() => {})
    )
  );
  self.skipWaiting();
});

// ── Activate: delete old caches ─────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== API_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: routing logic ─────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignore chrome-extension and non-http(s)
  if (!url.protocol.startsWith("http")) return;

  // Ignore Next.js HMR / development endpoints
  if (url.pathname.startsWith("/_next/webpack-hmr")) return;

  // ── Quiz generation: Network-First, cache on success ──────
  if (QUIZ_API_PATTERN.test(url.pathname) && request.method === "POST") {
    event.respondWith(networkFirstWithCache(request, API_CACHE));
    return;
  }

  // ── Progress writes: queue if offline ─────────────────────
  if (PROGRESS_API_PATTERN.test(url.pathname) && WRITE_METHODS.has(request.method)) {
    event.respondWith(networkOrQueue(request));
    return;
  }

  // ── Static assets (_next/static): Cache-First ─────────────
  if (url.pathname.startsWith("/_next/static") || url.pathname.startsWith("/static")) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // ── Navigation (HTML): Network-First, fall back to offline page ──
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match("/offline.html").then((r) => r || new Response("Offline", { status: 503 }))
      )
    );
    return;
  }

  // ── Everything else: Stale-While-Revalidate ───────────────
  event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
});

// ── Background Sync: flush queued progress ──────────────────
self.addEventListener("sync", (event) => {
  if (event.tag === SYNC_QUEUE) {
    event.waitUntil(flushQueue());
  }
});

// ─────────────────────────────────────────────────────────────
// Strategies
// ─────────────────────────────────────────────────────────────

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("Offline", { status: 503 });
  }
}

async function networkFirstWithCache(request, cacheName) {
  try {
    const response = await fetch(request.clone());
    if (response.ok) {
      const cache = await caches.open(cacheName);
      // Clone the request for caching (POST body can only be read once)
      const cacheKey = request.url + "_" + Date.now();
      cache.put(new Request(cacheKey), response.clone());
    }
    return response;
  } catch {
    // Offline: try to return any matching cached quiz
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length > 0) {
      return cache.match(keys[keys.length - 1]);
    }
    return new Response(JSON.stringify({ error: "offline", questions: [] }), {
      status: 503, headers: { "Content-Type": "application/json" },
    });
  }
}

async function networkOrQueue(request) {
  try {
    return await fetch(request);
  } catch {
    // Queue the request for later sync
    await enqueueRequest(request);
    return new Response(JSON.stringify({ queued: true }), {
      status: 202, headers: { "Content-Type": "application/json" },
    });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  return cached || (await fetchPromise) || new Response("Offline", { status: 503 });
}

// ─────────────────────────────────────────────────────────────
// IndexedDB queue helpers
// ─────────────────────────────────────────────────────────────

function openQueueDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("sakhi-sw-queue", 1);
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore("requests", { keyPath: "id", autoIncrement: true });
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function enqueueRequest(request) {
  try {
    const body = await request.text().catch(() => "");
    const db = await openQueueDb();
    const tx = db.transaction("requests", "readwrite");
    tx.objectStore("requests").add({
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      body,
      timestamp: Date.now(),
    });
  } catch {
    // Best-effort, don't block
  }
}

async function flushQueue() {
  try {
    const db = await openQueueDb();
    const tx = db.transaction("requests", "readwrite");
    const store = tx.objectStore("requests");
    const all = await new Promise((resolve) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve([]);
    });
    for (const entry of all) {
      try {
        await fetch(entry.url, {
          method: entry.method,
          headers: entry.headers,
          body: entry.body || undefined,
        });
        store.delete(entry.id);
      } catch {
        // Still offline — leave in queue
      }
    }
  } catch {
    // DB not available
  }
}
