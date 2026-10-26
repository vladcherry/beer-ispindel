// Свои рецепты стика: читают все, у кого есть доступ; пишет и удаляет админ (ключ владельца).
// Новый авторский рецепт (tags: ["authored"], создан в AI-чате) может сохранить любой, удалить — только админ.
// Формат и правила — общие с библиотекой приложения (web/recipe.js); стили воркер не знает, их id
// проверяется только по шаблону.
import "../../web/recipe.js";

const { check, summary } = globalThis.Recipe;
const MAX_RECIPES = 50;
const MAX_BYTES = 32 * 1024;
const ID = /^[a-z0-9-]{1,40}$/;

export async function recipesApi(request, env, stick, url, json, cors) {
  const id = decodeURIComponent(url.pathname.slice("/api/recipes".length).replace(/^\//, ""));
  if (id && !ID.test(id)) return json({ error: "bad id" }, 400, cors);

  if (request.method === "GET" && !id) {
    const { results } = await env.DB.prepare("SELECT json, updated FROM recipes WHERE owner = ?1 ORDER BY updated DESC").bind(stick.hash).all();
    return json({ recipes: results.map((r) => { const j = JSON.parse(r.json); return { ...summary(j), ua: j.origin && j.origin.saved_ua || null, updated: r.updated }; }) }, 200, cors);
  }
  if (request.method === "GET") {
    const r = await env.DB.prepare("SELECT json, updated FROM recipes WHERE owner = ?1 AND id = ?2").bind(stick.hash, id).first();
    if (!r) return json({ error: "no such recipe" }, 404, cors);
    return new Response(r.json, { status: 200, headers: { ...cors, "Content-Type": "application/json; charset=utf-8" } });
  }
  if (!id) return json({ error: "Not found" }, 404, cors);
  const admin = stick.key_kind === "owner";
  if (!admin && request.method !== "PUT") return json({ error: "only an admin can change recipes" }, 403, cors);

  if (request.method === "PUT") {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > MAX_BYTES) return json({ error: "recipe is larger than 32 KB" }, 413, cors);
    let r;
    try { r = JSON.parse(raw); } catch { return json({ error: "bad json" }, 400, cors); }
    const err = check(r);
    if (r && r.id !== id) err.push("id doesn't match the URL");
    if (err.length) return json({ error: err.join("; ") }, 400, cors);
    const now = Date.now();
    const exists = await env.DB.prepare("SELECT 1 FROM recipes WHERE owner = ?1 AND id = ?2").bind(stick.hash, id).first();
    const authored = Array.isArray(r.tags) && r.tags.includes("authored");
    if (!admin && (!authored || exists)) return json({ error: exists ? "a recipe with this id exists" : "only an admin can change recipes" }, exists ? 409 : 403, cors);
    // Кто сохранил — по браузеру, а не со слов приложения.
    if (authored && !exists) r.origin = { ...(r.origin && typeof r.origin === "object" ? r.origin : {}), saved_ua: (request.headers.get("User-Agent") || "").slice(0, 300), saved_at: Date.now() };
    if (!exists) {
      const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM recipes WHERE owner = ?1").bind(stick.hash).first();
      if (n.n >= MAX_RECIPES) return json({ error: `no more than ${MAX_RECIPES} recipes per stick` }, 400, cors);
    }
    await env.DB.prepare(
      `INSERT INTO recipes (owner, id, json, created, updated) VALUES (?1, ?2, ?3, ?4, ?4)
       ON CONFLICT (owner, id) DO UPDATE SET json = excluded.json, updated = excluded.updated`
    ).bind(stick.hash, id, JSON.stringify(r), now).run();
    return json({ ok: true, updated: now }, 200, cors);
  }
  if (request.method === "DELETE") {
    // Рецепт текущей партии отвязываем, цели партии (стиль, КП, норма) остаются как были.
    await env.DB.batch([
      env.DB.prepare("DELETE FROM recipes WHERE owner = ?1 AND id = ?2").bind(stick.hash, id),
      env.DB.prepare("UPDATE tokens SET recipe = NULL WHERE hash = ?1 AND recipe = ?2").bind(stick.hash, "my:" + id),
    ]);
    return json({ ok: true }, 200, cors);
  }
  return json({ error: "Not found" }, 404, cors);
}
