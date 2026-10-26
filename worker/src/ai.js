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

// ---------- Рецепты из файла ----------
// Приложение присылает текст файла (md, txt; из pdf текст достаёт браузер), язык и id известных стилей.
// Сначала модель перечисляет рецепты в тексте, затем каждый рецепт разбирается отдельным запросом
// (параллельно, с одним и тем же началом промта — DeepSeek кэширует его) в формат v1 и проверяется
// правилами web/recipe.js; при ошибках — одна попытка исправить. В лимит идёт как один вопрос.
import "../../web/recipe.js";
const IMPORT_MAX_TEXT = 40000;
const IMPORT_MAX_RECIPES = 6;

function importPrompt(lang, styles, file) {
  const L = LANGS[lang];
  return `You convert homebrew beer recipes from a user's file into the JSON format of a fermentation app. The file «${file}» is below.
Write all user-facing text (names, notes) in ${L}, translating if needed; keep product names (malts, hops, yeast) as written. Reply ONLY with JSON.
Recipe JSON, format v1 (units: °P, °C, L, kg, g):
{"v":1,"id":"latin-kebab-case","style":one of ${JSON.stringify(styles)} (closest match),"name":{"${lang}":"...","en":"..."},"batch_l":L,"efficiency":0.72,"boil_min":60,"og":°P,"fg":°P,"abv":%,"ibu":n,"ebc":n,
"water":{"mash_l":L,"sparge_l":L,"preboil_l":L},
"fermentables":[{"name":{"${lang}":"...","en":"..."},"kg":n,"type":"grain|adjunct|sugar"}],
"hops":[{"name":"product name","g":n,"alpha":%,"use":"boil|first_wort|whirlpool|dry","min":n (boil, whirlpool),"days":n (dry)}],
"other":[{"name":{"${lang}":"..."},"g":n,"use":"mash|boil|bottling","min":n?}],
"yeast":{"name":"product name","amount":"1 × 11.5 g"},"mash":[{"temp":°C,"min":n}],
"fermentation":[{"until":{"stage":"lag|active|slowing|checking|done|ready"} or {"plato":n} or {"days":n},"temp":[lo,hi],"note":{"${lang}":"..."}}],
"priming":{"vol_co2":n,"sugar":"sucrose|dextrose"},"notes":{"${lang}":"..."}}
Rules:
- Take numbers from the file; do not invent a different recipe. Convert units: SG to °P (°P = 259 − 259/SG), °F to °C, lb/oz to kg/g, gal to L. For a range take the middle.
- batch_l is the volume into the fermenter if the file gives it, otherwise the final volume.
- If OG, FG, IBU, colour or ABV are missing, estimate them (IBU by Tinseth, colour in EBC); og > fg.
- Priming: if the file gives sugar in g/L, convert it to vol_co2 = 0.86 + g/L ÷ 3.82 (sucrose; for dextrose divide g/L by 1.1 first).
- 1-4 fermentation steps in order; until "done" for the last active step unless the file says otherwise.
- Process details that do not fit the fields (mash steps rationale, dry-hop timing, variants, serving advice) go briefly into step notes (≤300 chars each) and "notes" (≤1500 chars).
- Ignore shopping lists, prices and shop names.`;
}

