// Service worker: приложение открывается без сети и показывает последние полученные данные.
//   Оболочка (HTML, config, иконки) — сначала сеть, без сети — из кэша.
//   Шрифты Google — из кэша, раз скачав (без них страница работает на системных).
//   GET /api/* воркера — сначала сеть, без сети — последний ответ с заголовком X-From-Cache.
// При изменении файлов оболочки подними VERSION, чтобы старый кэш удалился.

const VERSION = "v2";
const SHELL = `shell-${VERSION}`;
const STATIC = `static-${VERSION}`;
const DATA = "data-v1";

const SHELL_FILES = [
  "./",
  "./index.html",
  "./config.js",
  "./i18n.js",
  "./vendor/chart-4.4.1.umd.min.js",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
];
const STATIC_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  const keep = [SHELL, STATIC, DATA];
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !keep.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    event.respondWith(shell(req));
  } else if (STATIC_HOSTS.includes(url.hostname)) {
    event.respondWith(cacheFirst(req));
  } else if (url.pathname.startsWith("/api/") && url.pathname !== "/api/health") {
    event.respondWith(data(req, url));
  }
});

async function shell(req) {
  const cache = await caches.open(SHELL);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(req, { ignoreSearch: true })
      ?? (req.mode === "navigate" ? await cache.match("./index.html") : null);
    if (hit) return hit;
    throw err;
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === "opaque") cache.put(req, res.clone());
  return res;
}

// from/to в запросе меняются каждый раз, поэтому ключ кэша — путь и устройство.
function dataKey(url) {
  const key = new URL(url.origin + url.pathname);
  const device = url.searchParams.get("device");
  if (device) key.searchParams.set("device", device);
  return key.toString();
}

async function data(req, url) {
  const cache = await caches.open(DATA);
  const key = dataKey(url);
  try {
    const res = await fetch(req);
    if (res.ok) {
      const headers = new Headers(res.headers);
      headers.set("X-Cached-At", String(Date.now()));
      cache.put(key, new Response(await res.clone().blob(), { status: res.status, headers }));
    }
    return res;
  } catch (err) {
    const hit = await cache.match(key);
    if (!hit) throw err;
    const headers = new Headers(hit.headers);
    headers.set("X-From-Cache", hit.headers.get("X-Cached-At") || "1");
    // Ответ кросс-доменный: без этого страница не увидит наш заголовок.
    headers.set("Access-Control-Expose-Headers", "X-From-Cache");
    return new Response(await hit.blob(), { status: hit.status, headers });
  }
}
