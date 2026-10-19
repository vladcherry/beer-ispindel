// Service worker: приложение открывается без сети и показывает последние полученные данные.
//   Оболочка (HTML, config, иконки) — сначала сеть, без сети — из кэша.
//   Шрифты Google — из кэша, раз скачав (без них страница работает на системных).
//   GET /api/* воркера — сначала сеть, без сети — последний ответ с заголовком X-From-Cache.
// При изменении файлов оболочки подними VERSION, чтобы старый кэш удалился.

const VERSION = "v2";
const SHELL = `shell-${VERSION}`;
const STATIC = `static-${VERSION}`;
const DATA = "data-v3";

const SHELL_FILES = [
  "./",
  "./index.html",
  "./config.js",
  "./i18n.js",
  "./analysis.js",
  "./styles.js",
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
  } else if (url.pathname.startsWith("/api/") && !["/api/health", "/api/members", "/api/alerts", "/api/push/key", "/api/ai"].includes(url.pathname)
             && !url.searchParams.has("after")) {
    // Догрузка новых строк (?after=), журнал уведомлений и список участников идут мимо кэша:
    // иначе офлайн-копия затрётся неполными данными.
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

// from/to в запросе меняются каждый раз, поэтому ключ кэша — путь, устройство и токен
// (хешем ключа доступа: у каждого стика свои данные, сам ключ в кэш не пишем).
async function dataKey(req, url) {
  const key = new URL(url.origin + url.pathname);
  const device = url.searchParams.get("device");
  if (device) key.searchParams.set("device", device);
  const token = req.headers.get("X-Access");
  if (token) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
    key.searchParams.set("t", [...new Uint8Array(buf)].slice(0, 8).map((b) => b.toString(16).padStart(2, "0")).join(""));
  }
  return key.toString();
}

async function data(req, url) {
  const cache = await caches.open(DATA);
  const key = await dataKey(req, url);
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

// Push: сервер присылает {title, body, tag, url}. Нажатие открывает приложение на нужном стике.
self.addEventListener("push", (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = { body: event.data && event.data.text() }; }
  event.waitUntil(self.registration.showNotification(d.title || "iSpindel", {
    body: d.body || "", tag: d.tag, renotify: !!d.tag, icon: "./icons/icon-192.png", data: { url: d.url || "./" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "./", self.registration.scope).href;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const win = wins.find((w) => w.url.startsWith(self.registration.scope));
    if (win) { await win.focus(); return win.navigate(url).catch(() => {}); }
    return self.clients.openWindow(url);
  })());
});
