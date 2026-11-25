// Service worker: offline copy of the app shell only.
//
// What it caches: the files this site already ships (HTML, JS, CSS, the
// voice clips bundled in JS, icons, manifest). Nothing else.
// What it never caches: anything not in SHELL below, other origins, non-GET
// requests. Children's progress lives in localStorage and is never fetched,
// so it never reaches Cache Storage.
//
// Strategy: network-first for everything in the shell, falling back to the
// cache when offline. Several files here are edited in place without a new
// hashed name, so serving them cache-first could show an old version.
// Icons (which don't change) are cache-first.
//
// To ship a change to this list, bump VERSION: the new worker installs a fresh
// cache, takes over at once (skipWaiting + clients.claim) and deletes the old one.

const VERSION = 'v1-2026-11-25';
const PREFIX = 'stage1-shell-';
const CACHE = PREFIX + VERSION;

const SHELL = [
  './',
  './index.html',
  './index-CXxvQb3-.css',
  './tier2.css',
  './pwa.css',
  './index-D_1L_Yzd.js',
  './rolldown-runtime-WkwZ5CU-.js',
  './vendor-DctBZRDK.js',
  './data-BLFTfogW.js',
  './bank.js',
  './tier2.js',
  './pwa.js',
  './audio-SI766vcO.js',
  './audio-fb1.js',
  './audio-fb2.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/favicon-32.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];
const SCOPE = new URL('./', self.location).href;
const SHELL_URLS = new Set(SHELL.map((p) => new URL(p, SCOPE).href));

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(SHELL.map((p) => new Request(p, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request, cacheKey) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(request);
    if (res && res.ok && res.type === 'basic') cache.put(cacheKey, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(cacheKey);
    if (hit) return hit;
    throw err;
  }
}
async function cacheFirst(request) {
  const hit = await caches.match(request, { cacheName: CACHE });
  return hit || fetch(request);
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // page loads (any route / hash): the shell page
  if (req.mode === 'navigate') {
    if (!url.href.startsWith(SCOPE)) return;
    event.respondWith(networkFirst(req, new URL('./index.html', SCOPE).href));
    return;
  }
  const key = url.origin + url.pathname; // ignore query strings
  if (!SHELL_URLS.has(key)) return; // not ours: let the browser handle it, uncached
  if (url.pathname.includes('/icons/')) event.respondWith(cacheFirst(key));
  else event.respondWith(networkFirst(req, key));
});
