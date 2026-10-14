// iSpindel → Cloudflare D1.
//   POST /ingest            — сюда шлёт iSpindel (HTTP или HTTPS Post), JSON с полем token
//   POST /api/register      — {token}: завести токен (или убедиться, что он есть)
//   GET  /api/devices       — устройства этого токена с последним показанием
//   GET  /api/readings      — история: ?device=&from=&to= (ms UTC)
//   GET  /api/health        — проверка
//
// Токен — это «пространство»: iSpindel шлёт с ним показания, приложение с ним же читает,
// и видно только то, что пришло с этим токеном. В базе хранится только SHA-256 токена.
// Чтение — с заголовком X-Token.
//
// Секреты/переменные:
//   INGEST_TOKEN   (secret, необязательно) — токен, который работает всегда, даже без регистрации
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
        const owner = await ownerOf(env, request.headers.get("X-Token") ?? url.searchParams.get("token"));
        if (!owner) return json({ error: "unknown token" }, 401, cors);
        if (url.pathname === "/api/devices") return await devices(env, owner, cors);
        if (url.pathname === "/api/readings") return await readings(env, owner, url, cors);
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

// Хеш токена, если токен известен серверу; иначе null.
async function ownerOf(env, token) {
  if (!token) return null;
  const hash = await sha256(token);
  if (env.INGEST_TOKEN && token === env.INGEST_TOKEN) return hash;
  const row = await env.DB.prepare("SELECT hash FROM tokens WHERE hash = ?1").bind(hash).first();
  return row ? hash : null;
}

async function register(request, env, cors) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "bad json" }, 400, cors); }
  const token = body && body.token;
  const problem = tokenProblem(token);
  if (problem) return json({ error: problem }, 400, cors);
  const hash = await sha256(token);
  const res = await env.DB.prepare("INSERT OR IGNORE INTO tokens (hash, created) VALUES (?1, ?2)")
    .bind(hash, Date.now()).run();
  return json({ ok: true, created: res.meta.changes > 0 }, 200, cors);
}

// ---------- Схема ----------
// schema.sql создаёт таблицы с нуля; здесь — догоняем базы, созданные до появления токенов.

let schemaReady = false;
async function ensureSchema(env) {
  if (schemaReady) return;
  const { results } = await env.DB.prepare("PRAGMA table_info(readings)").all();
  if (results.length && !results.some((c) => c.name === "owner")) {
    await env.DB.prepare("ALTER TABLE readings ADD COLUMN owner TEXT").run();
  }
  await env.DB.batch([
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_readings_owner_device_ts ON readings (owner, device, ts)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS tokens (hash TEXT PRIMARY KEY, created INTEGER NOT NULL, last_seen INTEGER)"),
  ]);
  // Показания, пришедшие до появления токенов, принадлежат INGEST_TOKEN.
  if (env.INGEST_TOKEN) {
    await env.DB.prepare("UPDATE readings SET owner = ?1 WHERE owner IS NULL")
      .bind(await sha256(env.INGEST_TOKEN)).run();
  }
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
  const owner = await ownerOf(env, String(token));
  if (!owner) return text("Unauthorized", 401, "unknown token — register it in the app first");

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

async function devices(env, owner, cors) {
  const { results } = await env.DB.prepare(
    `SELECT r.ts, r.device, r.chip_id, r.angle, r.temperature, r.temp_units, r.battery, r.gravity, r.interval_s, r.rssi
     FROM readings r
     JOIN (SELECT device, MAX(ts) AS ts FROM readings WHERE owner = ?1 GROUP BY device) last
       ON last.device = r.device AND last.ts = r.ts
     WHERE r.owner = ?1
     ORDER BY r.device`
  ).bind(owner).all();
  return json({ devices: results }, 200, cors);
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
    "Access-Control-Allow-Headers": "Content-Type, X-Token",
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
