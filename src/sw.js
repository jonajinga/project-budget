/* Project Budget service worker.
 *
 * Strategy:
 *   - App shell (/app/* HTML, CSS, JS, fonts) — stale-while-revalidate.
 *     Users get the cached page instantly; the network fetch updates
 *     the cache in the background so the NEXT visit is fresh.
 *   - Marketing pages (/, /docs/, /blog/, etc.) — network-first with
 *     cache fallback so changes ship immediately when online.
 *   - Same-origin static assets (/assets/*, /favicon.*, /manifest.*) —
 *     cache-first, immutable for hashed URLs.
 *   - Cross-origin (Bunny Fonts, etc.) — bypass; let the browser cache.
 *   - HTML fetch failure → return the cached /app/ shell so offline
 *     navigation still feels like the app rather than the Chrome
 *     dinosaur page.
 *
 * Cache versioning is driven by CACHE_VERSION below — bump on
 * deployments that need clients to drop old caches. The 'activate'
 * handler purges any cache whose name doesn't match the current
 * version so stale assets don't linger.
 */

const CACHE_VERSION = "pb-v2026-05-17-9";
const STATIC_CACHE = "pb-static-" + CACHE_VERSION;
const RUNTIME_CACHE = "pb-runtime-" + CACHE_VERSION;

/* Pre-cache the bare-minimum offline shell on install. The runtime
   cache fills in the rest as the user navigates. Keep this list
   small so the first install is fast on slow networks. */
const PRECACHE_URLS = [
  "/",
  "/app/",
  "/manifest.webmanifest",
  "/favicon.svg",
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(function (cache) {
      return cache.addAll(PRECACHE_URLS).catch(function (err) {
        /* Don't fail the install if a single URL is unreachable —
           it just won't be available offline. The runtime cache
           will fill in on next visit. */
        console.warn("[SW] Precache partial failure:", err);
      });
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if (key !== STATIC_CACHE && key !== RUNTIME_CACHE) {
          return caches.delete(key);
        }
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

function isHTMLRequest(req) {
  return req.mode === "navigate" ||
         (req.headers.get("accept") || "").includes("text/html");
}

function isStaticAsset(url) {
  return /\.(css|js|woff2?|png|jpg|jpeg|svg|webp|ico)$/i.test(url.pathname) ||
         url.pathname === "/manifest.webmanifest";
}

self.addEventListener("fetch", function (event) {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  /* Cross-origin (fonts, analytics, etc.) — bypass so browser caching
     + CORS handling stays untouched. */
  if (url.origin !== self.location.origin) return;

  /* Skip non-cacheable paths. Pagefind index updates aggressively;
     CDN-cgi is Cloudflare's edge worker traffic; sw.js itself
     should always be fresh (or browsers stop updating workers). */
  if (
    url.pathname.startsWith("/pagefind/") ||
    url.pathname.startsWith("/cdn-cgi/") ||
    url.pathname === "/sw.js" ||
    url.pathname === "/feed.xml"
  ) return;

  /* Static assets — cache first. Hashed URLs (with ?v=hash) are
     effectively immutable so cache hits are safe forever. */
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(req).then(function (cached) {
        if (cached) return cached;
        return fetch(req).then(function (res) {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(RUNTIME_CACHE).then(function (c) { c.put(req, copy); });
          }
          return res;
        });
      })
    );
    return;
  }

  /* HTML — stale-while-revalidate for /app/* (the user-facing app),
     network-first for marketing pages (so content updates ship). */
  if (isHTMLRequest(req)) {
    if (url.pathname.startsWith("/app/")) {
      /* Stale-while-revalidate */
      event.respondWith(
        caches.match(req).then(function (cached) {
          const networkFetch = fetch(req).then(function (res) {
            if (res && res.ok) {
              const copy = res.clone();
              caches.open(RUNTIME_CACHE).then(function (c) { c.put(req, copy); });
            }
            return res;
          }).catch(function () { return cached; });
          /* Return cached immediately if we have it; network updates
             cache in the background. Otherwise wait for the network. */
          return cached || networkFetch;
        })
      );
      return;
    }
    /* Marketing pages — network first, cache fallback. */
    event.respondWith(
      fetch(req).then(function (res) {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(RUNTIME_CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () {
        return caches.match(req).then(function (cached) {
          /* Last resort: if not in cache, fall back to the app shell
             so the user gets SOMETHING instead of the offline error. */
          return cached || caches.match("/app/");
        });
      })
    );
    return;
  }

  /* Everything else — try network, fall back to cache. */
  event.respondWith(
    fetch(req).catch(function () { return caches.match(req); })
  );
});
