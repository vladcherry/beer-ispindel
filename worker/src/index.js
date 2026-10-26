// iSpindel → Cloudflare D1.
//   POST /ingest            — сюда шлёт iSpindel (HTTP или HTTPS Post), JSON с полем token
//   POST /api/register      — {token}: зарегистрировать токен стика, в ответ — ключ доступа
//   POST /api/share         — новый ключ доступа к тому же стику (для ссылки «Поделиться»)
//   POST /api/batch         — {start, style, fg, range, recipe, marks}: партия, общая для всех, у кого есть доступ
//   POST /api/formula       — {formula: "…" | ""}: полином плотности по наклону, тоже общий для стика
//   POST /api/units         — {units: "auto" | "P" | "SG"}: в чём iSpindel (или формула) считает плотность
//   POST /api/tcal          — {offset: °C}: поправка к температуре iSpindel, общая для стика (−10…10)
//   GET  /api/devices       — устройства стика с последним показанием
//   GET  /api/readings      — история: ?device=&from=&to= (ms UTC)
//   GET  /api/battery       — среднее напряжение по часам для прогноза батареи: ?device=&days=14
//   GET  /api/members       — кто подключён к стику (только владельцу): браузер, когда были активны
//   POST /api/members/revoke — {id}: админ отключает пользователя, другого админа или неоткрытую ссылку
//   POST /api/members/admin — {id, admin}: админ выдаёт или снимает права админа у подключённого
//   POST /api/history/clear — владелец удаляет все показания стика, кроме последнего
//   GET  /api/alerts        — журнал событий стика (?since=ts)
//   GET  /api/push/key      — публичный ключ VAPID для подписки браузера
//   POST /api/push/subscribe|unsubscribe|state|test — {endpoint, …}: push-подписка этого устройства на стик
//   GET  /api/ai            — AI-помощник: включён ли, лимит на сегодня, чат текущей партии
//   POST /api/ai/ask        — {question, context, lang}: вопрос AI (лимит в сутки на стик)
//   POST /api/ai/recipe     — {turns, lang, styles, context, base?, draft?}: рецепт в чате (вопрос или готовый рецепт)
//   POST /api/ai/config|test — админ: движок, ключ, лимит, длина ответа; проверка ключа
//   GET  /api/recipes       — свои рецепты стика (краткий список); /api/recipes/<id> — рецепт целиком
//   PUT|DELETE /api/recipes/<id> — сохранить или удалить свой рецепт (не больше 50 на стик). Админ — любой;
//                             остальные — только новый авторский (tags: ["authored"]); удаляет только админ
//   GET  /api/health        — проверка
//
// Токен стика знают iSpindel и тот, кто его зарегистрировал; зарегистрировать токен можно
// только один раз. Читают данные по ключу доступа (заголовок X-Access): его выдаёт сервер
// при регистрации и при «Поделиться». В базе хранятся только SHA-256 токенов и ключей.
//
// Секреты/переменные:
//   INGEST_TOKEN   (secret, необязательно) — старый общий токен; его стик можно один раз забрать регистрацией
//   ALLOWED_ORIGIN (var)                   — откуда разрешено читать, напр. https://vladcherry.github.io

const MAX_ROWS = 20000;
const MAX_POINTS = 4000;
// Не чаще одного показания в минуту от одного iSpindel. Пара секунд допуска: iSpindel с интервалом
// 60 с просыпается с небольшим разбросом, и показание, пришедшее через 59 с, отбрасывать не нужно.
const MIN_GAP_MS = 60 * 1000;
const GAP_TOLERANCE_MS = 2 * 1000;
const TOKEN_MIN = 8;
const TOKEN_MAX = 64;

