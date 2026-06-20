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
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_provider_model ON ai_models(base_url, model_id);
