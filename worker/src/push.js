// Push-уведомления: Web Push (шифрование RFC 8291, подпись VAPID RFC 8292) и правила оповещений.
//
// Подписка — пара (endpoint браузера, стик): одно устройство может следить за несколькими стиками,
// и для каждого выбирает свои события. Ключи VAPID создаются при первом обращении и хранятся в meta.
//
// События:
//   temp    — температура дальше 0,5 °C за нормой стиля два показания подряд (повтор не чаще раза в 3 ч)
//             и возврат в норму; проверяется, пока идёт партия
//   silent  — нет данных дольше трёх интервалов (не меньше 45 мин); и снова на связи
//   battery — заряд 20 % и ниже (снова — после подзарядки выше 30 %)
//   done    — наклон двое суток почти не меняется: брожение, похоже, закончилось (раз за партию)

export const EVENTS = ["temp", "silent", "battery", "done"];
const TEMP_EDGE = 0.5;
const TEMP_REPEAT_MS = 3 * 3600e3;
const SILENT_MIN_MS = 45 * 60e3;
const DONE_MIN_AGE_MS = 3 * 86400e3;

const enc = new TextEncoder();
const b64u = {
  enc: (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
  dec: (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0)),
};
const concat = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of parts) { out.set(p, i); i += p.length; }
  return out;
};

// ---------- Ключи VAPID ----------
let vapid = null;
export async function vapidKeys(env) {
  if (vapid) return vapid;
  let row = await env.DB.prepare("SELECT v FROM meta WHERE k = 'vapid'").first();
  if (!row) {
    const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    const jwk = await crypto.subtle.exportKey("jwk", kp.privateKey);
    const pub = b64u.enc(await crypto.subtle.exportKey("raw", kp.publicKey));
    // Два экземпляра воркера могли создать ключи одновременно — остаётся тот, что записался первым.
    await env.DB.prepare("INSERT OR IGNORE INTO meta (k, v) VALUES ('vapid', ?1)").bind(JSON.stringify({ pub, jwk })).run();
    row = await env.DB.prepare("SELECT v FROM meta WHERE k = 'vapid'").first();
  }
  const { pub, jwk } = JSON.parse(row.v);
  const priv = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  vapid = { pub, priv };
  return vapid;
}

async function vapidAuth(endpoint, keys, subject) {
  const part = (obj) => b64u.enc(enc.encode(JSON.stringify(obj)));
  const unsigned = part({ typ: "JWT", alg: "ES256" }) + "." +
    part({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject });
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, keys.priv, enc.encode(unsigned));
  return `vapid t=${unsigned}.${b64u.enc(sig)}, k=${keys.pub}`;
}

// ---------- Шифрование (aes128gcm, одна запись) ----------
async function hkdf(salt, ikm, info, length) {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, length * 8));
}

export async function encryptPayload(p256dh, auth, plaintext) {
  const uaPub = b64u.dec(p256dh), secret = b64u.dec(auth);
  const local = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPub = new Uint8Array(await crypto.subtle.exportKey("raw", local.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", uaPub, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, local.privateKey, 256));
  const ikm = await hkdf(secret, shared, concat(enc.encode("WebPush: info\0"), uaPub, asPub), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);
  const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  // 0x02 — разделитель последней записи, без дополнения.
  const body = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, concat(plaintext, new Uint8Array([2]))));
  const header = new Uint8Array(16 + 4 + 1 + asPub.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096);
  header[20] = asPub.length;
  header.set(asPub, 21);
  return concat(header, body);
}

// Отправить одно уведомление. Подписки, которых больше нет (404/410), удаляем.
export async function sendPush(env, sub, message) {
  const keys = await vapidKeys(env);
  const body = await encryptPayload(sub.p256dh, sub.auth, enc.encode(JSON.stringify(message)));
  const res = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      Authorization: await vapidAuth(sub.endpoint, keys, env.VAPID_SUBJECT || "https://github.com/vladcherry/beer-ispindel"),
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "86400",
      Urgency: "high",
    },
    body,
  });
  if (res.status === 404 || res.status === 410) {
    await env.DB.prepare("DELETE FROM push_subs WHERE endpoint = ?1").bind(sub.endpoint).run();
  }
  return res.status;
}