import { onReading, onSchedule, pushApi, alertsList, vapidKeys } from "./push.js";
import { aiState, aiConfig, aiTest, aiAsk, aiRecipe } from "./ai.js";
import { recipesApi } from "./recipes.js";

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(ensureSchema(env).then(() => onSchedule(env)));
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    try {
      await ensureSchema(env);

      if (request.method === "POST" && url.pathname === "/api/register") {
        return await register(request, env, cors);
      }
      if (request.method === "POST" && url.pathname === "/api/share") {
        const stick = await stickByAccess(env, request.headers.get("X-Access"), request);
        if (!stick) return json({ error: "unknown access key" }, 401, cors);
        return json({ access: await issueAccess(env, stick.hash, "share") }, 200, cors);
      }
      if (request.method === "POST" && url.pathname === "/api/members/revoke") {
        const stick = await stickByAccess(env, request.headers.get("X-Access"), request);
        if (!stick) return json({ error: "unknown access key" }, 401, cors);
        return await revokeMember(request, env, stick, cors);
      }
      if (request.method === "POST" && url.pathname === "/api/members/admin") {
        const stick = await stickByAccess(env, request.headers.get("X-Access"), request);
        if (!stick) return json({ error: "unknown access key" }, 401, cors);
        return await setAdmin(request, env, stick, cors);
      }
      if (request.method === "POST" && url.pathname === "/api/history/clear") {
        const stick = await stickByAccess(env, request.headers.get("X-Access"), request);
        if (!stick) return json({ error: "unknown access key" }, 401, cors);
        return await clearHistory(env, stick, cors);
      }
      if (request.method === "GET" && url.pathname === "/api/push/key") {
        return json({ key: (await vapidKeys(env)).pub }, 200, cors);
      }
      if (request.method === "POST" && url.pathname.startsWith("/api/push/")) {
        const stick = await stickByAccess(env, request.headers.get("X-Access"), request);
        if (!stick) return json({ error: "unknown access key" }, 401, cors);
        return await pushApi(request, env, stick, url.pathname, json, cors);
      }
      if (request.method === "POST" && url.pathname.startsWith("/api/ai/")) {
        const stick = await stickByAccess(env, request.headers.get("X-Access"), request);
        if (!stick) return json({ error: "unknown access key" }, 401, cors);
        if (url.pathname === "/api/ai/ask") return await aiAsk(request, env, stick, json, cors);
        if (url.pathname === "/api/ai/recipe") return await aiRecipe(request, env, stick, json, cors);
        if (url.pathname === "/api/ai/config") return await aiConfig(request, env, stick, json, cors);
        if (url.pathname === "/api/ai/test") return await aiTest(env, stick, json, cors);
      }
      if (url.pathname === "/api/recipes" || url.pathname.startsWith("/api/recipes/")) {
        const stick = await stickByAccess(env, request.headers.get("X-Access"), request);
        if (!stick) return json({ error: "unknown access key" }, 401, cors);
        return await recipesApi(request, env, stick, url, json, cors);
      }
      if (request.method === "POST" && url.pathname === "/api/batch") {
        const stick = await stickByAccess(env, request.headers.get("X-Access"), request);
        if (!stick) return json({ error: "unknown access key" }, 401, cors);
        return await setBatch(request, env, stick, cors);
      }
      if (request.method === "POST" && url.pathname === "/api/formula") {
        const stick = await stickByAccess(env, request.headers.get("X-Access"), request);
        if (!stick) return json({ error: "unknown access key" }, 401, cors);
        return await setFormula(request, env, stick, cors);
      }
      if (request.method === "POST" && url.pathname === "/api/tcal") {
        const stick = await stickByAccess(env, request.headers.get("X-Access"), request);
        if (!stick) return json({ error: "unknown access key" }, 401, cors);
        let body;
        try { body = await request.json(); } catch { return json({ error: "bad json" }, 400, cors); }
        const off = body && body.offset;
        if (!(typeof off === "number" && Number.isFinite(off) && off >= -10 && off <= 10)) return json({ error: "bad offset" }, 400, cors);
        const v = Math.round(off * 100) / 100;
        await env.DB.prepare("UPDATE tokens SET t_offset = ?1 WHERE hash = ?2").bind(v || null, stick.hash).run();
        return json({ offset: v }, 200, cors);
      }
      if (request.method === "POST" && url.pathname === "/api/units") {
        const stick = await stickByAccess(env, request.headers.get("X-Access"), request);
        if (!stick) return json({ error: "unknown access key" }, 401, cors);
        let body;
        try { body = await request.json(); } catch { return json({ error: "bad json" }, 400, cors); }
        const units = body && body.units;
        if (!["auto", "P", "SG"].includes(units)) return json({ error: "bad units" }, 400, cors);
        await env.DB.prepare("UPDATE tokens SET units = ?1 WHERE hash = ?2").bind(units === "auto" ? null : units, stick.hash).run();
        return json({ units }, 200, cors);
      }
      if (request.method === "POST") {
        const raw = await request.text();
        // iSpindel иногда шлёт на "/" — принимаем и туда.
        const res = url.pathname === "/ingest" || url.pathname === "/"
          ? await ingest(raw, env, url, ctx)
          : text("Not found", 404);
        await logAttempt(env, request, url, raw, res.status, res.headers.get("X-Reason"));
        return res;
      }
      if (request.method === "GET" && url.pathname === "/api/health") {
        return json({ ok: true, time: Date.now() }, 200, cors);
      }
      if (request.method === "GET" && url.pathname.startsWith("/api/")) {
        const stick = await stickByAccess(env, request.headers.get("X-Access") ?? url.searchParams.get("access"), request);
        if (!stick) return json({ error: "unknown access key" }, 401, cors);
        if (url.pathname === "/api/devices") return await devices(env, stick, cors);
        if (url.pathname === "/api/members") return await members(env, stick, cors);
        if (url.pathname === "/api/readings") return await readings(env, stick.hash, url, cors);
        if (url.pathname === "/api/battery") return await battery(env, stick.hash, url, cors);
        if (url.pathname === "/api/alerts") return await alertsList(env, stick, url, json, cors);
        if (url.pathname === "/api/ai") return await aiState(env, stick, url, json, cors);
      }
      return json({ error: "Not found" }, 404, cors);
    } catch (err) {
      console.error(err);
      return json({ error: String(err && err.message || err) }, 500, cors);
    }
  },
};

