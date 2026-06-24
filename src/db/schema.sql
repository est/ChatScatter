CREATE TABLE IF NOT EXISTS ai_models (
  id            TEXT PRIMARY KEY,
  provider_name TEXT NOT NULL,
  base_url      TEXT NOT NULL,
  endpoint      TEXT NOT NULL DEFAULT '/v1/chat/completions',
  api_format    TEXT NOT NULL DEFAULT 'openai',
  api_key       TEXT,
  model_id      TEXT NOT NULL,
  display_name  TEXT,
  is_default    INTEGER NOT NULL DEFAULT 0,
  meta          TEXT NOT NULL DEFAULT '{}',
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_provider_model ON ai_models(base_url, model_id);

CREATE TABLE IF NOT EXISTS users (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  email            TEXT NOT NULL UNIQUE,
  display_name     TEXT,
  providers_config TEXT DEFAULT '[]',
  sessions         TEXT DEFAULT '{}',
  settings         TEXT DEFAULT '{}',
  meta             TEXT DEFAULT '{}',
  created_at       INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS passkeys (
  id              TEXT PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id),
  public_key      BLOB NOT NULL,
  counter         INTEGER NOT NULL DEFAULT 0,
  transports      TEXT DEFAULT '[]',
  device_name     TEXT,
  meta            TEXT DEFAULT '{}',
  created_at      INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_passkey_user ON passkeys(user_id);

CREATE TABLE IF NOT EXISTS chat_nodes (
  conv_id           TEXT NOT NULL,
  idx               BLOB NOT NULL,
  title             TEXT DEFAULT '',
  prefix_idx        BLOB NOT NULL DEFAULT X'',
  scatter_from      BLOB,
  gather_from       BLOB,
  user_id           INTEGER,
  user_content      TEXT NOT NULL DEFAULT '',
  user_meta         TEXT DEFAULT '{}',
  assistant_content TEXT NOT NULL DEFAULT '',
  assistant_meta    TEXT DEFAULT '{}',
  meta              TEXT DEFAULT '{}',
  created_at        INTEGER NOT NULL,
  PRIMARY KEY (conv_id, idx)
);

CREATE INDEX IF NOT EXISTS idx_node_prefix ON chat_nodes(conv_id, prefix_idx);
