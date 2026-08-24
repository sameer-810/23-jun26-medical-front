/**
 * Offline app shell for the web build (Phase 2 of offline billing).
 *
 * Without this, a refresh (or Chrome restarting after a power cut) asks the
 * host for index.html and gets the dinosaur — the app itself must load
 * offline before anything else about offline billing matters.
 *
 * Runtime caching, no build-time manifest: Expo's export hashes every static
 * asset, so whatever the page requests is safe to keep and serve cache-first;
 * navigations go network-first with the last good shell as fallback. API
 * calls live on another origin and never pass through here.
 */
const CACHE = "medstock-shell-v1";
const SHELL_KEY = "__shell__";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(Promise.resolve());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((n) => n !== CACHE).map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // App navigation: freshest wins, last good shell keeps an outage usable.
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        try {
          const res = await fetch(req);
          if (res.ok) cache.put(SHELL_KEY, res.clone());
          return res;
        } catch {
          const shell = await cache.match(SHELL_KEY);
          if (shell) return shell;
          throw new Error("offline and no cached shell yet");
        }
      })(),
    );
    return;
  }

  // Static assets: hashed filenames make cache-first safe forever.
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    })(),
  );
});