// ---------- Токены ----------

async function sha256(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function tokenProblem(token) {
  if (typeof token !== "string") return "no token";
  if (token.length < TOKEN_MIN) return `token shorter than ${TOKEN_MIN}`;
  if (token.length > TOKEN_MAX) return `token longer than ${TOKEN_MAX}`;
  // iSpindel хранит токен в своём JSON-конфиге: кавычки, обратный слеш и пробелы там ломают дело.
  if (!/^[\x21-\x7e]+$/.test(token) || /["\\]/.test(token)) return "token has unsupported characters";
  return null;
}

function randomKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Стик по токену (для приёма показаний).
async function stickByToken(env, token) {
  if (!token) return null;
  return await env.DB.prepare("SELECT hash, id, batch_start, t_lo, t_hi, t_offset FROM tokens WHERE hash = ?1").bind(await sha256(token)).first();
}

// Стик по ключу доступа (для чтения). Заодно отмечаем, когда и с какого браузера ключом пользовались —
// не чаще раза в 5 минут, чтобы не писать в базу на каждый запрос.
const SEEN_EVERY_MS = 5 * 60 * 1000;
async function stickByAccess(env, key, request) {
  if (!key) return null;
  const keyHash = await sha256(key);
  const stick = await env.DB.prepare(
    `SELECT t.hash, t.id, t.batch_start, t.formula, t.units, t.style, t.fg_target, t.t_lo, t.t_hi, t.recipe, t.stage_marks, t.t_offset, a.last_used, a.user_agent, a.kind AS key_kind
     FROM access_keys a JOIN tokens t ON t.hash = a.token_hash WHERE a.hash = ?1`
  ).bind(keyHash).first();
  if (stick && request) {
    const ua = (request.headers.get("User-Agent") || "").slice(0, 300) || null;
    const now = Date.now();
    if (!stick.last_used || now - stick.last_used > SEEN_EVERY_MS || ua !== stick.user_agent) {
      await env.DB.prepare("UPDATE access_keys SET last_used = ?1, user_agent = ?2 WHERE hash = ?3").bind(now, ua, keyHash).run();
    }
  }
  if (stick) stick.keyHash = keyHash;
  return stick;
}

// Кто подключён к стику — видит только владелец. Хеши ключей не отдаём: id — их начало,
// его хватает, чтобы отключить ключ; свой ключ помечаем как you.
async function members(env, stick, cors) {
  if (stick.key_kind !== "owner") return json({ error: "only an admin can see who is connected" }, 403, cors);
  const { results } = await env.DB.prepare(
    `SELECT hash, kind, created, last_used, user_agent FROM access_keys WHERE token_hash = ?1
     ORDER BY last_used IS NULL, last_used DESC, created DESC`
  ).bind(stick.hash).all();
  const list = results.map((r) => ({ id: r.hash.slice(0, 16), kind: r.kind, created: r.created, last_used: r.last_used ?? null,
    user_agent: r.user_agent ?? null, you: r.hash === stick.keyHash }));
  return json({ members: list }, 200, cors);
}

// Очистить историю: остаётся одно последнее показание стика, чтобы на главной были текущие
// значения. Устройства без показаний (старые имена iSpindel) убираем и из latest.
async function clearHistory(env, stick, cors) {
  if (stick.key_kind !== "owner") return json({ error: "only an admin can clear the history" }, 403, cors);
  const [del] = await env.DB.batch([
    env.DB.prepare(
      `DELETE FROM readings WHERE owner = ?1
         AND id <> (SELECT id FROM readings WHERE owner = ?1 ORDER BY ts DESC LIMIT 1)`
    ).bind(stick.hash),
    env.DB.prepare(
      "DELETE FROM latest WHERE owner = ?1 AND device NOT IN (SELECT device FROM readings WHERE owner = ?1)"
    ).bind(stick.hash),
  ]);
  return json({ deleted: del.meta.changes }, 200, cors);
}

// Права админа привязаны к ключу доступа (kind = 'owner'), то есть к браузеру на устройстве,
// а не к токену. Свой ключ так не отключить и не понизить — у стика всегда остаётся хотя бы один админ.
async function memberId(request) {
  let body;
  try { body = await request.json(); } catch { return { error: "bad json" }; }
  const id = body && body.id;
  if (typeof id !== "string" || !/^[0-9a-f]{16}$/.test(id)) return { error: "bad id" };
  return { id, body };
}

// Отключить: удаляем ключ доступа.
async function revokeMember(request, env, stick, cors) {
  if (stick.key_kind !== "owner") return json({ error: "only an admin can disconnect people" }, 403, cors);
  const { id, error } = await memberId(request);
  if (error) return json({ error }, 400, cors);
  if (stick.keyHash.startsWith(id)) return json({ error: "you cannot disconnect yourself" }, 400, cors);
  const res = await env.DB.prepare(
    "DELETE FROM access_keys WHERE token_hash = ?1 AND substr(hash, 1, 16) = ?2"
  ).bind(stick.hash, id).run();
  if (!res.meta.changes) return json({ error: "not found" }, 404, cors);
  await env.DB.prepare("DELETE FROM push_subs WHERE token_hash = ?1 AND substr(key_hash, 1, 16) = ?2").bind(stick.hash, id).run();
  return json({ ok: true }, 200, cors);
}

// Сделать админом или снять права.
async function setAdmin(request, env, stick, cors) {
  if (stick.key_kind !== "owner") return json({ error: "only an admin can change admins" }, 403, cors);
  const { id, body, error } = await memberId(request);
  if (error) return json({ error }, 400, cors);
  if (stick.keyHash.startsWith(id)) return json({ error: "you cannot change your own role" }, 400, cors);
  const res = await env.DB.prepare(
    "UPDATE access_keys SET kind = ?3 WHERE token_hash = ?1 AND substr(hash, 1, 16) = ?2"
  ).bind(stick.hash, id, body.admin ? "owner" : "share").run();
  if (!res.meta.changes) return json({ error: "not found" }, 404, cors);
  return json({ ok: true }, 200, cors);
}

// ua — браузер того, кто сразу начнёт пользоваться ключом (владелец при регистрации).
// У ключа для ссылки «Поделиться» браузер появится, когда ссылку откроют.
async function issueAccess(env, tokenHash, kind, ua = null) {
  const key = randomKey();
  const now = Date.now();
  await env.DB.prepare("INSERT INTO access_keys (hash, token_hash, kind, created, last_used, user_agent) VALUES (?1, ?2, ?3, ?4, ?5, ?6)")
    .bind(await sha256(key), tokenHash, kind, now, ua ? now : null, ua ? ua.slice(0, 300) : null).run();
  return key;
}

// Регистрация: новый токен — заводим стик. Уже зарегистрированный — отказ.
// Стик, заведённый до появления ключей доступа (без единого ключа), можно забрать один раз.
async function register(request, env, cors) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "bad json" }, 400, cors); }
  const token = body && body.token;
  const problem = tokenProblem(token);
  if (problem) return json({ error: problem }, 400, cors);
  const hash = await sha256(token);

  let stick = await env.DB.prepare("SELECT hash, id FROM tokens WHERE hash = ?1").bind(hash).first();
  if (stick) {
    const taken = await env.DB.prepare("SELECT 1 FROM access_keys WHERE token_hash = ?1 LIMIT 1").bind(hash).first();
    if (taken) return json({ error: "token already registered", code: "taken" }, 409, cors);
  } else {
    const id = randomKey().slice(0, 12);
    const res = await env.DB.prepare("INSERT OR IGNORE INTO tokens (hash, id, created) VALUES (?1, ?2, ?3)")
      .bind(hash, id, Date.now()).run();
    // Кто-то зарегистрировал тот же токен параллельно.
    if (!res.meta.changes) return json({ error: "token already registered", code: "taken" }, 409, cors);
    stick = { hash, id };
  }
  const access = await issueAccess(env, hash, "owner", request.headers.get("User-Agent"));
  return json({ stick: stick.id, access }, 201, cors);
}

