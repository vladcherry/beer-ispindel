-- Показания iSpindel. Время хранится в миллисекундах UTC.
CREATE TABLE IF NOT EXISTS readings (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ts          INTEGER NOT NULL,
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
