// История варок: когда начинается новая партия (или текущая сбрасывается), прежняя попадает в batches.
// Итоги (НП, плотность в конце, алкоголь, стадия, название) присылает приложение — оно считает плотность
// по полиному и единицам стика; сервер добавляет то, что знает сам: даты, стиль, рецепт, цель КП.
// Читают все, у кого есть доступ к стику; удаляет запись админ.

const MAX_BATCHES = 200;
const STAGES = ["lag", "active", "slowing", "checking", "done", "ready", "stalled", "stuck"];
const num = (v, lo, hi) => typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi ? Math.round(v * 100) / 100 : null;

export async function archiveBatch(env, stick, end, a) {
  const s = a && typeof a === "object" ? a : {};
  const og = num(s.og, 0, 40) ?? stick.og_manual ?? null;
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO batches (owner, start, end, style, recipe, name, og, fg, abv, fg_target, stage, created)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)`
    ).bind(stick.hash, stick.batch_start, end, stick.style ?? null, stick.recipe ?? null,
      typeof s.name === "string" && s.name.trim() ? s.name.trim().slice(0, 80) : null,
      og, num(s.fg, -5, 40), num(s.abv, 0, 25), stick.fg_target ?? null, STAGES.includes(s.stage) ? s.stage : null, Date.now()),
    env.DB.prepare(`DELETE FROM batches WHERE owner = ?1 AND id NOT IN (SELECT id FROM batches WHERE owner = ?1 ORDER BY start DESC LIMIT ${MAX_BATCHES})`).bind(stick.hash),
  ]);
}

export async function listBatches(env, stick, limit = MAX_BATCHES) {
  const { results } = await env.DB.prepare(
    "SELECT id, start, end, style, recipe, name, og, fg, abv, fg_target, stage FROM batches WHERE owner = ?1 ORDER BY start DESC LIMIT ?2"
  ).bind(stick.hash, limit).all();
  return results;
}

export async function batchesApi(request, env, stick, url, json, cors) {
  const id = url.pathname.slice("/api/batches".length).replace(/^\//, "");
  if (request.method === "GET" && !id) return json({ batches: await listBatches(env, stick) }, 200, cors);
  if (request.method === "DELETE" && /^\d{1,12}$/.test(id)) {
    if (stick.key_kind !== "owner") return json({ error: "only an admin can delete batches" }, 403, cors);
    await env.DB.prepare("DELETE FROM batches WHERE owner = ?1 AND id = ?2").bind(stick.hash, Number(id)).run();
    return json({ ok: true }, 200, cors);
  }
  return json({ error: "Not found" }, 404, cors);
}

// Короткая сводка прошлых варок для AI: одна строка на партию.
export async function batchesBrief(env, stick, n = 6) {
  const rows = await listBatches(env, stick, n);
  if (!rows.length) return "";
  const d = (ms) => new Date(ms).toISOString().slice(0, 10);
  const r1 = (v) => String(Math.round(v * 10) / 10);
  return rows.map((b) => [d(b.start), `${Math.max(1, Math.round((b.end - b.start) / 86400e3))}d`, b.name || b.style || "?",
    b.style && b.name ? `(${b.style})` : null, b.recipe ? `recipe=${b.recipe}` : null,
    b.og != null ? `OG${r1(b.og)}` : null, b.fg != null ? `FG${r1(b.fg)}` : null, b.abv != null ? `abv${r1(b.abv)}` : null,
    b.stage ? `end=${b.stage}` : null].filter(Boolean).join(" ")).join("; ");
}