// ---------- Схема ----------
// schema.sql создаёт таблицы с нуля; здесь — догоняем базы, созданные раньше.

// Миграции выполняются один раз: номер версии схемы лежит в таблице meta, и дальше
// каждый новый экземпляр воркера тратит на проверку одно чтение, а не обход таблиц.
const SCHEMA_VERSION = 13;
let schemaReady = false;
async function ensureSchema(env) {
  if (schemaReady) return;
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT)").run();
  const ver = await env.DB.prepare("SELECT v FROM meta WHERE k = 'schema'").first();
  if (ver && Number(ver.v) >= SCHEMA_VERSION) { schemaReady = true; return; }
  const cols = async (table) => (await env.DB.prepare(`PRAGMA table_info(${table})`).all()).results.map((c) => c.name);
  const readingCols = await cols("readings");
  if (readingCols.length && !readingCols.includes("owner")) {
    await env.DB.prepare("ALTER TABLE readings ADD COLUMN owner TEXT").run();
  }
  await env.DB.batch([
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_readings_owner_device_ts ON readings (owner, device, ts)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS tokens (hash TEXT PRIMARY KEY, id TEXT, created INTEGER NOT NULL, last_seen INTEGER)"),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS access_keys (
      hash TEXT PRIMARY KEY, token_hash TEXT NOT NULL, kind TEXT NOT NULL, created INTEGER NOT NULL)`),
  ]);
  const keyCols = await cols("access_keys");
  if (!keyCols.includes("last_used")) await env.DB.prepare("ALTER TABLE access_keys ADD COLUMN last_used INTEGER").run();
  if (!keyCols.includes("user_agent")) await env.DB.prepare("ALTER TABLE access_keys ADD COLUMN user_agent TEXT").run();
  const tokenCols = await cols("tokens");
  if (!tokenCols.includes("id")) await env.DB.prepare("ALTER TABLE tokens ADD COLUMN id TEXT").run();
  if (!tokenCols.includes("batch_start")) await env.DB.prepare("ALTER TABLE tokens ADD COLUMN batch_start INTEGER").run();
  if (!tokenCols.includes("formula")) await env.DB.prepare("ALTER TABLE tokens ADD COLUMN formula TEXT").run();
  if (!tokenCols.includes("units")) await env.DB.prepare("ALTER TABLE tokens ADD COLUMN units TEXT").run();
  if (!tokenCols.includes("style")) await env.DB.prepare("ALTER TABLE tokens ADD COLUMN style TEXT").run();
  if (!tokenCols.includes("fg_target")) await env.DB.prepare("ALTER TABLE tokens ADD COLUMN fg_target REAL").run();
  if (!tokenCols.includes("t_lo")) await env.DB.prepare("ALTER TABLE tokens ADD COLUMN t_lo REAL").run();
  if (!tokenCols.includes("t_hi")) await env.DB.prepare("ALTER TABLE tokens ADD COLUMN t_hi REAL").run();
  for (const [col, type] of [["ai_engine", "TEXT"], ["ai_key", "TEXT"], ["ai_limit", "INTEGER"], ["ai_len", "TEXT"], ["recipe", "TEXT"], ["stage_marks", "TEXT"], ["t_offset", "REAL"]]) {
    if (!tokenCols.includes(col)) await env.DB.prepare(`ALTER TABLE tokens ADD COLUMN ${col} ${type}`).run();
  }
  const fixes = [
    env.DB.prepare("UPDATE tokens SET id = lower(hex(randomblob(6))) WHERE id IS NULL"),
    env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_tokens_id ON tokens (id)"),
  ];
  // Старый общий токен — обычный стик; показания, пришедшие до токенов, — его.
  if (env.INGEST_TOKEN) {
    const h = await sha256(env.INGEST_TOKEN);
    fixes.unshift(
      env.DB.prepare("INSERT OR IGNORE INTO tokens (hash, created) VALUES (?1, ?2)").bind(h, Date.now()),
      env.DB.prepare("UPDATE readings SET owner = ?1 WHERE owner IS NULL").bind(h),
    );
  }
  // Последнее показание каждого iSpindel — чтобы список устройств и проверка частоты
  // читали одну строку, а не всю историю. Заполняем один раз из readings.
  fixes.push(
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS latest (
      owner TEXT NOT NULL, device TEXT NOT NULL, ts INTEGER NOT NULL, chip_id TEXT, angle REAL, temperature REAL,
      temp_units TEXT, battery REAL, gravity REAL, interval_s INTEGER, rssi INTEGER, PRIMARY KEY (owner, device))`),
    // Только при первом появлении latest (до версии 8): позже её ведёт приём показаний, а устройства,
    // убранные из неё вручную, пересборка вернула бы обратно.
    ...(!ver || Number(ver.v) < 8 ? [env.DB.prepare(`INSERT OR REPLACE INTO latest (owner, device, ts, chip_id, angle, temperature, temp_units, battery, gravity, interval_s, rssi)
      SELECT owner, device, ts, chip_id, angle, temperature, temp_units, battery, gravity, interval_s, rssi
      FROM readings WHERE owner IS NOT NULL ORDER BY ts`)] : []),
    // Push-подписки устройств и состояние оповещений (чтобы не повторять одно и то же).
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS push_subs (
      endpoint TEXT NOT NULL, token_hash TEXT NOT NULL, key_hash TEXT, p256dh TEXT NOT NULL, auth TEXT NOT NULL,
      events TEXT, lang TEXT, created INTEGER, PRIMARY KEY (endpoint, token_hash))`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS alert_state (
      token_hash TEXT NOT NULL, kind TEXT NOT NULL, active INTEGER, at INTEGER, ref INTEGER, PRIMARY KEY (token_hash, kind))`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS alert_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT, token_hash TEXT NOT NULL, ts INTEGER NOT NULL, event TEXT, key TEXT, params TEXT)`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_alert_log ON alert_log (token_hash, ts)"),
    // Чат с AI по партиям: по нему же считается лимит вопросов за сутки.
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS ai_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT, token_hash TEXT NOT NULL, batch_start INTEGER, ts INTEGER NOT NULL,
      key_hash TEXT, user_agent TEXT, question TEXT, answer TEXT, lang TEXT, tokens_in INTEGER, tokens_out INTEGER)`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_ai_log ON ai_log (token_hash, ts)"),
    // Свои рецепты стика (JSON в формате web/recipe.js).
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS recipes (
      owner TEXT NOT NULL, id TEXT NOT NULL, json TEXT NOT NULL, created INTEGER NOT NULL, updated INTEGER NOT NULL, PRIMARY KEY (owner, id))`),
    env.DB.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES ('schema', ?1)").bind(String(SCHEMA_VERSION)),
  );
  await env.DB.batch(fixes);
  schemaReady = true;
}

// ---------- Приём ----------

async function ingest(raw, env, url, ctx) {
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return text("Bad JSON", 400, "bad json");
  }

  const token = body.token ?? url.searchParams.get("token");
  if (!token) return text("Unauthorized", 401, "no token in request");
  const stick = await stickByToken(env, String(token));
  if (!stick) return text("Unauthorized", 401, "unknown token — add it in the app first");
  const owner = stick.hash;

  const device = String(body.name ?? "iSpindel").slice(0, 64);
  const last = await env.DB.prepare("SELECT ts, temperature, temp_units FROM latest WHERE owner = ?1 AND device = ?2").bind(owner, device).first();
  const gap = last && last.ts ? Date.now() - last.ts : Infinity;
  if (gap < MIN_GAP_MS - GAP_TOLERANCE_MS) {
    return text("Too Many Requests", 429, `too frequent: ${Math.round(gap / 1000)} s since the last reading, minimum 60 s`);
  }
  const row = {
    ts: Date.now(),
    owner,
    device,
    chip_id: body.ID != null ? String(body.ID) : null,
    angle: num(body.angle),
    temperature: num(body.temperature),
    temp_units: body.temp_units ? String(body.temp_units).slice(0, 2) : "C",
    battery: num(body.battery),
    gravity: num(body.gravity),
    interval_s: int(body.interval),
    rssi: int(body.RSSI ?? body.rssi),
  };

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO readings (ts, owner, device, chip_id, angle, temperature, temp_units, battery, gravity, interval_s, rssi)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`
    ).bind(row.ts, row.owner, row.device, row.chip_id, row.angle, row.temperature, row.temp_units,
           row.battery, row.gravity, row.interval_s, row.rssi),
    env.DB.prepare(
      `INSERT OR REPLACE INTO latest (owner, device, ts, chip_id, angle, temperature, temp_units, battery, gravity, interval_s, rssi)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`
    ).bind(row.owner, row.device, row.ts, row.chip_id, row.angle, row.temperature, row.temp_units,
           row.battery, row.gravity, row.interval_s, row.rssi),
    env.DB.prepare("UPDATE tokens SET last_seen = ?1 WHERE hash = ?2").bind(row.ts, owner),
  ]);
  // Оповещения — после ответа iSpindel, чтобы он не ждал рассылки.
  const alerts = onReading(env, stick, row, last).catch((e) => console.error("alerts", e));
  if (ctx) ctx.waitUntil(alerts); else await alerts;

  return text("ok", 200);
}

