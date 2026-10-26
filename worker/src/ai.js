// AI-помощник по партии (DeepSeek). Ключ и настройки — у стика, их задаёт админ; ключ не покидает сервер.
// Лимит вопросов — общий на стик в сутки (UTC). Журнал чата — по партии: новая партия начинает с чистого листа.
// В запрос уходит только сжатая сводка партии от приложения (одна строка, с выжимкой рецепта) и последняя пара вопрос–ответ.

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
  const context = String(b.context || "").replace(/\s+/g, " ").slice(0, 800);
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
    { role: "system", content: `Homebrew fermentation expert. Data: ${context || "none"}. Units °P, °C; r=gravity drop °P/day. Reply in ${LANGS[lang]}, ≤${WORDS[len]} words, practical, no preamble, plain words — never use the data codes.` },
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

// ---------- Рецепт в чате ----------
// Приложение присылает ход разговора в режиме рецепта (turns), язык, id известных стилей и, если есть,
// рецепт-основу (base) или текущий черновик (draft). DeepSeek отвечает JSON: короткая реплика, один
// уточняющий вопрос с вариантами или готовый рецепт (формат v1) с тремя названиями. Рецепт проверяется
// правилами web/recipe.js; при ошибках — одна попытка исправить.
import "../../web/recipe.js";
const RECIPE_MAX_TOKENS = 3500;

function recipePrompt(lang, styles, context) {
  const L = LANGS[lang];
  return `You are a homebrew recipe designer inside a fermentation app. Write all user-facing text in ${L}. Reply ONLY with one JSON object:
{"mode":"recipe"|"chat","say":string,"question":{"topic":string,"text":string,"options":[2-5 short strings],"default":string,"n":int,"total":int}|null,"recipe":object|null,"names":[3 strings]|null,"changes":[strings]|null,"stock":[strings]|null}
Flow:
- Ask ONE short question per reply with 2-5 tappable options (3-10 questions overall, fewer if the user already said enough; n = this question's number, total = your estimate).
- First ask the batch volume into the fermenter in litres, unless already known. Then ask which ingredients the user already has and wants to use, unless already said.
- Never ask what the base recipe, the draft or earlier answers already settle. If the user skips or says "enough", use sensible defaults.
- When you have enough, return "recipe" (question = null), 3 short original beer names in ${L} in "names", and a 1-2 sentence summary in "say".
- If a BASE recipe is given, keep everything the user did not ask to change and list the differences in "changes" like "OG 12.0 → 14.4".
- If a DRAFT is given, the user is refining it: apply the request and return the full updated recipe with "changes".
- Use the user's own ingredients where sensible and mark those items with "own": true. If their amounts are not enough or too much, explain in "stock" and suggest a substitute.
- If the message is not about creating or changing a recipe, set mode "chat", answer briefly in "say", question and recipe null.
Recipe JSON, format v1 (units: °P, °C, L, kg, g):
{"v":1,"id":"latin-kebab-case","style":one of ${JSON.stringify(styles)},"name":{"${lang}":"...","en":"..."},"batch_l":L,"efficiency":0.72,"boil_min":60,"og":°P,"fg":°P,"abv":%,"ibu":n,"ebc":n,
"water":{"mash_l":L,"sparge_l":L,"preboil_l":L},
"fermentables":[{"name":{"${lang}":"...","en":"..."},"kg":n,"type":"grain|adjunct|sugar","own":true?}],
"hops":[{"name":"product name","g":n,"alpha":%,"use":"boil|first_wort|whirlpool|dry","min":n (boil, whirlpool),"days":n (dry),"own":true?}],
"other":[{"name":{"${lang}":"...","en":"..."},"g":n,"use":"mash|boil","min":n?}],
"yeast":{"name":"product name","amount":"1 × 11.5 g"},"mash":[{"temp":°C,"min":n}],
"fermentation":[{"until":{"stage":"lag|active|slowing|checking|done|ready"} or {"plato":n} or {"days":n},"temp":[lo,hi],"note":{"${lang}":"..."}}],
"priming":{"vol_co2":n,"sugar":"sucrose"},"notes":{"${lang}":"... ≤300 chars"}}
Rules: og > fg; abv from og/fg; IBU by Tinseth; the grain bill must reach og at the given efficiency for batch_l; 1-4 fermentation steps in order; realistic temperatures for the yeast.
App context (current batch, codes are internal): ${context || "none"}.`;
}

