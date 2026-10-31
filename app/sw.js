// Offline support: the app, the core and the data are kept on the device, so the app
// starts without a connection (train, plane) with the data it saw last.
// Online it always asks the network first, so a push to the site reaches users at once.
// Images are kept once seen; they never change under the same name.
const VERSION = "m2m-1";
const SHELL = `${VERSION}-shell`;
const IMAGES = `${VERSION}-images`;
const DATA = new URL("../Daten/", self.location).href;

const FILES = [
  "./", "index.html", "app.js", "calculator.js", "style.css", "favicon.svg", "manifest.webmanifest",
  "icons/icon-192.png", "icons/maskable-192.png",
  "../core/index.js", "../core/format.js", "../core/parse.js", "../core/money.js", "../core/compare.js", "../core/bignumbers.js",
  "../Daten/exchange_rates.json", "../Daten/indices.json", "../Daten/index_values.json",
  "../Daten/listen/index.json", "../Daten/listen/mean2me.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    await cache.addAll(FILES);
    // all list files, whatever the catalog holds today
    const catalog = await (await cache.match("../Daten/listen/index.json")).json();
    await cache.addAll(catalog.lists.map((l) => `../Daten/listen/${l.file}`));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (!key.startsWith(VERSION)) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(req.url.startsWith(`${DATA}bilder/`) ? cacheFirst(req) : networkFirst(req));
});

async function networkFirst(req) {
  const cache = await caches.open(SHELL);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    // a shared link (?n=…&c=…) opens the app page without its query
    const hit = await cache.match(req, { ignoreSearch: req.mode === "navigate" });
    if (hit) return hit;
    throw err;
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(IMAGES);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}