// ---------- Тексты ----------
const TEXTS = {
  en: {
    tempHigh: ["{name}: too warm", "{t} °C, the range is {lo}–{hi} °C."],
    tempLow: ["{name}: too cold", "{t} °C, the range is {lo}–{hi} °C."],
    tempOk: ["{name}: temperature is fine again", "{t} °C, within {lo}–{hi} °C."],
    silent: ["{name} has gone quiet", "No data for {h} h. Check the battery and Wi-Fi."],
    back: ["{name} is back online", "Readings are arriving again."],
    battery: ["{name}: battery {p}%", "Time to charge the iSpindel."],
    done: ["{name}: fermentation seems finished", "The tilt has barely changed for two days. Check the gravity — you can cool the beer."],
    test: ["Notifications work", "This is how alerts about {name} will look."],
  },
  ru: {
    tempHigh: ["{name}: слишком тепло", "{t} °C при норме {lo}–{hi} °C."],
    tempLow: ["{name}: слишком холодно", "{t} °C при норме {lo}–{hi} °C."],
    tempOk: ["{name}: температура снова в норме", "{t} °C, норма {lo}–{hi} °C."],
    silent: ["{name} молчит", "Нет данных {h} ч. Проверь батарею и Wi-Fi."],
    back: ["{name} снова на связи", "Показания снова приходят."],
    battery: ["{name}: батарея {p}%", "Пора зарядить iSpindel."],
    done: ["{name}: брожение, похоже, закончилось", "Наклон почти не меняется двое суток. Проверь плотность — можно охлаждать."],
    test: ["Уведомления работают", "Так будут выглядеть оповещения о «{name}»."],
  },
  uk: {
    tempHigh: ["{name}: надто тепло", "{t} °C при нормі {lo}–{hi} °C."],
    tempLow: ["{name}: надто холодно", "{t} °C при нормі {lo}–{hi} °C."],
    tempOk: ["{name}: температура знову в нормі", "{t} °C, норма {lo}–{hi} °C."],
    silent: ["{name} мовчить", "Немає даних {h} год. Перевір батарею та Wi-Fi."],
    back: ["{name} знову на зв’язку", "Показники знову надходять."],
    battery: ["{name}: батарея {p}%", "Час зарядити iSpindel."],
    done: ["{name}: бродіння, схоже, завершилося", "Нахил майже не змінюється дві доби. Перевір густину — можна охолоджувати."],
    test: ["Сповіщення працюють", "Так виглядатимуть сповіщення про «{name}»."],
  },
  es: {
    tempHigh: ["{name}: demasiado caliente", "{t} °C, el rango es {lo}–{hi} °C."],
    tempLow: ["{name}: demasiado frío", "{t} °C, el rango es {lo}–{hi} °C."],
    tempOk: ["{name}: la temperatura vuelve a estar bien", "{t} °C, dentro de {lo}–{hi} °C."],
    silent: ["{name} no envía datos", "Sin datos desde hace {h} h. Revisa la batería y el Wi-Fi."],
    back: ["{name} vuelve a estar conectado", "Llegan lecturas otra vez."],
    battery: ["{name}: batería {p}%", "Es hora de cargar el iSpindel."],
    done: ["{name}: la fermentación parece terminada", "La inclinación casi no cambia desde hace dos días. Comprueba la densidad: puedes enfriar."],
    test: ["Las notificaciones funcionan", "Así se verán los avisos sobre «{name}»."],
  },
};
const fmt1 = (v, lang) => (Math.round(v * 10) / 10).toLocaleString(lang === "uk" ? "uk-UA" : lang, { maximumFractionDigits: 1 });
function compose(lang, key, params) {
  const pair = (TEXTS[lang] || TEXTS.en)[key];
  const fill = (s) => s.replace(/\{(\w+)\}/g, (_, k) => {
    const v = params[k];
    return typeof v === "number" ? fmt1(v, lang) : String(v ?? "");
  });
  return { title: fill(pair[0]), body: fill(pair[1]) };
}

// Записать событие в журнал стика (его видят все в приложении) и разослать подпискам, где оно включено.
export async function notify(env, stick, event, key, params, tag) {
  await env.DB.prepare("INSERT INTO alert_log (token_hash, ts, event, key, params) VALUES (?1, ?2, ?3, ?4, ?5)")
    .bind(stick.hash, Date.now(), event, key, JSON.stringify(params)).run();
  const { results } = await env.DB.prepare(
    "SELECT endpoint, p256dh, auth, events, lang FROM push_subs WHERE token_hash = ?1"
  ).bind(stick.hash).all();
  const subs = results.filter((s) => (s.events || "").split(",").includes(event));
  await Promise.allSettled(subs.map((s) => sendPush(env, s, {
    ...compose(s.lang, key, params), tag: `${stick.id}-${tag || event}`, url: `./?stick=${encodeURIComponent(stick.id)}`,
  }).catch((e) => console.error("push", e))));
  return subs.length;
}

