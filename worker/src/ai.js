// AI-помощник по партии (DeepSeek). Ключ и настройки — у стика, их задаёт админ; ключ не покидает сервер.
// Лимит вопросов — общий на стик в сутки (UTC). Журнал чата — по партии: новая партия начинает с чистого листа.
// В запрос уходит только сжатая сводка партии от приложения (одна строка) и последняя пара вопрос–ответ.

const ENGINES = { "deepseek-chat": { max: { short: 220, medium: 450 } }, "deepseek-reasoner": { max: { short: 1600, medium: 2400 } } };
const LANGS = { en: "English", ru: "Russian", uk: "Ukrainian", es: "Spanish" };
const WORDS = { short: 80, medium: 160 };
const DAY = 86400e3;
const dayStart = (now) => now - (now % DAY);

const api = (env) => (env.AI_BASE || "https://api.deepseek.com").replace(/\/+$/, "");
const keyHint = (k) => k ? `${k.slice(0, 3)}…${k.slice(-4)}` : null;

async function usedToday(env, stick, now) {
  const r = await env.DB.prepare("SELECT COUNT(*) AS n FROM ai_log WHERE token_hash = ?1 AND ts >= ?2").bind(stick.hash, dayStart(now)).first();
  return r ? r.n : 0;
}

async function config(env, stick) {
  return await env.DB.prepare("SELECT ai_engine, ai_key, ai_limit, ai_len, batch_start FROM tokens WHERE hash = ?1").bind(stick.hash).first();
}

// Состояние для приложения (?log=1 — вместе с чатом партии). Ключ — только подсказкой и только админу.
export async function aiState(env, stick, url, json, cors) {
  const c = await config(env, stick), now = Date.now();
  const used = await usedToday(env, stick, now);
  const limit = c.ai_limit ?? 10;
  const { results } = url.searchParams.get("log") ? await env.DB.prepare(
    `SELECT ts, question, answer, user_agent, key_hash FROM ai_log
     WHERE token_hash = ?1 AND batch_start IS ?2 ORDER BY ts DESC LIMIT 50`
  ).bind(stick.hash, c.batch_start ?? null).all() : { results: null };
  return json({
    enabled: !!(c.ai_key && c.ai_engine), engine: c.ai_engine || "deepseek-chat", limit, used, left: Math.max(0, limit - used),
    len: c.ai_len || "short", resetAt: dayStart(now) + DAY,
    key: stick.key_kind === "owner" ? keyHint(c.ai_key) : undefined,
    log: results && results.reverse().map((r) => ({ ts: r.ts, q: r.question, a: r.answer, ua: r.user_agent, mine: r.key_hash === stick.keyHash })),
  }, 200, cors);
}

// Настройки (только админ): {engine?, key?, limit?, len?, off?}
export async function aiConfig(request, env, stick, json, cors) {
  if (stick.key_kind !== "owner") return json({ error: "only an admin can set up AI" }, 403, cors);
  let b;
  try { b = await request.json(); } catch { return json({ error: "bad json" }, 400, cors); }
  if (b.off) {
    await env.DB.prepare("UPDATE tokens SET ai_key = NULL WHERE hash = ?1").bind(stick.hash).run();
    return json({ ok: true, enabled: false }, 200, cors);
  }
  const sets = [], params = [];
  if ("engine" in b) {
    if (!ENGINES[b.engine]) return json({ error: "bad engine" }, 400, cors);
    sets.push("ai_engine"); params.push(b.engine);
  }
  if ("key" in b && b.key) {
    if (typeof b.key !== "string" || !/^[\x21-\x7e]{10,200}$/.test(b.key)) return json({ error: "bad key" }, 400, cors);
    sets.push("ai_key"); params.push(b.key);
    if (!("engine" in b)) { sets.push("ai_engine"); params.push("deepseek-chat"); }
  }
  if ("limit" in b) {
    if (!Number.isInteger(b.limit) || b.limit < 1 || b.limit > 200) return json({ error: "bad limit" }, 400, cors);
    sets.push("ai_limit"); params.push(b.limit);
  }
  if ("len" in b) {
    if (!WORDS[b.len]) return json({ error: "bad length" }, 400, cors);
    sets.push("ai_len"); params.push(b.len);
  }
  if (!sets.length) return json({ error: "nothing to update" }, 400, cors);
  await env.DB.prepare(`UPDATE tokens SET ${sets.map((c, i) => `${c} = ?${i + 1}`).join(", ")} WHERE hash = ?${sets.length + 1}`)
    .bind(...params, stick.hash).run();
  return json({ ok: true }, 200, cors);
}