// Начало партии одно на стик: перезапуск партии виден всем, у кого есть доступ.
// Партия одна на стик: начало, стиль пива и ожидаемая конечная плотность (°P) видны всем, у кого есть доступ.
// Передаются только изменяемые поля: {start?, style?, fg?}.
async function setBatch(request, env, stick, cors) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "bad json" }, 400, cors); }
  if (!body || typeof body !== "object") return json({ error: "bad json" }, 400, cors);
  const now = Date.now();
  const sets = [], params = [];
  if ("start" in body) {
    const start = body.start;
    if (start !== null && !(Number.isInteger(start) && start > 1577836800000 && start < now + 86400000)) {
      return json({ error: "bad start" }, 400, cors);
    }
    sets.push("batch_start"); params.push(start);
  }
  if ("style" in body) {
    const style = body.style;
    if (style !== null && !(typeof style === "string" && /^[a-z0-9-]{1,40}$/.test(style))) return json({ error: "bad style" }, 400, cors);
    sets.push("style"); params.push(style);
  }
  if ("fg" in body) {
    const fg = body.fg;
    if (fg !== null && !(typeof fg === "number" && Number.isFinite(fg) && fg > -5 && fg < 30)) return json({ error: "bad fg" }, 400, cors);
    sets.push("fg_target"); params.push(fg);
  }
  if ("range" in body) {
    // Норма температуры (°C) для оповещений — из стиля пива, её присылает приложение.
    const r = body.range;
    const ok = r === null || (Array.isArray(r) && r.length === 2 && r.every((v) => typeof v === "number" && v > -10 && v < 50) && r[0] < r[1]);
    if (!ok) return json({ error: "bad range" }, 400, cors);
    sets.push("t_lo", "t_hi"); params.push(r ? r[0] : null, r ? r[1] : null);
  }
  if ("marks" in body || ("start" in body && body.start !== (stick.batch_start ?? null))) {
    // Стадии, отмеченные вручную («Завершено» в списке стадий): [{id, at}]. Новая партия их сбрасывает.
    const m = "marks" in body ? body.marks : null;
    const stages = ["lag", "active", "slowing", "checking", "done", "ready"];
    const ok = m === null || (Array.isArray(m) && m.length <= 12 && m.every((x) => x && stages.includes(x.id) && Number.isInteger(x.at) && x.at > 1577836800000 && x.at < now + 86400000));
    if (!ok) return json({ error: "bad marks" }, 400, cors);
    sets.push("stage_marks"); params.push(m && m.length ? JSON.stringify(m.map((x) => ({ id: x.id, at: x.at }))) : null);
  }
  if ("recipe" in body) {
    // Рецепт партии: lib:<id> — из библиотеки приложения, my:<id> — свой рецепт стика.
    const r = body.recipe;
    if (r !== null && !(typeof r === "string" && /^(lib|my):[a-z0-9-]{1,40}$/.test(r))) return json({ error: "bad recipe" }, 400, cors);
    sets.push("recipe"); params.push(r);
  }
  if (!sets.length) return json({ error: "nothing to update" }, 400, cors);
  const sql = `UPDATE tokens SET ${sets.map((c, i) => `${c} = ?${i + 1}`).join(", ")} WHERE hash = ?${sets.length + 1}`;
  await env.DB.prepare(sql).bind(...params, stick.hash).run();
  return json({ ok: true }, 200, cors);
}