// ---------- Правила ----------
const toC = (v, u) => v == null ? null : u === "F" ? (v - 32) * 5 / 9 : u === "K" ? v - 273.15 : v;
const BATTERY = [[4.2, 100], [4.1, 90], [4.0, 80], [3.9, 65], [3.8, 50], [3.7, 35], [3.6, 20], [3.5, 8], [3.4, 0]];
function batteryPct(v) {
  if (v == null) return null;
  if (v >= BATTERY[0][0]) return 100;
  for (let i = 1; i < BATTERY.length; i++) {
    const [v1, p1] = BATTERY[i - 1], [v2, p2] = BATTERY[i];
    if (v >= v2) return Math.round(p2 + (p1 - p2) * (v - v2) / (v1 - v2));
  }
  return 0;
}
const outside = (tc, lo, hi) => tc == null ? null : tc > hi + TEMP_EDGE ? "high" : tc < lo - TEMP_EDGE ? "low" : null;

async function getState(env, hash) {
  const { results } = await env.DB.prepare("SELECT kind, active, at, ref FROM alert_state WHERE token_hash = ?1").bind(hash).all();
  return Object.fromEntries(results.map((r) => [r.kind, r]));
}
const setState = (env, hash, kind, active, at, ref = null) => env.DB.prepare(
  "INSERT OR REPLACE INTO alert_state (token_hash, kind, active, at, ref) VALUES (?1, ?2, ?3, ?4, ?5)"
).bind(hash, kind, active ? 1 : 0, at, ref).run();

// После приёма показания. prev — предыдущее показание этого устройства (из latest) или null.
// stick: hash, id, batch_start, t_lo, t_hi, t_offset (поправка к температуре, °C).
export async function onReading(env, stick, row, prev) {
  const state = await getState(env, stick.hash);
  const now = row.ts, name = row.device;

  // Снова на связи
  if (state.silent && state.silent.active) {
    await setState(env, stick.hash, "silent", false, now);
    await notify(env, stick, "silent", "back", { name }, "silent");
  }

  // Температура — пока идёт партия и известна норма
  if (stick.batch_start && stick.batch_start < now && stick.t_lo != null && stick.t_hi != null) {
    const lo = stick.t_lo, hi = stick.t_hi;
    const off = stick.t_offset || 0, cal = (v, u) => { const c = toC(v, u); return c == null ? null : Math.round((c + off) * 100) / 100; };
    const tc = cal(row.temperature, row.temp_units);
    const out = outside(tc, lo, hi);
    const prevOut = prev ? outside(cal(prev.temperature, prev.temp_units), lo, hi) : null;
    const st = state.temp;
    const params = { name, t: tc, lo, hi };
    if (out && prevOut && (!st || !st.active || now - st.at > TEMP_REPEAT_MS)) {
      await setState(env, stick.hash, "temp", true, now);
      await notify(env, stick, "temp", out === "high" ? "tempHigh" : "tempLow", params, "temp");
    } else if (st && st.active && tc != null && tc >= lo && tc <= hi) {
      await setState(env, stick.hash, "temp", false, now);
      await notify(env, stick, "temp", "tempOk", params, "temp");
    }
  }

  // Батарея
  const pct = batteryPct(row.battery);
  if (pct != null) {
    const st = state.battery;
    if (pct <= 20 && !(st && st.active)) {
      await setState(env, stick.hash, "battery", true, now);
      await notify(env, stick, "battery", "battery", { name, p: pct });
    } else if (pct >= 30 && st && st.active) {
      await setState(env, stick.hash, "battery", false, now);
    }
  }
}

