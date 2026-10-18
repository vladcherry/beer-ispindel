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
  created   INTEGER NOT NULL,
  last_seen INTEGER
);

-- Ключи доступа на чтение: выдаются при регистрации (owner) и по «Поделиться» (share).
CREATE TABLE IF NOT EXISTS access_keys (
  hash       TEXT PRIMARY KEY,     -- SHA-256 ключа
  token_hash TEXT NOT NULL,        -- стик
  kind       TEXT NOT NULL,
  created    INTEGER NOT NULL
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