export async function aiImport(request, env, stick, json, cors) {
  let b;
  try { b = await request.json(); } catch { return json({ error: "bad json" }, 400, cors); }
  const lang = LANGS[b.lang] ? b.lang : "en";
  const styles = Array.isArray(b.styles) ? b.styles.filter((s) => typeof s === "string" && /^[a-z0-9-]{1,40}$/.test(s)).slice(0, 80) : [];
  const file = String(b.file || "file").replace(/[\r\n«»]/g, " ").slice(0, 80);
  const text = String(b.text || "").replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (text.length < 30) return json({ error: "the file has no text", code: "empty" }, 400, cors);
  const c = await config(env, stick), now = Date.now();
  if (!c.ai_key || !ENGINES[c.ai_engine || ""]) return json({ error: "AI is not set up", code: "off" }, 400, cors);
  const limit = c.ai_limit ?? 10, used = await usedToday(env, stick, now);
  if (used >= limit) return json({ error: "daily limit reached", code: "limit", resetAt: dayStart(now) + DAY }, 429, cors);

  const head = [
    { role: "system", content: importPrompt(lang, styles, file) },
    { role: "user", content: "FILE:\n" + text.slice(0, IMPORT_MAX_TEXT) },
  ];
  const tokens = { in: 0, out: 0 };
  // Разбор на deepseek-chat: JSON-режим и предсказуемое время ответа.
  const call = async (msgs, max) => {
    const res = await fetch(api(env) + "/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${c.ai_key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "deepseek-chat", messages: msgs, max_tokens: max, temperature: 0.2, response_format: { type: "json_object" }, stream: false }),
    });
    if (!res.ok) throw Object.assign(new Error(`DeepSeek ${res.status}: ${await errorText(res)}`), { upstream: true });
    const data = await res.json(), u = data.usage || {};
    tokens.in += u.prompt_tokens || 0; tokens.out += u.completion_tokens || 0;
    return String(data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content || "");
  };
  // JSON из ответа: целиком или первый {...} (если модель обернула его в текст или ```json).
  const parse = (s) => {
    try { return JSON.parse(s); } catch { /* ниже */ }
    const m = String(s).match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]); } catch { /* не JSON */ } }
    return null;
  };
  const tidy = (r) => {
    if (!r || typeof r !== "object") return r;
    r.v = 1;
    r.id = String(r.id || "").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 34) || "recipe";
    if (r.og > r.fg && !(r.abv > 0)) delete r.abv;
    // Тексты: строка → объект на языке ответа, слишком длинные — обрезаем (не повод браковать рецепт).
    const txt = (v, max) => {
      if (typeof v === "string") v = { [lang]: v };
      if (!v || typeof v !== "object") return undefined;
      const o = {};
      for (const [k, s] of Object.entries(v)) if (LANGS[k] && typeof s === "string" && s.trim()) o[k] = s.trim().slice(0, max);
      return Object.keys(o).length ? o : undefined;
    };
    r.name = txt(r.name, 80) || { [lang]: "Recipe" };
    if ("notes" in r) r.notes = txt(r.notes, 2000);
    if (Array.isArray(r.fermentation)) r.fermentation.forEach((s) => { if (s && "note" in s) s.note = txt(s.note, 300); });
    for (const k of ["fermentables", "other"]) if (Array.isArray(r[k])) r[k].forEach((x) => { if (x && typeof x.name === "string") x.name = x.name.slice(0, 120); else if (x) x.name = txt(x.name, 120); });
    for (const k of ["fermentables", "hops", "other", "mash"]) if (r[k] == null || (Array.isArray(r[k]) && !r[k].length)) delete r[k];
    return r;
  };
  const check = (r) => globalThis.Recipe.check(tidy(r), styles.length ? styles : null);

  let found, results;
  try {
    // 1. Какие рецепты есть в файле.
    const list = parse(await call(head.concat({ role: "user", content:
      `List the beer recipes in the file: {"recipes":[{"title":"name as in the file"}],"say":"one short sentence in ${LANGS[lang]} if there are none"}. At most ${IMPORT_MAX_RECIPES}.` }), 400)) || {};
    found = (Array.isArray(list.recipes) ? list.recipes : []).map((x) => String(x && x.title || "").trim().slice(0, 120)).filter(Boolean).slice(0, IMPORT_MAX_RECIPES);
    if (!found.length) {
      const say = typeof list.say === "string" ? list.say.slice(0, 300) : "";
      await log(`📄 ${file}`, say || "—");
      return json({ recipes: [], say, ...left() }, 200, cors);
    }
    // 2. Каждый рецепт — отдельно и параллельно.
    results = await Promise.all(found.map(async (title, i) => {
      const ask = head.concat({ role: "user", content: `Convert recipe ${i + 1} of ${found.length}, «${title}», to the recipe JSON. Use the file's common conditions (volume, efficiency, water, yeast handling, priming) where they apply. Reply with the recipe object only.` });
      let raw = await call(ask, 3500), r = parse(raw);
      if (r && r.recipe && typeof r.recipe === "object") r = r.recipe;
      let err = r ? check(r) : ["reply is not valid JSON"];
      if (err.length) {
        raw = await call(ask.concat({ role: "assistant", content: raw.slice(0, 8000) },
          { role: "user", content: "Fix these problems and reply with the full recipe JSON again: " + err.join("; ") }), 3500);
        r = parse(raw);
        if (r && r.recipe && typeof r.recipe === "object") r = r.recipe;
        err = r ? check(r) : ["reply is not valid JSON"];
      }
      return err.length ? { title, errors: err.slice(0, 4) } : { title, recipe: r };
    }));
  } catch (e) {
    if (e.upstream) return json({ error: e.message, code: "upstream" }, 502, cors);
    throw e;
  }
  await log(`📄 ${file}`, results.map((x) => (x.recipe ? "✓ " : "✗ ") + (x.recipe ? globalThis.Recipe.loc(x.recipe.name, lang) : x.title)).join("\n"));
  return json({ recipes: results, ...left() }, 200, cors);

  function left() { return { ts: now, left: Math.max(0, limit - used - 1), limit }; }
  async function log(question, answer) {
    await env.DB.prepare(
      `INSERT INTO ai_log (token_hash, batch_start, ts, key_hash, user_agent, question, answer, lang, tokens_in, tokens_out)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`
    ).bind(stick.hash, c.batch_start ?? null, now, stick.keyHash, (request.headers.get("User-Agent") || "").slice(0, 300),
      question, answer, lang, tokens.in || null, tokens.out || null).run();
  }
}
