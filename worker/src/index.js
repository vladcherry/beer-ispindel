// iSpindel → Cloudflare D1.
//   POST /ingest            — сюда шлёт iSpindel (HTTP или HTTPS Post), JSON с полем token
//   POST /api/register      — {token}: зарегистрировать токен стика, в ответ — ключ доступа
//   POST /api/share         — новый ключ доступа к тому же стику (для ссылки «Поделиться»)
//   GET  /api/devices       — устройства стика с последним показанием
//   GET  /api/readings      — история: ?device=&from=&to= (ms UTC)
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
const TOKEN_MIN = 8;
const TOKEN_MAX = 64;

export default {
  async fetch(request, env) {
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
        const stick = await stickByAccess(env, request.headers.get("X-Access"));
        if (!stick) return json({ error: "unknown access key" }, 401, cors);
        return json({ access: await issueAccess(env, stick.hash, "share") }, 200, cors);
      }
      if (request.method === "POST") {
        const raw = await request.text();
        // iSpindel иногда шлёт на "/" — принимаем и туда.
        const res = url.pathname === "/ingest" || url.pathname === "/"
          ? await ingest(raw, env, url)
          : text("Not found", 404);
        await logAttempt(env, request, url, raw, res.status, res.headers.get("X-Reason"));
        return res;
      }
      if (request.method === "GET" && url.pathname === "/api/health") {
        return json({ ok: true, time: Date.now() }, 200, cors);
      }
      if (request.method === "GET" && url.pathname.startsWith("/api/")) {
        const stick = await stickByAccess(env, request.headers.get("X-Access") ?? url.searchParams.get("access"));
        if (!stick) return json({ error: "unknown access key" }, 401, cors);
        if (url.pathname === "/api/devices") return await devices(env, stick, cors);
        if (url.pathname === "/api/readings") return await readings(env, stick.hash, url, cors);
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
  return await env.DB.prepare("SELECT hash, id FROM tokens WHERE hash = ?1").bind(await sha256(token)).first();
}

// Стик по ключу доступа (для чтения).
async function stickByAccess(env, key) {
  if (!key) return null;
  return await env.DB.prepare(
    "SELECT t.hash, t.id FROM access_keys a JOIN tokens t ON t.hash = a.token_hash WHERE a.hash = ?1"
  ).bind(await sha256(key)).first();
}

async function issueAccess(env, tokenHash, kind) {
  const key = randomKey();
  await env.DB.prepare("INSERT INTO access_keys (hash, token_hash, kind, created) VALUES (?1, ?2, ?3, ?4)")
    .bind(await sha256(key), tokenHash, kind, Date.now()).run();
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
  const access = await issueAccess(env, hash, "owner");
  return json({ stick: stick.id, access }, 201, cors);
}

// ---------- Схема ----------
// schema.sql создаёт таблицы с нуля; здесь — догоняем базы, созданные раньше.

let schemaReady = false;
async function ensureSchema(env) {
  if (schemaReady) return;
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
  if (!(await cols("tokens")).includes("id")) {
    await env.DB.prepare("ALTER TABLE tokens ADD COLUMN id TEXT").run();
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
  await env.DB.batch(fixes);
  schemaReady = true;
}

// ---------- Приём ----------

async function ingest(raw, env, url) {
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
    env.DB.prepare("UPDATE tokens SET last_seen = ?1 WHERE hash = ?2").bind(row.ts, owner),
  ]);

  return text("ok", 200);
}

// ---------- Чтение ----------

async function devices(env, stick, cors) {
  const owner = stick.hash;
  const { results } = await env.DB.prepare(
    `SELECT r.ts, r.device, r.chip_id, r.angle, r.temperature, r.temp_units, r.battery, r.gravity, r.interval_s, r.rssi
     FROM readings r
     JOIN (SELECT device, MAX(ts) AS ts FROM readings WHERE owner = ?1 GROUP BY device) last
       ON last.device = r.device AND last.ts = r.ts
     WHERE r.owner = ?1
     ORDER BY r.device`
  ).bind(owner).all();
  return json({ stick: stick.id, devices: results }, 200, cors);
}

async function readings(env, owner, url, cors) {
  const device = url.searchParams.get("device");
  const now = Date.now();
  const from = int(url.searchParams.get("from")) ?? now - 24 * 3600 * 1000;
  const to = int(url.searchParams.get("to")) ?? now;

  let sql = `SELECT ts, device, angle, temperature, temp_units, battery, gravity, interval_s, rssi
             FROM readings WHERE owner = ?1 AND ts BETWEEN ?2 AND ?3`;
  const params = [owner, from, to];
  if (device) {
    sql += ` AND device = ?4`;
    params.push(device);
  }
  sql += ` ORDER BY ts ASC LIMIT ${MAX_ROWS}`;

  const { results } = await env.DB.prepare(sql).bind(...params).all();
  return json({ from, to, count: results.length, readings: results }, 200, cors);
}

function corsHeaders(request, env) {
  const allowed = (env.ALLOWED_ORIGIN || "*").split(",").map((s) => s.trim());
  const origin = request.headers.get("Origin");
  let value = "*";
  if (!allowed.includes("*")) value = origin && allowed.includes(origin) ? origin : allowed[0];
  return {
    "Access-Control-Allow-Origin": value,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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
