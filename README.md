# iSpindel → your own app

iSpindel sends readings to a Cloudflare Worker, which stores them in D1 (SQLite). A PWA on GitHub Pages plots gravity, temperature and battery. The app installs on your phone and opens offline with the latest data. Everything fits in free tiers.

```
iSpindel ──POST──▶ Worker /ingest ──▶ D1
PWA (GitHub Pages) ──GET /api/*──▶ Worker
```

```
web/      PWA: index.html, manifest, service worker, icons, Chart.js
worker/   Cloudflare Worker + D1 schema
.github/workflows/pages.yml   deploys web/ to GitHub Pages
.github/workflows/worker.yml  deploys the worker (if CLOUDFLARE_API_TOKEN is set)
```

## 1. Worker (one-time, ~10 minutes)

You need a free Cloudflare account and Node.js.

```bash
cd worker
npm install
npx wrangler login                     # opens a browser
npx wrangler d1 create ispindel        # prints database_id
```

Put `database_id` into `wrangler.toml`. Also update `ALLOWED_ORIGIN` there if Pages is not served from `vladcherry.github.io`.

```bash
npm run db:init                        # creates the table
npm run deploy                         # prints the URL, e.g. https://ispindel.<name>.workers.dev
```

Check: open `https://ispindel.<name>.workers.dev/api/health` — it should return `{"ok":true,...}`.

Optional: `npx wrangler secret put INGEST_TOKEN` — an iSpindel that exists from the start; claim it once by adding this token in the app.

### Or: set up and deploy the worker from GitHub Actions (no local tools)

1. Cloudflare → My Profile → API Tokens → Create Token → **Edit Cloudflare Workers** template, add **Account → D1 → Edit**.
2. GitHub → Settings → Secrets and variables → Actions → New repository secret:
   - `CLOUDFLARE_API_TOKEN` — the token from step 1;
   - `INGEST_TOKEN` (optional) — an iSpindel that exists from the start; claim it once by adding this token in the app;
   - `CLOUDFLARE_ACCOUNT_ID` (only if the token can access several accounts).
3. Actions → **Worker** → Run workflow.

The workflow creates the `ispindel` D1 database if needed, applies `schema.sql`, deploys the worker, sets its secrets and prints the worker URL in the run summary. After that every push to `main` that changes `worker/` redeploys it. Without `CLOUDFLARE_API_TOKEN` the job is skipped.

If the account has never used Workers, open Workers & Pages in the Cloudflare dashboard once so it gets a `*.workers.dev` subdomain.

## iSpindels, tokens and sharing

- **Demo**: until an iSpindel is added, the main page shows a made-up wheat beer batch marked DEMO, with a note on how to connect: open a share link from an iSpindel's owner, or add an iSpindel by the token set in its own configuration.

- **Add an iSpindel** (Settings): think up a token or press Generate, then press Add. The worker registers the token and returns an access key, which the app keeps in localStorage. Enter the same token in the iSpindel's Token field.
- **A token can be registered only once.** Registering an existing token is refused ("already registered") — knowing someone's token gives no access to their data.
- **Reading uses the access key**, not the token. The worker stores only SHA-256 hashes of tokens and keys.
- **Share**: creates a new access key and a link `…/#join=<key>`. Opening the link adds the iSpindel to that browser (read-only: the token is not shared). The link or the code from it can also be pasted in Settings → Add iSpindel → “Have a share link?” — needed on iPhone, where an app on the Home Screen keeps its own storage and does not see links opened in a browser.
- **Several iSpindels**: each one is listed in Settings; switch between them in the header on the main page.
- **Settings layout**: the first screen lists your iSpindels (owner or guest), Add iSpindel, Server and Language (tap to cycle EN → UA → RU → ES). Tapping an iSpindel opens its page with three sections: Batch (start, style, expected FG, new batch), Measurement (units, formula) and Access (share link; for the owner also who is connected and clearing the history; removing it from this browser).
- **Batch start is shared** by everyone connected to an iSpindel and stored on the worker. Restarting or clearing a running batch asks for confirmation, because it resets original gravity, attenuation, alcohol and the batch history for all users. While a batch runs, the charts show it from its start.
- **Beer style and target final gravity** are chosen when a batch starts (≈ 37 styles with fermentation temperature, OG, FG and ABV ranges in `web/analysis.js`) and shared per iSpindel.
- **Fermentation stages**: the batch scale shows lag → active → slowing → confirming the end → finished → ready to package, detected from hourly gravity (upward spikes from foam are ignored; a stage counts after 3 hours in a row and only moves forward). Stalled and not started are alarms over the scale. Tap the scale for the list of stages with start and duration. Gravity and temperature tiles show a trend arrow (falling / rising / stable).
- **Analysis**: fermentation status and speed, peak, progress towards the final gravity, time left and ready date; temperature average, swing, sudden jumps and the style range; expected alcohol against the style. Problems turn the matching button red; tapping it explains the problem and what to do. A recommendations panel sums it up.
- **Notifications**: the worker checks every reading and, every 15 minutes, a schedule: temperature more than 0.5 °C outside the style range two readings in a row (and back to normal), the iSpindel gone quiet (and back online), battery at 20 % or below, and fermentation seemingly finished (tilt flat for two days). Events go to a log everyone connected to the iSpindel sees under the bell in the header; push notifications are optional per device (Settings → iSpindel → 🔔), with a choice of events and a test button. Web Push needs no third-party service; on iPhone it works in the app opened from the Home Screen (iOS 16.4+).
- **Rate limit**: the worker accepts at most one reading per minute from each iSpindel (429 otherwise, logged in `ingest_log`).
- **Gravity units** (Auto / °P / SG) are shared per iSpindel. SG from the iSpindel or from the formula is converted to °P before every calculation; Auto decides from the readings at the start of the batch (SG ≈ 1.03–1.12 vs 7–28 °P).
- **The gravity formula (polynomial from tilt) is shared** per iSpindel too, stored on the worker. Changing it asks for confirmation because it recalculates gravity, original gravity, attenuation and alcohol for everyone. A formula set locally in an older version is uploaded once if the iSpindel has none yet.
- **Admins**: admin rights belong to an access key, i.e. to a browser on a device, and are stored on the worker (`access_keys.kind = 'owner'`). Whoever registers the token becomes the first admin. An admin can make any connected device an admin or take the rights back; nobody can demote or disconnect themselves, so an iSpindel always keeps at least one admin.
- **Who is connected** (Settings → iSpindel → Access, admins only): every access key in use with its browser, OS and last activity; an admin can disconnect people (other admins too) or revoke an unopened share link.
- **Clear history** (Settings → iSpindel → Access, admins only): deletes all readings of the selected iSpindel except the latest one, for everyone connected to it. Other iSpindels are not touched.
- Tokens: 8–64 characters, no spaces, quotes or backslashes.
- Migration: an iSpindel registered before access keys existed (including the old shared `INGEST_TOKEN`) can be claimed once by adding its token.

