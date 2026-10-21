/* recipe.js — рецепты: проверка формата (v1), текущий шаг плана брожения, сахар для розлива.
   Обычный скрипт: в приложении — глобальный Recipe, в воркере и в scripts/check-recipes.mjs —
   тот же объект через globalThis (один набор правил для файлов библиотеки и для D1). */
(() => {
  const STAGES = ["lag", "active", "slowing", "checking", "done", "ready"];
  const ID = /^[a-z0-9-]{1,40}$/;
  const LANGS = ["en", "ru", "uk", "es"];
  const HOP_USE = ["boil", "first_wort", "whirlpool", "dry", "mash"];

  // Текст на нужном языке: строка — как есть, объект — язык, затем en, затем ru.
  function loc(v, lang) {
    if (v == null) return "";
    if (typeof v === "string") return v;
    return v[lang] || v.en || v.ru || Object.values(v).find((x) => typeof x === "string") || "";
  }

  const isNum = (v, lo, hi) => typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi;
  const isText = (v, max = 120) => (typeof v === "string" && v.trim().length > 0 && v.length <= max) ||
    (v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).length > 0 &&
      Object.entries(v).every(([k, s]) => LANGS.includes(k) && typeof s === "string" && s.length <= max) && !!(v.en || v.ru));

  // Ошибки рецепта (пустой массив — всё хорошо). styleIds — известные стили (в воркере их нет — только шаблон).
  function check(r, styleIds) {
    const err = [];
    const need = (ok, msg) => { if (!ok) err.push(msg); return ok; };
    if (!need(r && typeof r === "object" && !Array.isArray(r), "not an object")) return err;
    need(r.v === 1, "v must be 1");
    need(typeof r.id === "string" && ID.test(r.id), "bad id");
    if (need(typeof r.style === "string" && ID.test(r.style), "bad style") && styleIds) need(styleIds.includes(r.style), `unknown style ${r.style}`);
    need(isText(r.name, 80), "bad name");
    need(isNum(r.batch_l, 1, 200), "batch_l 1–200 L");
    if (need(isNum(r.og, 0.5, 40), "og 0.5–40 °P") & need(isNum(r.fg, -3, 30), "fg -3–30 °P")) need(r.og > r.fg, "og must be above fg");
    for (const [k, lo, hi] of [["abv", 0, 20], ["ibu", 0, 150], ["ebc", 0, 200], ["efficiency", 0.3, 1], ["boil_min", 0, 240]]) {
      if (r[k] != null) need(isNum(r[k], lo, hi), `${k} ${lo}–${hi}`);
    }
    if (r.water != null) {
      if (need(typeof r.water === "object", "bad water")) {
        for (const k of ["mash_l", "sparge_l", "preboil_l"]) if (r.water[k] != null) need(isNum(r.water[k], 0, 400), `water.${k} 0–400 L`);
      }
    }
    const list = (k, fn) => {
      if (r[k] == null) return;
      if (!need(Array.isArray(r[k]) && r[k].length <= 30, `${k} must be a list`)) return;
      r[k].forEach((x, i) => { if (need(x && typeof x === "object", `${k}[${i}] bad`)) fn(x, `${k}[${i}]`); });
    };
    list("fermentables", (x, p) => { need(isText(x.name), `${p}.name`); need(isNum(x.kg, 0.001, 100), `${p}.kg 0–100`); });
    list("hops", (x, p) => {
      need(isText(x.name), `${p}.name`); need(isNum(x.g, 0.1, 2000), `${p}.g 0–2000`);
      if (x.alpha != null) need(isNum(x.alpha, 0, 25), `${p}.alpha 0–25 %`);
      need(HOP_USE.includes(x.use), `${p}.use`);
      if (x.min != null) need(isNum(x.min, 0, 240), `${p}.min 0–240`);
      if (x.days != null) need(isNum(x.days, 0, 30), `${p}.days 0–30`);
    });
    list("other", (x, p) => { need(isText(x.name), `${p}.name`); if (x.g != null) need(isNum(x.g, 0, 5000), `${p}.g 0–5000`); });
    list("mash", (x, p) => { need(isNum(x.temp, 20, 100), `${p}.temp 20–100 °C`); need(isNum(x.min, 0, 300), `${p}.min 0–300`); });
    if (r.yeast != null) need(r.yeast && isText(r.yeast.name), "yeast.name");
    if (need(Array.isArray(r.fermentation) && r.fermentation.length >= 1 && r.fermentation.length <= 10, "fermentation: 1–10 steps")) {
      r.fermentation.forEach((x, i) => {
        const p = `fermentation[${i}]`;
        if (!need(x && typeof x === "object", `${p} bad`)) return;
        need(Array.isArray(x.temp) && x.temp.length === 2 && isNum(x.temp[0], -5, 40) && isNum(x.temp[1], -5, 40) && x.temp[0] <= x.temp[1], `${p}.temp [lo, hi] °C`);
        const u = x.until, keys = u && typeof u === "object" ? Object.keys(u) : [];
        need(keys.length === 1 && ((keys[0] === "stage" && STAGES.includes(u.stage)) || (keys[0] === "plato" && isNum(u.plato, -3, 40)) ||
          (keys[0] === "days" && isNum(u.days, 0, 365))), `${p}.until: {stage} | {plato} | {days}`);
        if (x.note != null) need(isText(x.note, 300), `${p}.note`);
      });
    }
    if (r.priming != null) {
      need(r.priming && isNum(r.priming.vol_co2, 0.5, 5), "priming.vol_co2 0.5–5");
      if (r.priming && r.priming.sugar != null) need(["sucrose", "dextrose"].includes(r.priming.sugar), "priming.sugar");
    }
    if (r.notes != null) need(isText(r.notes, 2000), "notes");
    // Засыпь правдоподобна для такой плотности: при 75 % эффективности 1 кг солода даёт ≈ 0,6 кг экстракта.
    if (!err.length && r.fermentables && r.fermentables.length) {
      const kg = r.fermentables.reduce((s, x) => s + x.kg, 0);
      const extract = r.og / 100 * r.batch_l * (1 + r.og / 250);
      need(kg >= extract * 0.8 && kg <= extract * 3, `fermentables ${kg.toFixed(2)} kg don't fit og ${r.og} °P for ${r.batch_l} L`);
    }
    return err;
  }

  const summary = (r) => ({ id: r.id, style: r.style, name: r.name, og: r.og, fg: r.fg, abv: r.abv ?? null, ibu: r.ibu ?? null, ebc: r.ebc ?? null });

  // Норма температуры для оповещений — от минимума до максимума всех шагов брожения.
  function range(r) {
    const steps = (r && r.fermentation) || [];
    if (!steps.length) return null;
    return [Math.min(...steps.map((x) => x.temp[0])), Math.max(...steps.map((x) => x.temp[1]))];
  }

  // Текущий шаг — первый, условие которого ещё не выполнено (после последнего — последний).
  // at: {stage, gravity, days} — стадия из анализа, текущая плотность °P, дни от старта партии.
  function stepIndex(r, at) {
    const steps = (r && r.fermentation) || [];
    const reached = (u) => {
      if (u.stage) return at.stage != null && STAGES.indexOf(at.stage) >= STAGES.indexOf(u.stage);
      if (u.plato != null) return at.gravity != null && at.gravity <= u.plato;
      if (u.days != null) return at.days != null && at.days >= u.days;
      return false;
    };
    const i = steps.findIndex((x) => !reached(x.until));
    return i < 0 ? steps.length - 1 : i;
  }

  // Сахар для розлива. Остаточный CO₂ при температуре пива T (°C), затем граммы сахарозы на литр;
  // декстрозы нужно на 10 % больше.
  function residualCO2(tc) {
    const f = tc * 9 / 5 + 32;
    return 3.0378 - 0.050062 * f + 0.00026555 * f * f;
  }
  function priming({ vol, tc, liters, sugar }) {
    const perL = Math.max(0, (vol - residualCO2(tc)) * 3.82) * (sugar === "dextrose" ? 1.1 : 1);
    return { residual: residualCO2(tc), perL, total: perL * liters, bottle: (l) => perL * l, thick: vol > 3.3 };
  }

  globalThis.Recipe = { STAGES, loc, check, summary, range, stepIndex, priming, residualCO2 };
})();