export async function aiRecipe(request, env, stick, json, cors) {
  let b;
  try { b = await request.json(); } catch { return json({ error: "bad json" }, 400, cors); }
  const lang = LANGS[b.lang] ? b.lang : "en";
  const styles = Array.isArray(b.styles) ? b.styles.filter((s) => typeof s === "string" && /^[a-z0-9-]{1,40}$/.test(s)).slice(0, 80) : [];
  const turns = (Array.isArray(b.turns) ? b.turns : []).filter((x) => x && typeof x.text === "string" && x.text.trim())
    .slice(-16).map((x) => ({ role: x.role === "ai" ? "assistant" : "user", content: x.text.slice(0, x.role === "ai" ? 1500 : 600) }));
  if (!turns.length || turns.at(-1).role !== "user") return json({ error: "empty question" }, 400, cors);
  const asJson = (v) => { try { return v && typeof v === "object" ? JSON.stringify(v).slice(0, 12000) : null; } catch { return null; } };
  const base = asJson(b.base), draft = asJson(b.draft);
  const c = await config(env, stick), now = Date.now();
  if (!c.ai_key || !ENGINES[c.ai_engine || ""]) return json({ error: "AI is not set up", code: "off" }, 400, cors);
  const limit = c.ai_limit ?? 10, used = await usedToday(env, stick, now);
  if (used >= limit) return json({ error: "daily limit reached", code: "limit", resetAt: dayStart(now) + DAY }, 429, cors);

  const messages = [{ role: "system", content: recipePrompt(lang, styles, String(b.context || "").replace(/\s+/g, " ").slice(0, 600)) }];
  if (base) messages.push({ role: "system", content: "BASE recipe: " + base });
  if (draft) messages.push({ role: "system", content: "DRAFT recipe: " + draft });
  messages.push(...turns);

  // Рецепт генерируем на deepseek-chat: JSON-режим и предсказуемое время ответа.
  const call = async (msgs) => {
    const res = await fetch(api(env) + "/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${c.ai_key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "deepseek-chat", messages: msgs, max_tokens: RECIPE_MAX_TOKENS, temperature: 0.5, response_format: { type: "json_object" }, stream: false }),
    });
    if (!res.ok) throw Object.assign(new Error(`DeepSeek ${res.status}: ${await errorText(res)}`), { upstream: true });
    const data = await res.json();
    const raw = String(data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content || "");
    return { raw, usage: data.usage || {} };
  };
  // JSON из ответа: целиком или первый {...} (если модель обернула его в текст или ```json).
  const parse = (s) => {
    try { return JSON.parse(s); } catch { /* ниже */ }
    const m = String(s).match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]); } catch { /* не JSON */ } }
    return null;
  };
  let out, raw, usage = {};
  const tidy = (r) => {
    if (!r || typeof r !== "object") return r;
    r.v = 1;
    r.id = String(r.id || "").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 34) || "ai-recipe";
    if (r.og > r.fg && !(r.abv > 0)) r.abv = null;
    // Тексты: строка → объект на языке ответа, слишком длинные — обрезаем (не повод браковать рецепт).
    const txt = (v, max) => {
      if (typeof v === "string") v = { [lang]: v };
      if (!v || typeof v !== "object") return undefined;
      const o = {};
      for (const [k, s] of Object.entries(v)) if (LANGS[k] && typeof s === "string" && s.trim()) o[k] = s.trim().slice(0, max);
      return Object.keys(o).length ? o : undefined;
    };
    r.name = txt(r.name, 80) || { [lang]: "AI recipe" };
    if ("notes" in r) r.notes = txt(r.notes, 2000);
    if (Array.isArray(r.fermentation)) r.fermentation.forEach((s) => { if (s && "note" in s) s.note = txt(s.note, 300); });
    for (const k of ["fermentables", "other"]) if (Array.isArray(r[k])) r[k].forEach((x) => { if (x && typeof x.name === "string") x.name = x.name.slice(0, 120); else if (x) x.name = txt(x.name, 120); });
    return r;
  };
  try {
    ({ raw, usage } = await call(messages));
    out = parse(raw);
    let err = !out ? ["reply is not valid JSON"] : out.recipe ? globalThis.Recipe.check(tidy(out.recipe), styles.length ? styles : null) : [];
    if (err.length) {
      const fix = await call(messages.concat({ role: "assistant", content: raw.slice(0, 8000) },
        { role: "user", content: "Fix these problems and reply with the full JSON object again: " + err.join("; ") }));
      raw = fix.raw; usage = fix.usage;
      out = parse(raw);
      // Совсем не JSON — показываем текст как реплику, разговор продолжается.
      if (!out && raw.trim()) out = { mode: "recipe", say: raw.trim().slice(0, 1200), question: null, recipe: null };
      err = !out ? ["empty reply"] : out.recipe ? globalThis.Recipe.check(tidy(out.recipe), styles.length ? styles : null) : [];
      if (err.length) return json({ error: "AI recipe is invalid: " + err.slice(0, 4).join("; "), code: "invalid" }, 502, cors);
    }
  } catch (e) {
    if (e.upstream) return json({ error: e.message, code: "upstream" }, 502, cors);
    throw e;
  }
  const str = (v, n) => typeof v === "string" ? v.slice(0, n) : "";
  const list = (v, n) => Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, n).map((x) => x.slice(0, 200)) : null;
  const q = out.question && typeof out.question === "object" && str(out.question.text, 300) ? {
    topic: str(out.question.topic, 40), text: str(out.question.text, 300), options: list(out.question.options, 6) || [],
    default: str(out.question.default, 80), n: Number.isInteger(out.question.n) ? out.question.n : null, total: Number.isInteger(out.question.total) ? out.question.total : null,
  } : null;
  const reply = {
    mode: out.mode === "chat" ? "chat" : "recipe", say: str(out.say, 1200), question: out.recipe ? null : q,
    recipe: out.recipe || null, names: out.recipe ? list(out.names, 3) : null, changes: list(out.changes, 20), stock: list(out.stock, 10),
  };
  const question = turns.at(-1).content;
  const answer = [reply.say, q && !reply.recipe ? q.text : null, reply.recipe ? "📄 " + (globalThis.Recipe.loc(reply.recipe.name, lang) || "") : null].filter(Boolean).join("\n") || "…";
  await env.DB.prepare(
    `INSERT INTO ai_log (token_hash, batch_start, ts, key_hash, user_agent, question, answer, lang, tokens_in, tokens_out)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`
  ).bind(stick.hash, c.batch_start ?? null, now, stick.keyHash, (request.headers.get("User-Agent") || "").slice(0, 300),
    question, answer, lang, usage.prompt_tokens ?? null, usage.completion_tokens ?? null).run();
  // Ход для истории — в том же JSON, что ответила модель (без рецепта: он уходит отдельно как DRAFT),
  // иначе на следующем шаге модель начинает отвечать обычным текстом.
  const turn = JSON.stringify({ mode: reply.mode, say: reply.say, question: reply.question, recipe: reply.recipe ? "see DRAFT" : null });
  return json({ ...reply, answer, turn, ts: now, left: Math.max(0, limit - used - 1), limit }, 200, cors);
}