// Полином плотности по наклону — один на стик. Те же правила, что и в приложении:
// только числа, tilt и + - * / ^ ( ). Пустая строка — брать плотность, посчитанную iSpindel.
async function setFormula(request, env, stick, cors) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "bad json" }, 400, cors); }
  const raw = body && typeof body.formula === "string" ? body.formula.trim() : null;
  if (raw === null) return json({ error: "bad formula" }, 400, cors);
  if (raw.length > 300 || !/^[0-9tilTIL.+\-*/^()eE\s]*$/.test(raw)) return json({ error: "bad formula" }, 400, cors);
  const formula = raw || null;
  await env.DB.prepare("UPDATE tokens SET formula = ?1 WHERE hash = ?2").bind(formula, stick.hash).run();
  return json({ formula: formula ?? "" }, 200, cors);
}

// ---------- Чтение ----------

async function devices(env, stick, cors) {
  const owner = stick.hash;
  const { results } = await env.DB.prepare(
    `SELECT ts, device, chip_id, angle, temperature, temp_units, battery, gravity, interval_s, rssi
     FROM latest WHERE owner = ?1 ORDER BY device`
  ).bind(owner).all();
  return json({ stick: stick.id, batch_start: stick.batch_start ?? null, formula: stick.formula ?? "", units: stick.units || "auto", t_offset: stick.t_offset ?? 0,
    style: stick.style ?? null, fg: stick.fg_target ?? null, recipe: stick.recipe ?? null, marks: stick.stage_marks ? JSON.parse(stick.stage_marks) : [], range: stick.t_lo != null ? [stick.t_lo, stick.t_hi] : null, admin: stick.key_kind === "owner", devices: results }, 200, cors);
}