// По расписанию (каждые 15 минут): кто замолчал; раз в час — не закончилось ли брожение.
export async function onSchedule(env, now = Date.now()) {
  const { results: sticks } = await env.DB.prepare(
    `SELECT t.hash, t.id, t.batch_start, l.device, l.ts, l.interval_s
     FROM tokens t JOIN latest l ON l.owner = t.hash
     WHERE l.ts > ?1 AND l.ts = (SELECT MAX(ts) FROM latest WHERE owner = t.hash)`
  ).bind(now - 14 * 86400e3).all();
  const hourly = new Date(now).getUTCMinutes() < 15;
  for (const s of sticks) {
    const stick = { hash: s.hash, id: s.id };
    const state = await getState(env, s.hash);
    const quietFor = now - s.ts;
    const limit = Math.max(SILENT_MIN_MS, 3 * (s.interval_s || 900) * 1000);
    if (quietFor > limit && !(state.silent && state.silent.active)) {
      await setState(env, s.hash, "silent", true, now);
      await notify(env, stick, "silent", "silent", { name: s.device, h: Math.max(1, Math.round(quietFor / 3600e3)) });
    }
    if (hourly && s.batch_start && now - s.batch_start > DONE_MIN_AGE_MS && !(state.done && state.done.ref === s.batch_start)) {
      const avg = async (from, to) => (await env.DB.prepare(
        "SELECT AVG(angle) AS a, COUNT(*) AS n FROM readings WHERE owner = ?1 AND device = ?2 AND ts BETWEEN ?3 AND ?4"
      ).bind(s.hash, s.device, from, to).first());
      const H = 3600e3;
      const [a0, a24, a48] = await Promise.all([avg(now - 6 * H, now), avg(now - 30 * H, now - 24 * H), avg(now - 54 * H, now - 48 * H)]);
      if (a0.n >= 3 && a24.n >= 3 && a48.n >= 3 && Math.abs(a0.a - a24.a) < 0.25 && Math.abs(a0.a - a48.a) < 0.5) {
        await setState(env, s.hash, "done", true, now, s.batch_start);
        await notify(env, stick, "done", "done", { name: s.device });
      }
    }
  }
}

// Журнал событий стика для приложения: последние 50 (или новее since).
export async function alertsList(env, stick, url, json, cors) {
  const since = Number(url.searchParams.get("since")) || 0;
  const { results } = await env.DB.prepare(
    "SELECT id, ts, event, key, params FROM alert_log WHERE token_hash = ?1 AND ts > ?2 ORDER BY ts DESC LIMIT 50"
  ).bind(stick.hash, since).all();
  return json({ alerts: results.map((r) => ({ ...r, params: JSON.parse(r.params || "{}") })) }, 200, cors);
}

// ---------- API подписок ----------
const ENDPOINT_RE = /^(https:\/\/[^\s]{8,1000}|http:\/\/localhost(:\d+)?\/[^\s]*)$/;
const KEY_RE = /^[A-Za-z0-9_-]{16,200}$/;

export async function pushApi(request, env, stick, path, json, cors) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "bad json" }, 400, cors); }
  const endpoint = body && body.endpoint;
  if (typeof endpoint !== "string" || !ENDPOINT_RE.test(endpoint)) return json({ error: "bad endpoint" }, 400, cors);

  if (path === "/api/push/subscribe") {
    const { p256dh, auth } = body;
    if (!KEY_RE.test(p256dh || "") || !KEY_RE.test(auth || "")) return json({ error: "bad keys" }, 400, cors);
    const events = (Array.isArray(body.events) ? body.events : EVENTS).filter((e) => EVENTS.includes(e));
    const lang = ["en", "ru", "uk", "es"].includes(body.lang) ? body.lang : "en";
    await env.DB.prepare(
      `INSERT OR REPLACE INTO push_subs (endpoint, token_hash, key_hash, p256dh, auth, events, lang, created)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`
    ).bind(endpoint, stick.hash, stick.keyHash, p256dh, auth, events.join(","), lang, Date.now()).run();
    return json({ subscribed: true, events, lang }, 200, cors);
  }
  if (path === "/api/push/unsubscribe") {
    await env.DB.prepare("DELETE FROM push_subs WHERE endpoint = ?1 AND token_hash = ?2").bind(endpoint, stick.hash).run();
    return json({ subscribed: false }, 200, cors);
  }
  const sub = await env.DB.prepare(
    "SELECT endpoint, p256dh, auth, events, lang FROM push_subs WHERE endpoint = ?1 AND token_hash = ?2"
  ).bind(endpoint, stick.hash).first();
  if (path === "/api/push/state") {
    return json(sub ? { subscribed: true, events: (sub.events || "").split(",").filter(Boolean), lang: sub.lang } : { subscribed: false }, 200, cors);
  }
  if (path === "/api/push/test") {
    if (!sub) return json({ error: "not subscribed" }, 404, cors);
    const dev = await env.DB.prepare("SELECT device FROM latest WHERE owner = ?1 ORDER BY ts DESC LIMIT 1").bind(stick.hash).first();
    const status = await sendPush(env, sub, { ...compose(sub.lang, "test", { name: dev ? dev.device : "iSpindel" }), tag: `${stick.id}-test`, url: `./?stick=${encodeURIComponent(stick.id)}` });
    return json({ status }, status >= 200 && status < 300 ? 200 : 502, cors);
  }
  return json({ error: "Not found" }, 404, cors);
}
