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
 *
 * Every deploy brings new hashes, so assets live in one cache per build and only
 * the running build and the one before it are kept. The older one stays because
 * a tab left open across a deploy still needs its chunks, and because it is what
 * an outage falls back to if the new build hadn't finished downloading. A file
 * unchanged between builds keeps its hash and is carried forward, not refetched.
 * The app preloads every chunk after sign-in and reports what it uses (see
 * navigation/lazyScreen.tsx), so the current cache really holds the whole app.
 */
const CACHE = "medstock-shell-v1";
const STATIC_PREFIX = "medstock-static-";
const SHELL_KEY = "__shell__";
const PREVIOUS_SHELL_KEY = "__shell_previous__";
const BUILDS_KEY = "__builds__";
/** The entry bundle's path in a page's HTML. Its hash identifies the build. */
const ENTRY = /\/_expo\/static\/js\/web\/index-([a-f0-9]+)\.js/;

const staticCacheName = (build) => `${STATIC_PREFIX}${build || "first"}`;
const isHtml = (res) =>
  (res.headers.get("content-type") || "").includes("text/html");

let builds = null;

async function readBuilds(shell) {
  if (builds) return builds;
  const saved = await shell.match(BUILDS_KEY);
  builds = saved ? await saved.json() : { current: null, previous: null };
  return builds;
}

/**
 * Hashed files from before per-build caches sat in the shell cache. They are the
 * "previous build" for one deploy, in case an outage falls back to it, then go.
 */
async function dropLegacyAssets(shell) {
  const reserved = [SHELL_KEY, PREVIOUS_SHELL_KEY, BUILDS_KEY];
  const keys = await shell.keys();
  await Promise.all(
    keys
      .filter((key) => !reserved.includes(new URL(key.url).pathname.slice(1)))
      .map((key) => shell.delete(key)),
  );
}

/**
 * Remembers a fresh page as the shell and, when it is a new build, rotates the
 * asset caches. Only a page carrying the entry bundle counts: navigating to the
 * privacy policy must not make that the page an outage gets.
 */
async function recordShell(shell, res) {
  const build = (await res.clone().text()).match(ENTRY)?.[1];
  if (!build) return;
  const known = await readBuilds(shell);
  if (build === known.current) {
    await shell.put(SHELL_KEY, res);
    return;
  }

  const outgoing = await shell.match(SHELL_KEY);
  if (outgoing) await shell.put(PREVIOUS_SHELL_KEY, outgoing);
  await shell.put(SHELL_KEY, res);

  builds = { current: build, previous: known.current };
  await shell.put(BUILDS_KEY, new Response(JSON.stringify(builds)));

  const keep = [
    staticCacheName(builds.current),
    staticCacheName(known.current),
  ];
  const names = await caches.keys();
  await Promise.all(
    names
      .filter((n) => n.startsWith(STATIC_PREFIX) && !keep.includes(n))
      .map((n) => caches.delete(n)),
  );
  if (known.current) await dropLegacyAssets(shell);
}

/**
 * Files the running page says it uses go into the current build's cache, so the
 * next rotation can't take one that was only ever carried by an older cache. On
 * a first visit this is also what saves the shell and the entry bundle, which
 * the browser fetched before this worker existed.
 */
async function keepAssets(urls) {
  const shell = await caches.open(CACHE);
  if (!(await shell.match(SHELL_KEY))) {
    const res = await fetch("/");
    if (res.ok) await recordShell(shell, res);
  }
  const { current } = await readBuilds(shell);
  const cache = await caches.open(staticCacheName(current));
  for (const url of urls) {
    if (await cache.match(url)) continue;
    const older = await caches.match(url);
    const res = older && !isHtml(older) ? older : await fetch(url);
    if (res.ok && !isHtml(res)) await cache.put(url, res);
  }
}

/** The newest shell whose entry bundle is really here, or null. */
async function offlineShell(shell) {
  const latest = await shell.match(SHELL_KEY);
  if (!latest) return null;
  const entry = (await latest.clone().text()).match(ENTRY)?.[0];
  if (entry && (await caches.match(entry))) return latest;
  return (await shell.match(PREVIOUS_SHELL_KEY)) || latest;
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(Promise.resolve());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((n) => n !== CACHE && !n.startsWith(STATIC_PREFIX))
          .map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "keep")
    event.waitUntil(keepAssets(event.data.urls).catch(() => undefined));
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // The new-version check must see the host, never this cache.
  if (url.searchParams.has("vcheck")) return;

  // App navigation: freshest wins, last good shell keeps an outage usable.
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        const shell = await caches.open(CACHE);
        try {
          const res = await fetch(req);
          // Before answering, so the page's assets land in the right cache.
          if (res.ok) await recordShell(shell, res.clone());
          return res;
        } catch {
          const cached = await offlineShell(shell);
          if (cached) return cached;
          throw new Error("offline and no cached shell yet");
        }
      })(),
    );
    return;
  }

  // Static assets: hashed filenames make cache-first safe forever.
  event.respondWith(
    (async () => {
      const shell = await caches.open(CACHE);
      const { current } = await readBuilds(shell);
      const cache = await caches.open(staticCacheName(current));
      const hit = await cache.match(req);
      if (hit) return hit;

      const older = await caches.match(req);
      if (older && !isHtml(older)) {
        event.waitUntil(cache.put(req, older.clone()));
        return older;
      }

      const res = await fetch(req);
      // Never an HTML page under an asset's URL: a host that answers a missing
      // chunk with its index page would poison this entry for good.
      if (res.ok && !isHtml(res)) event.waitUntil(cache.put(req, res.clone()));
      return res;
    })(),
  );
});