// История. ?after=ts — только новые строки после ts (приложение так догружает раз в минуту).
// Полная загрузка: если строк за период больше MAX_POINTS, усредняем по корзинам. Сколько строк,
// оцениваем по интервалу iSpindel, а не COUNT(*) — тот читает всю историю и съедает лимит D1.
async function readings(env, owner, url, cors) {
  const device = url.searchParams.get("device");
  const now = Date.now();
  const after = int(url.searchParams.get("after"));
  const from = after ?? int(url.searchParams.get("from")) ?? now - 24 * 3600 * 1000;
  const to = int(url.searchParams.get("to")) ?? now;

  let where = after != null ? `r.owner = ?1 AND r.ts > ?2 AND r.ts <= ?3` : `r.owner = ?1 AND r.ts BETWEEN ?2 AND ?3`;
  const params = [owner, from, to];
  if (device) {
    where += ` AND r.device = ?4`;
    params.push(device);
  }
  const cols = `r.ts, r.device, r.angle, r.temperature, r.temp_units, r.battery, r.gravity, r.interval_s, r.rssi`;
  let bucket = 0;
  if (after == null && device) {
    const first = await env.DB.prepare(`SELECT MIN(r.ts) AS t FROM readings r WHERE ${where}`).bind(...params).first();
    const last = await env.DB.prepare("SELECT interval_s FROM latest WHERE owner = ?1 AND device = ?2").bind(owner, device).first();
    const start = first && first.t != null ? first.t : to;
    const interval = Math.max(60, (last && last.interval_s) || 60);
    if ((to - start) / (interval * 1000) > MAX_POINTS) bucket = Math.ceil((to - start) / MAX_POINTS);
  }
  const sql = bucket
    ? `SELECT MAX(r.ts) AS ts, r.device AS device, AVG(r.angle) AS angle, AVG(r.temperature) AS temperature,
              MAX(r.temp_units) AS temp_units, AVG(r.battery) AS battery, AVG(r.gravity) AS gravity,
              MAX(r.interval_s) AS interval_s, ROUND(AVG(r.rssi)) AS rssi
       FROM readings r WHERE ${where} GROUP BY r.device, r.ts / ${bucket} ORDER BY MAX(r.ts) ASC`
    : `SELECT ${cols} FROM readings r WHERE ${where} ORDER BY r.ts ASC LIMIT ${MAX_ROWS}`;
  const { results } = await env.DB.prepare(sql).bind(...params).all();
  return json({ from, to, count: results.length, bucket, readings: results }, 200, cors);
}

