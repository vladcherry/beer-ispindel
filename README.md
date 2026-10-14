# iSpindel → своё приложение

iSpindel шлёт показания в Cloudflare Worker, тот складывает их в D1 (SQLite), а PWA на GitHub Pages рисует плотность, температуру и заряд. Приложение ставится на телефон и открывается без сети с последними данными. Всё в бесплатных тарифах.

```
iSpindel ──POST──▶ Worker /ingest ──▶ D1
PWA (GitHub Pages) ──GET /api/*──▶ Worker
```

```
web/      PWA: index.html, manifest, service worker, иконки, Chart.js
worker/   Cloudflare Worker + схема D1
.github/workflows/pages.yml   деплой web/ на GitHub Pages
.github/workflows/worker.yml  деплой воркера (если задан CLOUDFLARE_API_TOKEN)
```

## 1. Воркер (один раз, ~10 минут)

Нужен бесплатный аккаунт Cloudflare и Node.js.

```bash
cd worker
npm install
npx wrangler login                     # откроется браузер
npx wrangler d1 create ispindel        # выведет database_id
```

Вставь `database_id` в `wrangler.toml`. Там же поправь `ALLOWED_ORIGIN`, если Pages будут не под `vladcherry.github.io`.

```bash
npm run db:init                        # создаст таблицу
npx wrangler secret put INGEST_TOKEN   # придумай длинный токен, он же пойдёт в iSpindel
npm run deploy                         # выведет адрес, напр. https://ispindel.<имя>.workers.dev
```

Проверка: открой `https://ispindel.<имя>.workers.dev/api/health` — должно быть `{"ok":true,...}`.

Необязательно: `npx wrangler secret put READ_TOKEN` — тогда читать данные можно будет только с этим ключом (его вводишь в настройках страницы).

### Автодеплой воркера из GitHub (необязательно)

После первой ручной настройки (база создана, `database_id` закоммичен, секреты заданы через `wrangler secret put`) можно деплоить из Actions:

1. Cloudflare → My Profile → API Tokens → Create Token → шаблон **Edit Cloudflare Workers** (добавь права **D1: Edit**).
2. GitHub → Settings → Secrets and variables → Actions → `CLOUDFLARE_API_TOKEN`.

Теперь каждый пуш в `main`, меняющий `worker/`, применяет `schema.sql` и деплоит воркер. Без секрета job просто пропускается.

## 2. iSpindel

Режим конфигурации (дважды замкнуть RST) → Configuration:

| Поле | Значение |
|---|---|
| Service Type | **HTTPS Post** |
| Server URL | `https://ispindel.<имя>.workers.dev/ingest` |
| Token | значение `INGEST_TOKEN` |
| Interval | 60 для проверки, потом 900 |

Если с HTTPS Post данные не приходят, попробуй **HTTP**: Server Address `ispindel.<имя>.workers.dev`, Port `80`, Path `/ingest`, тот же Token.

Смотреть, доходят ли запросы: `npx wrangler tail` в папке `worker`.

## 3. Приложение (GitHub Pages)

1. Settings → Pages → Source: **GitHub Actions**.
2. В `web/config.js` впиши адрес воркера (или укажи его потом в настройках приложения).
3. Пуш в `main` → workflow **Pages** выкладывает папку `web/` на `https://vladcherry.github.io/beer-ispindel/`. Запустить вручную: Actions → Pages → Run workflow.

### Установка на телефон

- Android / Chrome: меню → «Установить приложение» (или баннер внизу).
- iPhone / Safari: «Поделиться» → «На экран „Домой“».

Без сети приложение открывается из кэша и показывает последние полученные данные с пометкой «Нет связи». Каждый деплой меняет версию service worker'а, поэтому обновление подтягивается само при следующем открытии.

Локально: `npx http-server web -p 8080` и `cd worker && npx wrangler dev` (в `worker/.dev.vars` задай `INGEST_TOKEN=...` и `ALLOWED_ORIGIN=*`, перед этим `npm run db:init:local`).

## Что умеет приложение

- Текущая плотность (медиана последних 5 показаний) в °P и SG, шкала-ареометр.
- «Начать партию» — запоминает старт, считает начальную плотность, степень сбраживания и алкоголь.
- Статус брожения по изменению плотности за сутки.
- Графики плотности (со сглаживанием) и температуры: 6 ч, 24 ч, 3 дня, 7 дней, вся партия.
- Батарея в процентах, наклон, уровень Wi-Fi, «датчик молчит дольше обычного».
- Своя формула плотности по наклону — пересчитывает всю историю, удобно после перекалибровки.
- Показания, где датчик явно не плавает (стоит или лежит), на графике плотности не показываются.

Настройки хранятся в браузере (localStorage), на каждом устройстве свои.
- Работает как приложение: иконка на главном экране, полноэкранный режим, офлайн-доступ к последним данным.

## Лимиты

Бесплатные Workers и D1 с большим запасом покрывают один датчик: при интервале 15 мин это ~100 запросов и ~100 строк в сутки.
