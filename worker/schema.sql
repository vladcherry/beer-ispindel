-- Показания iSpindel. Время хранится в миллисекундах UTC.
CREATE TABLE IF NOT EXISTS readings (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ts          INTEGER NOT NULL,
  owner       TEXT,                  -- SHA-256 токена, с которым пришло показание
  device      TEXT    NOT NULL,      -- имя из портала iSpindel
  chip_id     TEXT,                  -- ID чипа
  angle       REAL,                  -- наклон, градусы
  temperature REAL,                  -- в единицах temp_units
  temp_units  TEXT,                  -- C / F / K
  battery     REAL,                  -- напряжение, В
  gravity     REAL,                  -- плотность по формуле в iSpindel
  interval_s  INTEGER,               -- интервал отправки, с
  rssi        INTEGER                -- уровень Wi-Fi, dBm
);

CREATE INDEX IF NOT EXISTS idx_readings_device_ts ON readings (device, ts);
-- Индекс по owner создаёт сам воркер: в старых базах колонки owner ещё нет, пока воркер её не добавит.

-- Стики: токены, заведённые в приложении. Сам токен не храним, только SHA-256.
CREATE TABLE IF NOT EXISTS tokens (
  hash      TEXT PRIMARY KEY,
  id        TEXT,                  -- публичный id стика
  batch_start INTEGER,             -- начало текущей партии (ms UTC), общее для всех с доступом
  formula   TEXT,                  -- полином плотности по наклону, общий для всех с доступом
  units     TEXT,                  -- P / SG — в чём приходит плотность; NULL = определять автоматически
  style     TEXT,                  -- стиль пива текущей партии (id из web/analysis.js)
  fg_target REAL,                  -- ожидаемая конечная плотность партии, °P
  t_lo      REAL,                  -- норма температуры (°C) для оповещений — из стиля
  t_hi      REAL,
  ai_engine TEXT,                  -- AI-помощник: модель DeepSeek, ключ (только на сервере), вопросов в сутки, длина ответа
  ai_key    TEXT,
  ai_limit  INTEGER,
  ai_len    TEXT,
  recipe    TEXT,                  -- рецепт текущей партии: lib:<id> (библиотека приложения) или my:<id> (recipes)
  stage_marks TEXT,                -- стадии партии, отмеченные вручную: JSON [{id, at}]
  created   INTEGER NOT NULL,
  last_seen INTEGER
);

-- Ключи доступа на чтение: выдаются при регистрации (owner) и по «Поделиться» (share).
CREATE TABLE IF NOT EXISTS access_keys (
  hash       TEXT PRIMARY KEY,     -- SHA-256 ключа
  token_hash TEXT NOT NULL,        -- стик
  kind       TEXT NOT NULL,
  created    INTEGER NOT NULL,
  last_used  INTEGER,             -- когда ключом пользовались последний раз (с точностью до 5 мин)
  user_agent TEXT                 -- браузер, с которого пользовались
);

-- Последние попытки отправки (для диагностики), хранится ~50 строк.
CREATE TABLE IF NOT EXISTS ingest_log (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  ts           INTEGER NOT NULL,
  path         TEXT,
  status       INTEGER,
  reason       TEXT,
  content_type TEXT,
  user_agent   TEXT,
  body         TEXT                 -- начало тела запроса, токен замазан
);

-- Последнее показание каждого iSpindel (обновляется при приёме) — дешёвый список устройств.
CREATE TABLE IF NOT EXISTS latest (
  owner TEXT NOT NULL, device TEXT NOT NULL, ts INTEGER NOT NULL, chip_id TEXT, angle REAL, temperature REAL,
  temp_units TEXT, battery REAL, gravity REAL, interval_s INTEGER, rssi INTEGER,
  PRIMARY KEY (owner, device)
);

-- Служебное: версия схемы, чтобы миграции в воркере выполнялись один раз.
CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT);

-- Push-подписки устройств: одно устройство (endpoint) может следить за несколькими стиками.
CREATE TABLE IF NOT EXISTS push_subs (
  endpoint TEXT NOT NULL, token_hash TEXT NOT NULL, key_hash TEXT, p256dh TEXT NOT NULL, auth TEXT NOT NULL,
  events TEXT, lang TEXT, created INTEGER, PRIMARY KEY (endpoint, token_hash)
);
-- Состояние оповещений стика (чтобы не повторять одно и то же) и журнал событий для приложения.
CREATE TABLE IF NOT EXISTS alert_state (
  token_hash TEXT NOT NULL, kind TEXT NOT NULL, active INTEGER, at INTEGER, ref INTEGER, PRIMARY KEY (token_hash, kind)
);
CREATE TABLE IF NOT EXISTS alert_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT, token_hash TEXT NOT NULL, ts INTEGER NOT NULL, event TEXT, key TEXT, params TEXT
);
CREATE INDEX IF NOT EXISTS idx_alert_log ON alert_log (token_hash, ts);

-- Чат с AI по партиям; по нему же считается лимит вопросов за сутки.
CREATE TABLE IF NOT EXISTS ai_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT, token_hash TEXT NOT NULL, batch_start INTEGER, ts INTEGER NOT NULL,
  key_hash TEXT, user_agent TEXT, question TEXT, answer TEXT, lang TEXT, tokens_in INTEGER, tokens_out INTEGER
);
CREATE INDEX IF NOT EXISTS idx_ai_log ON ai_log (token_hash, ts);

-- Свои рецепты стика: JSON в формате web/recipe.js, не больше 50 на стик.
CREATE TABLE IF NOT EXISTS recipes (
  owner TEXT NOT NULL,        -- tokens.hash стика
  id TEXT NOT NULL,           -- как в JSON, уникален в пределах стика
  json TEXT NOT NULL,         -- рецепт целиком, ≤ 32 KB
  created INTEGER NOT NULL,
  updated INTEGER NOT NULL,
  PRIMARY KEY (owner, id)
);
