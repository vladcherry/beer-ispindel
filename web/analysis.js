/* analysis.js — стили пива и разбор партии: температура, скорость брожения, прогноз,
   алкоголь. Только вычисления: тексты собирает страница по ключам из i18n.js.
   Плотность везде в °P, температура в °C. */
const Brew = (() => {

  // Диапазоны по BJCP (плотность переведена в °P), температура брожения — типичная для дрожжей стиля.
  // yeast: ale | lager | wheat | belgian | hybrid | sour | cider
  const S = (id, yeast, t, og, fg, abv, en, ru, uk, es) => ({ id, yeast, t, og, fg, abv, name: { en, ru, uk, es: es || en } });
  const STYLES = [
    S('american-pale-ale', 'ale', [18, 20], [11.0, 15.0], [2.5, 3.8], [4.5, 6.2], 'American Pale Ale', 'Американский пейл-эль', 'Американський пейл-ель'),
    S('american-ipa', 'ale', [18, 20], [13.8, 17.1], [2.0, 3.5], [5.5, 7.5], 'American IPA', 'Американский IPA', 'Американський IPA'),
    S('double-ipa', 'ale', [18, 20], [16.0, 20.5], [2.0, 3.5], [7.5, 10.0], 'Double IPA', 'Двойной IPA', 'Подвійний IPA', 'Doble IPA'),
    S('hazy-ipa', 'ale', [18, 21], [14.7, 20.5], [2.5, 5.1], [6.0, 9.0], 'Hazy IPA (NEIPA)', 'Мутный IPA (NEIPA)', 'Мутний IPA (NEIPA)'),
    S('english-ipa', 'ale', [17, 20], [12.4, 18.1], [2.6, 4.6], [5.0, 7.5], 'English IPA', 'Английский IPA', 'Англійський IPA', 'IPA inglesa'),
    S('best-bitter', 'ale', [17, 20], [10.0, 11.9], [2.0, 3.1], [3.8, 4.6], 'Best Bitter', 'Английский биттер', 'Англійський біттер'),
    S('irish-red', 'ale', [17, 20], [9.0, 11.5], [2.6, 3.6], [3.8, 5.0], 'Irish Red Ale', 'Ирландский красный эль', 'Ірландський червоний ель', 'Irish Red Ale'),
    S('irish-stout', 'ale', [17, 20], [9.0, 12.4], [1.8, 3.1], [4.0, 4.8], 'Irish Stout', 'Ирландский стаут', 'Ірландський стаут', 'Stout irlandesa'),
    S('oatmeal-stout', 'ale', [17, 20], [11.4, 15.4], [2.5, 4.6], [4.2, 5.9], 'Oatmeal Stout', 'Овсяный стаут', 'Вівсяний стаут', 'Stout de avena'),
    S('imperial-stout', 'ale', [17, 21], [18.1, 27.0], [4.6, 7.6], [8.0, 12.0], 'Imperial Stout', 'Имперский стаут', 'Імперський стаут', 'Stout imperial'),
    S('porter', 'ale', [17, 20], [11.0, 15.0], [2.5, 4.0], [4.5, 6.5], 'Porter', 'Портер', 'Портер'),
    S('baltic-porter', 'lager', [9, 14], [14.7, 22.5], [4.0, 6.3], [6.5, 9.5], 'Baltic Porter', 'Балтийский портер', 'Балтійський портер', 'Porter báltico'),
    S('brown-ale', 'ale', [17, 20], [10.9, 13.8], [2.5, 3.6], [4.3, 6.2], 'Brown Ale', 'Коричневый эль', 'Коричневий ель'),
    S('scottish-ale', 'ale', [15, 19], [9.5, 13.0], [2.5, 3.8], [3.5, 5.0], 'Scottish Ale', 'Шотландский эль', 'Шотландський ель', 'Scottish Ale'),
    S('barleywine', 'ale', [17, 21], [19.3, 28.0], [4.6, 7.6], [8.0, 12.0], 'Barleywine', 'Ячменное вино', 'Ячмінне вино', 'Barleywine'),
    S('hefeweizen', 'wheat', [18, 22], [11.4, 13.0], [2.5, 3.6], [4.3, 5.6], 'Hefeweizen', 'Пшеничное (хефевайцен)', 'Пшеничне (хефевайцен)'),
    S('dunkelweizen', 'wheat', [18, 22], [11.4, 13.8], [2.5, 4.0], [4.3, 5.6], 'Dunkelweizen', 'Тёмное пшеничное', 'Темне пшеничне'),
    S('witbier', 'wheat', [18, 23], [10.5, 13.0], [2.0, 3.1], [4.5, 5.5], 'Witbier', 'Бельгийское белое (витбир)', 'Бельгійське біле (вітбір)'),
    S('saison', 'belgian', [20, 30], [11.9, 15.9], [0.5, 2.6], [5.0, 7.0], 'Saison', 'Сезон', 'Сезон'),
    S('belgian-blonde', 'belgian', [18, 24], [14.7, 18.1], [2.0, 4.0], [6.0, 7.5], 'Belgian Blonde', 'Бельгийский блонд', 'Бельгійський блонд', 'Belgian Blonde'),
    S('belgian-dubbel', 'belgian', [18, 24], [14.7, 19.3], [2.5, 4.6], [6.0, 7.6], 'Belgian Dubbel', 'Бельгийский дуббель', 'Бельгійський дуббель', 'Dubbel'),
    S('belgian-tripel', 'belgian', [18, 26], [18.1, 20.4], [2.0, 3.6], [7.5, 9.5], 'Belgian Tripel', 'Бельгийский трипель', 'Бельгійський трипель', 'Tripel'),
    S('belgian-quad', 'belgian', [18, 25], [18.1, 26.0], [2.5, 6.3], [8.0, 12.0], 'Belgian Quad', 'Бельгийский квадрюпель', 'Бельгійський квадрюпель', 'Quadrupel'),
    S('kolsch', 'hybrid', [13, 18], [10.5, 12.4], [1.8, 2.6], [4.4, 5.2], 'Kölsch', 'Кёльш', 'Кельш'),
    S('altbier', 'hybrid', [13, 18], [11.0, 13.0], [2.6, 3.6], [4.3, 5.5], 'Altbier', 'Альтбир', 'Альтбір'),
    S('cream-ale', 'hybrid', [15, 18], [10.0, 13.0], [1.8, 2.6], [4.2, 5.6], 'Cream Ale', 'Крем-эль', 'Крем-ель'),
    S('german-pils', 'lager', [8, 13], [11.0, 12.4], [1.8, 3.1], [4.4, 5.2], 'German Pils', 'Немецкий пилс', 'Німецький пілс', 'Pils alemana'),
    S('czech-pilsner', 'lager', [8, 12], [11.4, 14.4], [3.1, 4.1], [4.2, 5.8], 'Czech Pilsner', 'Чешский пилзнер', 'Чеський пілзнер', 'Pilsner checa'),
    S('helles', 'lager', [8, 12], [10.9, 12.4], [1.6, 2.6], [4.7, 5.4], 'Munich Helles', 'Мюнхенский хеллес', 'Мюнхенський хеллес', 'Helles'),
    S('marzen', 'lager', [8, 13], [13.0, 14.7], [2.6, 3.6], [5.6, 6.3], 'Märzen / Oktoberfest', 'Мерцен / Октоберфест', 'Мерцен / Октоберфест'),
    S('vienna-lager', 'lager', [8, 13], [11.9, 13.8], [2.6, 3.6], [4.7, 5.5], 'Vienna Lager', 'Венский лагер', 'Віденський лагер', 'Lager vienesa'),
    S('schwarzbier', 'lager', [8, 13], [11.4, 13.0], [2.0, 4.0], [4.4, 5.4], 'Schwarzbier', 'Шварцбир', 'Шварцбір'),
    S('bock', 'lager', [8, 12], [15.7, 17.1], [3.6, 4.6], [6.3, 7.2], 'Bock', 'Бок', 'Бок'),
    S('doppelbock', 'lager', [8, 12], [17.6, 25.0], [4.0, 6.3], [7.0, 10.0], 'Doppelbock', 'Доппельбок', 'Доппельбок'),
    S('american-lager', 'lager', [8, 13], [9.0, 12.4], [1.0, 2.6], [4.2, 5.3], 'American Lager', 'Американский лагер', 'Американський лагер', 'Lager americana'),
    S('berliner-weisse', 'sour', [18, 22], [7.0, 8.0], [0.8, 1.8], [2.8, 3.8], 'Berliner Weisse', 'Берлинер вайссе', 'Берлінер вайссе'),
    S('cider', 'cider', [14, 20], [11.5, 15.0], [-1.0, 1.0], [5.0, 8.0], 'Cider', 'Сидр', 'Сидр', 'Sidra'),
  ];
  const byId = Object.fromEntries(STYLES.map((s) => [s.id, s]));

  const sgFromPlato = (p) => 1 + p / (258.6 - (p / 258.2) * 227.1);
  const abv = (og, fg) => Math.max(0, (sgFromPlato(og) - sgFromPlato(fg)) * 131.25);
  const mid = (r) => (r[0] + r[1]) / 2;
  const round1 = (x) => Math.round(x * 10) / 10;
  const H = 3600e3, DAY = 86400e3;
  const SETTLE = 6 * H; // первые часы партии сусло выходит на температуру брожения

  function median(a) {
    const v = a.filter((x) => x != null && Number.isFinite(x)).sort((x, y) => x - y);
    if (!v.length) return null;
    const m = v.length >> 1;
    return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
  }

  // Почасовые медианы: шум и редкие выбросы почти не влияют на скорость и скачки.
  function hourly(rows, key) {
    const buckets = new Map();
    for (const r of rows) {
      const v = r[key];
      if (v == null || !Number.isFinite(v)) continue;
      const h = Math.floor(r.ts / H) * H;
      if (!buckets.has(h)) buckets.set(h, []);
      buckets.get(h).push(v);
    }
    return [...buckets.entries()].sort((a, b) => a[0] - b[0]).map(([t, v]) => ({ t, v: median(v) }));
  }

  // Плотность в ферментере расти не может: подъёмы — пена или пузырьки CO₂ на колбе. Для стадий, скорости
  // и прогноза выкидываем часовые точки выше минимума предыдущих 6 часов больше чем на 0,5 °P.
  // Если отбрасывать пришлось бы 6 часов подряд, это уже не всплеск — точки снова принимаются.
  function despike(series) {
    const out = [];
    for (const p of series) {
      let min = Infinity;
      for (let i = out.length - 1; i >= 0 && out[i].t >= p.t - 6 * H; i--) min = Math.min(min, out[i].v);
      if (min !== Infinity && p.v > min + 0.5) continue;
      out.push(p);
    }
    return out;
  }

  // Значение около момента t (медиана в окне ±1,5 ч), или null.
  function at(series, t, win = 1.5 * H) {
    return median(series.filter((p) => Math.abs(p.t - t) <= win).map((p) => p.v));
  }

  /* Стадии брожения по часовой (уже без всплесков) плотности с начала партии.
     Каждую часовую точку классифицируем по данным до неё; новая стадия засчитывается, если держится
     3 точки подряд, и только вперёд по шкале. «Застряло» и «не стартовало» — не стадии, а тревоги поверх шкалы.
     Возвращает { stages: [{id, from, progress}], stage, alarm: {id, from} | null, checkingLeft }. */
  const STAGE_ORDER = ['lag', 'active', 'slowing', 'checking', 'done', 'ready'];
  const STAGE_HOLD = 3, CONFIRM_H = 48;
  function stagesOf(series, { batchStart, og, fg, now }) {
    if (!series.length) return {};
    const prog = (v) => Math.min(1, Math.max(0, (og - v) / (og - fg)));
    // Скорость в точке: падение за сутки, а в первые сутки — за сколько есть (не меньше 6 ч), пересчитанное на сутки.
    const rateAt = (i) => {
      const p = series[i], w = Math.min(DAY, p.t - batchStart);
      if (w < 6 * H) return null;
      const before = at(series, p.t - w);
      return before == null ? null : (before - p.v) * DAY / w;
    };
    // Сколько часов плотность стоит: идём назад, пока размах (по медиане из 3 точек) меньше 0,2 °P.
    const smooth = series.map((p, i) => median(series.slice(Math.max(0, i - 1), i + 2).map((q) => q.v)));
    const stableHours = (i) => {
      let lo = smooth[i], hi = smooth[i], j = i;
      while (j > 0) {
        const v = smooth[j - 1];
        if (Math.max(hi, v) - Math.min(lo, v) >= 0.2) break;
        lo = Math.min(lo, v); hi = Math.max(hi, v); j--;
      }
      return (series[i].t - series[j].t) / H;
    };

    const stages = [{ id: null, from: batchStart, progress: 0 }];
    let alarm = null, cand = null, lowSince = null, peak = 0, recover = 0, lastLeft = null;
    const rank = (id) => STAGE_ORDER.indexOf(id);
    for (let i = 0; i < series.length; i++) {
      const p = series[i], g = p.v, rate = rateAt(i), pr = prog(g), age = (p.t - batchStart) / DAY;
      if (rate != null) peak = Math.max(peak, rate);
      const moving = rate != null && rate >= 0.3;
      lowSince = moving ? null : (lowSince ?? p.t);
      let want = null; lastLeft = null;
      if (age < 1.5 && (og - g < 0.5 || pr < 0.05) && !moving) want = 'lag';
      else if (moving) want = pr >= 0.7 || rate < peak * 0.4 ? 'slowing' : 'active';
      else if (rate != null || age >= 1.5) {
        if (g <= fg + 1.0 || pr >= 0.85) {
          const st = stableHours(i);
          want = st >= CONFIRM_H ? 'done' : 'checking';
          lastLeft = Math.max(1, Math.ceil(CONFIRM_H - st));
        }
      }
      // Тревоги: не стартовало — сразу; застряло — если скорость < 0,3 держится сутки, а до цели далеко.
      if (age >= 3 && og - g < 0.5) alarm = alarm && alarm.id === 'noStart' ? alarm : { id: 'noStart', from: p.t };
      else if (!moving && !(g <= fg + 1.0 || pr >= 0.85) && rate != null && lowSince != null && p.t - lowSince >= DAY && !(age < 1.5 && og - g < 0.5)) {
        if (!alarm) alarm = { id: 'stalled', from: p.t };
      } else if (alarm && alarm.id === 'noStart' && og - g >= 0.5) alarm = null;
      if (alarm && alarm.id === 'stalled') {
        recover = moving ? recover + 1 : 0;
        if (recover >= STAGE_HOLD) { alarm = null; recover = 0; }
      }

      const curStage = stages.at(-1);
      if (curStage.id === null) { curStage.id = want || 'lag'; continue; }
      if (curStage.id === 'done' && p.t - curStage.from >= CONFIRM_H * H) {
        stages.push({ id: 'ready', from: curStage.from + CONFIRM_H * H, progress: curStage.progress });
        continue;
      }
      if (!want || rank(want) <= rank(curStage.id)) { cand = null; continue; }
      if (!cand || cand.id !== want) cand = { id: want, from: p.t, progress: pr, n: 1 };
      else cand.n++;
      if (cand.n >= STAGE_HOLD) { stages.push({ id: cand.id, from: cand.from, progress: cand.progress }); cand = null; }
    }
    const stage = stages.at(-1).id;
    return { stages, stage, alarm, checkingLeft: stage === 'checking' ? lastLeft : null };
  }

  /* Прогноз начала предстоящих стадий: {id: {lo, hi}} — время (ms), диапазон как у «осталось».
     Плотность идёт к цели экспоненциально: g(t) = fg + (g − fg)·e^(−k·t), k = скорость / (g − fg).
     Затухание — 70 % пути; проверка — у цели и скорость < 0,3 °P/сутки; дальше по 48 ч. */
  function stageForecast(res, { g, og, fg, rate, now, batchStart }) {
    const out = {}, stage = res.stage;
    if (!stage) return out;
    const shift = (r, ms) => ({ lo: r.lo + ms, hi: r.hi + ms });
    if (stage === 'lag') {
      out.active = { lo: Math.max(now, batchStart + 12 * H), hi: Math.max(now, batchStart + 36 * H) };
      return out;
    }
    if ((stage === 'active' || stage === 'slowing') && rate > 0.05 && g > fg) {
      const k = rate / (g - fg);
      const reach = (d) => {
        const days = Math.log((g - fg) / d) / k;
        return Number.isFinite(days) && days > 0 ? { lo: now + days * 0.8 * DAY, hi: now + days * 1.4 * DAY } : { lo: now, hi: now };
      };
      if (stage === 'active') out.slowing = reach(Math.max(0.3 * (og - fg), 0.01));
      out.checking = reach(Math.min(Math.max(1.0, 0.15 * (og - fg)), 0.3 / k));
      out.done = shift(out.checking, CONFIRM_H * H);
    } else if (stage === 'checking') {
      const left = (res.checkingLeft ?? CONFIRM_H) * H;
      out.done = { lo: now + left, hi: now + left };
    }
    if (out.done) out.ready = shift(out.done, CONFIRM_H * H);
    if (stage === 'done') { const d = res.stages.at(-1).from + CONFIRM_H * H; out.ready = { lo: d, hi: d }; }
    return out;
  }

  /* Разбор партии.
     rows: [{ts, g, temperature}] — g уже в °P и только правдоподобные; temperature в °C.
     batchStart: ms или null; og: начальная плотность или null; fgManual: °P или null; style: объект или null. */
  function analyze({ rows, now, batchStart, og, fgManual, style }) {
    const res = { temp: { level: 'ok', msgs: [] }, gravity: { level: 'ok', msgs: [] }, abv: { level: 'ok', msgs: [] } };
    const bump = (part, level) => {
      const order = { ok: 0, warn: 1, bad: 2 };
      if (order[level] > order[res[part].level]) res[part].level = level;
    };
    const say = (part, level, key, params = {}) => { res[part].msgs.push({ level, key, params }); bump(part, level); };

    const inBatch = batchStart ? rows.filter((r) => r.ts >= batchStart) : rows;
    const gH = despike(hourly(inBatch.length ? inBatch : rows, 'g'));
    const tH = hourly(inBatch.length ? inBatch : rows, 'temperature');
    const g = at(gH, now, 3 * H) ?? (gH.length ? gH.at(-1).v : null);
    const ageDays = batchStart ? (now - batchStart) / DAY : null;

    // --- Скорость брожения: падение плотности за последние сутки и пик за партию
    const g24 = at(gH, now - DAY);
    const rate = g != null && g24 != null ? g24 - g : null;            // °P в сутки, >0 — падает
    let peak = null;
    for (const p of gH) {
      const before = at(gH, p.t - DAY);
      if (before == null) continue;
      const r = before - p.v;
      if (!peak || r > peak.rate) peak = { rate: r, ts: p.t };
    }
    res.rate = rate; res.peak = peak && peak.rate > 0.3 ? peak : null; res.g = g;

    // --- Цель по плотности: вручную → по стилю → 75% сбраживания
    let fg = null, fgSource = null;
    if (fgManual != null) { fg = fgManual; fgSource = 'manual'; }
    else if (style) { fg = mid(style.fg); fgSource = 'style'; }
    else if (og != null) { fg = og * 0.25; fgSource = 'default'; }
    res.fg = fg; res.fgSource = fgSource;
    if (og != null && fg != null && g != null && og - fg > 0.5) {
      res.progress = Math.min(1, Math.max(0, (og - g) / (og - fg)));
    }
    if (og != null && g != null) res.attenuation = og > 0 ? Math.max(0, (og - g) / og * 100) : null;
    if (og != null && fg != null) res.projAbv = abv(og, fg);
    if (og != null && g != null) res.abvNow = abv(og, g);

    // --- Стадии партии (по часовой истории с начала партии)
    if (batchStart && og != null && fg != null && og - fg > 0.5 && gH.length) {
      Object.assign(res, stagesOf(gH.filter((p) => p.t >= batchStart), { batchStart, og, fg, now }));
    }

    // --- Статус брожения
    const drop = og != null && g != null ? og - g : null;
    let status = 'unknown';
    if (g == null) status = 'unknown';
    else if (batchStart && ageDays < 1.5 && (drop == null || drop < 0.5) && !(rate >= 0.3)) status = 'lag';
    else if (batchStart && ageDays >= 3 && drop != null && drop < 0.5) status = 'noStart';
    else if (rate != null && rate >= 0.3) status = res.peak && rate < res.peak.rate * 0.4 ? 'slowing' : 'active';
    else if (rate != null && !batchStart) status = 'quiet';
    else if (rate != null) status = fg != null && g > fg + 1.0 ? 'stalled' : 'done';
    // Со стадиями статус берётся из них: тревога поверх шкалы важнее, «можно разливать» — то же, что «закончилось».
    if (res.stage && g != null) status = res.alarm ? res.alarm.id : res.stage === 'ready' ? 'done' : res.stage;
    res.status = status;

    // --- Сколько осталось: экспоненциальное затухание к цели
    if ((status === 'active' || status === 'slowing') && fg != null && g > fg + 0.3) {
      const k = rate / (g - fg);
      const days = Math.log((g - fg) / 0.3) / k;
      if (Number.isFinite(days) && days > 0) {
        res.eta = { lo: Math.min(60, days * 0.8), hi: Math.min(90, days * 1.4) };
        res.ready = { lo: now + res.eta.lo * DAY, hi: now + res.eta.hi * DAY };
      }
    } else if (status === 'done') {
      res.eta = { lo: 0, hi: 0 };
    } else if (status === 'checking' && res.checkingLeft != null) {
      res.eta = { lo: res.checkingLeft / 24, hi: res.checkingLeft / 24 };
    }
    if (res.stage && g != null) res.stageEta = stageForecast(res, { g, og, fg, rate, now, batchStart });

    // --- Плотность
    if (status === 'lag') say('gravity', 'ok', 'an.grav.lag', { hours: Math.round(ageDays * 24) });
    if (status === 'noStart') say('gravity', 'bad', 'an.grav.noStart', { days: round1(ageDays) });
    if (status === 'active') say('gravity', 'ok', 'an.grav.active', { rate: round1(rate) });
    if (status === 'slowing') say('gravity', 'ok', 'an.grav.slowing', { rate: round1(rate), peak: round1(res.peak.rate) });
    if (status === 'stalled') say('gravity', batchStart && ageDays > 3 ? 'bad' : 'warn', 'an.grav.stalled', { g: round1(g), fg: round1(fg) });
    if (status === 'done') say('gravity', 'ok', 'an.grav.done', { g: round1(g) });
    if (status === 'checking') say('gravity', 'ok', 'an.grav.checking', { g: round1(g), h: res.checkingLeft ?? 48 });
    if (status === 'quiet') say('gravity', 'ok', 'an.grav.quiet', {});
    if (!batchStart) say('gravity', 'ok', 'an.grav.noBatch', {});
    if (fg != null && g != null && g < fg - 1.5 && (status === 'done' || status === 'checking' || status === 'stalled' || status === 'slowing')) {
      say('gravity', 'warn', 'an.grav.belowFg', { g: round1(g), fg: round1(fg) });
    }
    if (style && og != null && (og < style.og[0] - 0.5 || og > style.og[1] + 0.5)) {
      say('gravity', 'warn', 'an.grav.ogStyle', { og: round1(og), lo: style.og[0], hi: style.og[1] });
    }

    // --- Алкоголь
    if (res.projAbv != null && style) {
      const [lo, hi] = style.abv;
      if (res.projAbv < lo - 0.3) say('abv', 'warn', 'an.abv.low', { proj: round1(res.projAbv), lo, hi });
      else if (res.projAbv > hi + 0.3) say('abv', 'warn', 'an.abv.high', { proj: round1(res.projAbv), lo, hi });
      else say('abv', 'ok', 'an.abv.ok', { proj: round1(res.projAbv), lo, hi });
    } else if (res.projAbv != null) {
      say('abv', 'ok', 'an.abv.proj', { proj: round1(res.projAbv) });
    }
    if (status === 'stalled' && res.projAbv != null && res.abvNow != null) {
      say('abv', 'warn', 'an.abv.stalled', { now: round1(res.abvNow), proj: round1(res.projAbv) });
    }

    // --- Температура
    const tLast = at(tH, now, 3 * H) ?? (tH.length ? tH.at(-1).v : null);
    // Колебание — за сутки, но без первых часов партии: сусло ещё охлаждается или греется до температуры брожения.
    const swingFrom = Math.max(now - DAY, batchStart ? batchStart + SETTLE : 0);
    const t24 = tH.filter((p) => p.t >= swingFrom).map((p) => p.v);
    const tAll = tH.map((p) => p.v);
    let spikes = 0, maxJump = 0;
    for (let i = 1; i < tH.length; i++) {
      if (tH[i].t - tH[i - 1].t > 2 * H) continue;
      const j = Math.abs(tH[i].v - tH[i - 1].v);
      if (j >= 1.5) spikes++;
      maxJump = Math.max(maxJump, j);
    }
    const swing = t24.length ? Math.max(...t24) - Math.min(...t24) : null;
    const tPrev = at(tH, now - DAY);
    res.temp.stats = {
      last: tLast, mean: tAll.length ? tAll.reduce((a, b) => a + b, 0) / tAll.length : null,
      min: tAll.length ? Math.min(...tAll) : null, max: tAll.length ? Math.max(...tAll) : null,
      swing, spikes, maxJump, trend: tLast != null && tPrev != null ? tLast - tPrev : null,
    };
    if (tLast != null) {
      if (style) {
        const [lo, hi] = style.t;
        if (tLast > hi + 0.5) say('temp', tLast > hi + 2 ? 'bad' : 'warn', 'an.temp.high', { t: round1(tLast), lo, hi, target: hi - 1 });
        else if (tLast < lo - 0.5) say('temp', tLast < lo - 2 ? 'bad' : 'warn', 'an.temp.low', { t: round1(tLast), lo, hi, target: lo + 1 });
      }
      if (swing != null && swing > 3) say('temp', 'warn', 'an.temp.swing', { swing: round1(swing) });
      if (spikes > 0) say('temp', spikes > 2 ? 'warn' : 'ok', 'an.temp.spikes', { n: spikes, jump: round1(maxJump) });
      // Скорость брожения и температура
      const range = style ? style.t : null;
      const inLowerHalf = range ? tLast < mid(range) : false;
      const inUpperHalf = range ? tLast >= mid(range) : false;
      if (status === 'stalled' || (status === 'slowing' && fg != null && g > fg + 2)) {
        const target = range ? Math.min(range[1], Math.round(tLast) + 2) : Math.round(tLast) + 2;
        if (!range || tLast < range[1]) say('temp', 'warn', 'an.temp.raiseForSpeed', { rate: round1(rate ?? 0), target });
      } else if (status === 'active' && rate > 3.5 && (inUpperHalf || !range)) {
        say('temp', 'warn', 'an.temp.lowerForSpeed', { rate: round1(rate), target: range ? Math.max(range[0], Math.round(tLast) - 1) : Math.round(tLast) - 1 });
      } else if (status === 'active' && rate < 0.8 && inLowerHalf && fg != null && g > fg + 2) {
        say('temp', 'ok', 'an.temp.canRaise', { target: Math.min(range[1], Math.round(tLast) + 1) });
      }
      // Под конец: лагеру — диацетиловая пауза (и когда уже почти выбродил), элю — поднять на 1–2 °C.
      if (res.progress != null && res.progress > 0.8 && style) {
        if (style.yeast === 'lager') say('temp', 'ok', 'an.temp.diacetylRest', {});
        else if (status !== 'done') say('temp', 'ok', 'an.temp.endRaise', {});
      }
      if (!style) say('temp', 'ok', 'an.temp.noStyle', {});
      if (!res.temp.msgs.some((m) => m.level !== 'ok') && style) {
        res.temp.msgs.unshift({ level: 'ok', key: 'an.temp.ok', params: { lo: style.t[0], hi: style.t[1] } });
      }
    }
    return res;
  }

  return { STYLES, byId, analyze, abv, sgFromPlato };
})();
