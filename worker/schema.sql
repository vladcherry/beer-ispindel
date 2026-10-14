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

-- Токены, заведённые в приложении. Сам токен не храним, только SHA-256.
CREATE TABLE IF NOT EXISTS tokens (
  hash      TEXT PRIMARY KEY,
  created   INTEGER NOT NULL,
  last_seen INTEGER
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
