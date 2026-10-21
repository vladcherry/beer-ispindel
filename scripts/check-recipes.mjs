// Проверка встроенной библиотеки рецептов: node scripts/check-recipes.mjs [--write]
//   каждый web/recipes/<id>.json — по правилам web/recipe.js (те же, что у воркера), стиль есть
//   в web/analysis.js, алкоголь сходится с НП/КП; web/recipes/index.json — краткий список всех файлов.
//   --write пересобирает index.json вместо проверки.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ctx = vm.createContext({});
for (const f of ["web/analysis.js", "web/recipe.js"]) vm.runInContext(readFileSync(join(root, f), "utf8"), ctx, { filename: f });
const { Brew, Recipe } = vm.runInContext("({ Brew, Recipe: globalThis.Recipe })", ctx);
const styleIds = Brew.STYLES.map((s) => s.id);

const dir = join(root, "web/recipes");
const files = readdirSync(dir).filter((f) => f.endsWith(".json") && f !== "index.json").sort();
const problems = [];
const index = [];
for (const f of files) {
  let r;
  try { r = JSON.parse(readFileSync(join(dir, f), "utf8")); } catch (e) { problems.push(`${f}: ${e.message}`); continue; }
  const err = Recipe.check(r, styleIds);
  if (r && r.id + ".json" !== f) err.push(`id "${r.id}" doesn't match the file name`);
  if (!err.length && r.abv != null && Math.abs(Brew.abv(r.og, r.fg) - r.abv) > 0.4) err.push(`abv ${r.abv} vs ${Brew.abv(r.og, r.fg).toFixed(1)} from og/fg`);
  if (!err.length) for (const k of ["fermentation"]) r[k].forEach((x, i) => { if (!x.note || !x.note.ru || !x.note.en) err.push(`${k}[${i}].note needs ru and en`); });
  if (!err.length && !["en", "ru", "uk", "es"].every((l) => r.name[l])) err.push("name needs en, ru, uk, es");
  problems.push(...err.map((e) => `${f}: ${e}`));
  if (r) index.push(Recipe.summary(r));
}

// Правила должны ловить плохие рецепты, а не только пропускать хорошие.
const good = JSON.parse(readFileSync(join(dir, files[0]), "utf8"));
for (const [what, patch] of [["unknown style", { style: "no-such-style" }], ["og ≤ fg", { og: 2, fg: 3 }], ["bad id", { id: "Bad Id!" }],
  ["bad until", { fermentation: [{ until: { hours: 3 }, temp: [18, 19] }] }]]) {
  if (!Recipe.check({ ...good, ...patch }, styleIds).length) problems.push(`self-test: "${what}" was not rejected`);
}

const text = JSON.stringify(index, null, 1) + "\n";
if (process.argv.includes("--write")) {
  writeFileSync(join(dir, "index.json"), text);
  console.log(`index.json: ${index.length} recipes`);
} else {
  let cur = null;
  try { cur = readFileSync(join(dir, "index.json"), "utf8"); } catch { /* нет файла */ }
  if (cur !== text) problems.push("index.json is out of date — run node scripts/check-recipes.mjs --write");
}
if (problems.length) { console.error(problems.join("\n")); process.exit(1); }
console.log(`${files.length} recipes OK`);