async function battery(env, owner, url, cors) {
  const device = url.searchParams.get("device");
  const days = Math.min(Math.max(int(url.searchParams.get("days")) ?? 14, 1), 60);
  const from = Date.now() - days * 86400 * 1000;
  let sql = `SELECT (ts / 3600000) * 3600000 AS hour, AVG(battery) AS v, COUNT(*) AS n
             FROM readings WHERE owner = ?1 AND ts >= ?2 AND battery IS NOT NULL`;
  const params = [owner, from];
  if (device) {
    sql += ` AND device = ?3`;
    params.push(device);
  }
  sql += ` GROUP BY hour ORDER BY hour`;
  const { results } = await env.DB.prepare(sql).bind(...params).all();
  return json({ days, hours: results }, 200, cors);
}

function corsHeaders(request, env) {
  const allowed = (env.ALLOWED_ORIGIN || "*").split(",").map((s) => s.trim());
  const origin = request.headers.get("Origin");
  let value = "*";
  if (!allowed.includes("*")) value = origin && allowed.includes(origin) ? origin : allowed[0];
  return {
    "Access-Control-Allow-Origin": value,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Access",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function num(v) {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

function int(v) {
  if (v == null || v === "") return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

function json(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}

function text(body, status, reason) {
  const headers = { "Content-Type": "text/plain" };
  if (reason) headers["X-Reason"] = reason;
  return new Response(body, { status, headers });
}

// Последние попытки отправки — чтобы понять, почему iSpindel не доходит. Токен в лог не пишем.
const LOG_KEEP = 50;
async function logAttempt(env, request, url, raw, status, reason) {
  try {
    const sample = raw.slice(0, 300).replace(/("token"\s*:\s*")[^"]*"/, '$1***"');
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO ingest_log (ts, path, status, reason, content_type, user_agent, body)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
      ).bind(Date.now(), url.pathname + (url.search ? "?…" : ""), status, reason ?? null,
             request.headers.get("Content-Type"), request.headers.get("User-Agent"), sample),
      env.DB.prepare(`DELETE FROM ingest_log WHERE id <= (SELECT MAX(id) FROM ingest_log) - ${LOG_KEEP}`),
    ]);
  } catch (err) {
    console.error("ingest_log", err);
  }
}