Settings also contain a step-by-step **How to set up the iSpindel** guide with the server URL and token ready to copy.

## 2. iSpindel

The app shows these steps with your values filled in (Settings → How to set up the iSpindel).

Configuration mode (double-reset) → Configuration:

| Field | Value |
|---|---|
| Service Type | **HTTPS Post** |
| Server URL | `https://ispindel.<name>.workers.dev/ingest` |
| Token | your device token from the app settings |
| Interval | 60 for testing, then 900 |

If no data arrives with HTTPS Post, try **HTTP**: Server Address `ispindel.<name>.workers.dev`, Port `80`, Path `/ingest`, same Token.

To watch incoming requests: `npx wrangler tail` in the `worker` folder.

## 3. App (GitHub Pages)

1. Settings → Pages → Source: **GitHub Actions**.
2. Put the worker URL into `web/config.js` (or enter it later in the app settings).
3. A push to `main` runs the **Pages** workflow, which publishes `web/` to `https://vladcherry.github.io/beer-ispindel/`. To run it manually: Actions → Pages → Run workflow.

### Installing on a phone

- Android / Chrome: menu → "Install app" (or the banner at the bottom).
- iPhone / Safari: Share → "Add to Home Screen".

Offline, the app opens from cache and shows the latest received data marked "no connection". Each deploy bumps the service worker version, so updates are picked up automatically on the next launch.

Local run: `npx http-server web -p 8080` and `cd worker && npx wrangler dev` (set `ALLOWED_ORIGIN=*` in `worker/.dev.vars`, and run `npm run db:init:local` first).

## Features

- Two equal tiles on top: gravity (°P, SG, original gravity, attenuation bar, speed, alcohol) and temperature (with the style range scale and a short hint). Each tile is coloured by its own reading: green — fine, yellow — close to a limit or a warning, red — a problem. Battery, Wi-Fi and gravity speed chips below use the same colours.
- "Start batch" — remembers the start time, calculates original gravity, attenuation and ABV.
- Fermentation status based on the gravity change over 24 hours.
- Gravity (with smoothing) and temperature charts: 1 h, 6 h, 24 h, 3 days, 7 days, whole batch.
- Battery percentage, tilt, Wi-Fi strength, "sensor silent longer than usual" warning.
- Custom gravity formula from tilt — recalculates the whole history, handy after recalibration.
- Readings where the sensor is clearly not floating (standing or lying) are hidden from the gravity chart.
- Works as an app: home screen icon, full-screen mode, offline access to the latest data.

Settings are stored in the browser (localStorage), separately on each device. The app UI is in Russian.

## Limits

Free Workers and D1 easily cover one sensor: at a 15-minute interval that's ~100 requests and ~100 rows per day.

D1's free tier allows **5 million rows read per day** (reset at 00:00 UTC); above that every query fails and the app shows the worker's error. To stay far below it the worker keeps the latest reading per device in a `latest` table, the app loads full history once and then only new rows (`?after=`), long ranges are averaged down to at most 4000 points, and battery history is cached for 3 hours. Use an iSpindel interval of 900 s once testing is done.
