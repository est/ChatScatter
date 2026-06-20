export interface Env {
  DB: D1Database;
}

export interface AiModel {
  id: string;
  provider_name: string;
  base_url: string;
  endpoint: string;
  api_format: string;
  api_key: string | null;
  model_id: string;
  display_name: string | null;
  is_default: number;
  meta: string;
  created_at: string;
  updated_at: string;
}

export interface ProviderGroup {
  provider_name: string;
  base_url: string;
  endpoint: string;
  api_format: string;
  models: AiModel[];
}

export function now(): string {
  return new Date().toISOString();
}

export function uuid(): string {
  return crypto.randomUUID();
}
