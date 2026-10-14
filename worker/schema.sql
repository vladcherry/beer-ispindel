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
