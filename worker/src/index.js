// iSpindel → Cloudflare D1.
//   POST /ingest            — сюда шлёт iSpindel (HTTP или HTTPS Post), JSON
//   GET  /api/devices       — список устройств с последним показанием
//   GET  /api/readings      — история: ?device=&from=&to= (ms UTC)
//   GET  /api/health        — проверка
//
// Секреты/переменные:
//   INGEST_TOKEN   (secret)   — должен совпадать с полем Token в iSpindel
//   READ_TOKEN     (secret, необязательно) — если задан, чтение только с ключом
//   ALLOWED_ORIGIN (var)      — откуда разрешено читать, напр. https://vladcherry.github.io

const MAX_ROWS = 20000;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    try {
      // iSpindel иногда шлёт на "/" — принимаем и туда.
      if (request.method === "POST" && (url.pathname === "/ingest" || url.pathname === "/")) {
        return await ingest(request, env, url);
      }
      if (request.method === "GET" && url.pathname === "/api/health") {
        return json({ ok: true, time: Date.now() }, 200, cors);
      }
      if (request.method === "GET" && url.pathname.startsWith("/api/")) {
        if (!readAllowed(request, env, url)) return json({ error: "Нужен ключ чтения" }, 401, cors);
        if (url.pathname === "/api/devices") return await devices(env, cors);
        if (url.pathname === "/api/readings") return await readings(env, url, cors);
      }
      return json({ error: "Not found" }, 404, cors);
    } catch (err) {
      console.error(err);
      return json({ error: String(err && err.message || err) }, 500, cors);
    }
  },
};

async function ingest(request, env, url) {
  let body;
  try {
    body = await request.json();
  } catch {
    return text("Bad JSON", 400);
  }

  const token = body.token ?? url.searchParams.get("token");
  if (!env.INGEST_TOKEN || token !== env.INGEST_TOKEN) {
    return text("Unauthorized", 401);
  }

  const device = String(body.name ?? "iSpindel").slice(0, 64);
  const row = {
    ts: Date.now(),
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

  await env.DB.prepare(
    `INSERT INTO readings (ts, device, chip_id, angle, temperature, temp_units, battery, gravity, interval_s, rssi)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`
  ).bind(row.ts, row.device, row.chip_id, row.angle, row.temperature, row.temp_units,
         row.battery, row.gravity, row.interval_s, row.rssi).run();

  return text("ok", 200);
}

async function devices(env, cors) {
  const { results } = await env.DB.prepare(
    `SELECT r.* FROM readings r
     JOIN (SELECT device, MAX(ts) AS ts FROM readings GROUP BY device) last
       ON last.device = r.device AND last.ts = r.ts
     ORDER BY r.device`
  ).all();
  return json({ devices: results }, 200, cors);
}

async function readings(env, url, cors) {
  const device = url.searchParams.get("device");
  const now = Date.now();
  const from = int(url.searchParams.get("from")) ?? now - 24 * 3600 * 1000;
  const to = int(url.searchParams.get("to")) ?? now;

  let sql = `SELECT ts, device, angle, temperature, temp_units, battery, gravity, interval_s, rssi
             FROM readings WHERE ts BETWEEN ?1 AND ?2`;
  const params = [from, to];
  if (device) {
    sql += ` AND device = ?3`;
    params.push(device);
  }
  sql += ` ORDER BY ts ASC LIMIT ${MAX_ROWS}`;

  const { results } = await env.DB.prepare(sql).bind(...params).all();
  return json({ from, to, count: results.length, readings: results }, 200, cors);
}

function readAllowed(request, env, url) {
  if (!env.READ_TOKEN) return true;
  const key = request.headers.get("X-Read-Token") ?? url.searchParams.get("key");
  return key === env.READ_TOKEN;
}

function corsHeaders(request, env) {
  const allowed = (env.ALLOWED_ORIGIN || "*").split(",").map((s) => s.trim());
  const origin = request.headers.get("Origin");
  let value = "*";
  if (!allowed.includes("*")) value = origin && allowed.includes(origin) ? origin : allowed[0];
  return {
    "Access-Control-Allow-Origin": value,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Read-Token",
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

function text(body, status) {
  return new Response(body, { status, headers: { "Content-Type": "text/plain" } });
}