// Проверить ключ (только админ): список моделей не тратит токены.
export async function aiTest(env, stick, json, cors) {
  if (stick.key_kind !== "owner") return json({ error: "only an admin can set up AI" }, 403, cors);
  const c = await config(env, stick);
  if (!c.ai_key) return json({ error: "no key" }, 400, cors);
  const res = await fetch(api(env) + "/models", { headers: { Authorization: `Bearer ${c.ai_key}` } });
  if (!res.ok) return json({ ok: false, status: res.status, error: await errorText(res) }, 200, cors);
  return json({ ok: true }, 200, cors);
}

async function errorText(res) {
  try { const j = await res.json(); return (j.error && (j.error.message || j.error)) || res.statusText; }
  catch { return res.statusText || String(res.status); }
}

// Вопрос: {question, context, lang}. context — сжатая строка-сводка партии от приложения.
export async function aiAsk(request, env, stick, json, cors) {
  let b;
  try { b = await request.json(); } catch { return json({ error: "bad json" }, 400, cors); }
  const question = String(b.question || "").trim().slice(0, 500);
  if (!question) return json({ error: "empty question" }, 400, cors);
  const context = String(b.context || "").replace(/\s+/g, " ").slice(0, 400);
  const lang = LANGS[b.lang] ? b.lang : "en";
  const c = await config(env, stick), now = Date.now();
  if (!c.ai_key || !ENGINES[c.ai_engine || ""]) return json({ error: "AI is not set up", code: "off" }, 400, cors);
  const limit = c.ai_limit ?? 10, used = await usedToday(env, stick, now);
  if (used >= limit) return json({ error: "daily limit reached", code: "limit", resetAt: dayStart(now) + DAY }, 429, cors);

  // Последняя пара из чата этой партии — для уточнений («а если 20 °C?»), обрезанная.
  const prev = await env.DB.prepare(
    "SELECT question, answer FROM ai_log WHERE token_hash = ?1 AND batch_start IS ?2 ORDER BY ts DESC LIMIT 1"
  ).bind(stick.hash, c.batch_start ?? null).first();
  const len = c.ai_len || "short";
  const messages = [
    { role: "system", content: `Homebrew fermentation expert. Data: ${context || "none"}. Units °P, °C; r=gravity drop °P/day. Reply in ${LANGS[lang]}, ≤${WORDS[len]} words, practical, no preamble.` },
  ];
  if (prev) {
    messages.push({ role: "user", content: prev.question.slice(0, 200) }, { role: "assistant", content: prev.answer.slice(0, 300) });
  }
  messages.push({ role: "user", content: question });

  const res = await fetch(api(env) + "/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${c.ai_key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: c.ai_engine, messages, max_tokens: ENGINES[c.ai_engine].max[len], temperature: 0.4, stream: false }),
  });
  if (!res.ok) return json({ error: `DeepSeek ${res.status}: ${await errorText(res)}`, code: "upstream" }, 502, cors);
  const data = await res.json();
  const answer = String(data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content || "").trim();
  if (!answer) return json({ error: "empty answer", code: "upstream" }, 502, cors);
  const u = data.usage || {};
  await env.DB.prepare(
    `INSERT INTO ai_log (token_hash, batch_start, ts, key_hash, user_agent, question, answer, lang, tokens_in, tokens_out)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`
  ).bind(stick.hash, c.batch_start ?? null, now, stick.keyHash, (request.headers.get("User-Agent") || "").slice(0, 300),
    question, answer, lang, u.prompt_tokens ?? null, u.completion_tokens ?? null).run();
  return json({ answer, ts: now, left: Math.max(0, limit - used - 1), limit }, 200, cors);
}
