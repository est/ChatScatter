import { Hono } from "hono";
import { Env, ProviderGroup, now, uuid } from "../lib/types";
import { probeUrl } from "../lib/probe";

export function createProviderRoutes() {
  const api = new Hono<{ Bindings: Env }>();

  api.get("/list", async (c) => {
    const rows = await c.env.DB.prepare(
      "SELECT * FROM ai_models ORDER BY provider_name, model_id"
    ).all<import("../lib/types").AiModel>();

    const groups = new Map<string, ProviderGroup>();
    for (const row of rows.results || []) {
      const key = row.base_url;
      if (!groups.has(key)) {
        groups.set(key, {
          provider_name: row.provider_name,
          base_url: row.base_url,
          endpoint: row.endpoint,
          api_format: row.api_format,
          models: [],
        });
      }
      groups.get(key)!.models.push(row);
    }

    return c.json({ data: Array.from(groups.values()), em: "" });
  });

  api.post("/probe", async (c) => {
    const { data } = await c.req.json<{ data: { url: string; api_key?: string } }>();
    if (!data?.url) return c.json({ data: null, em: "url required" });
    const result = await probeUrl(data.url, data.api_key);
    return c.json({ data: result, em: "" });
  });

  api.post("/create", async (c) => {
    const body = await c.req.json<{
      data: {
        provider_name: string;
        base_url: string;
        endpoint: string;
        api_format: string;
        api_key?: string;
        models: { model_id: string; display_name?: string }[];
      };
    }>();
    const d = body.data;

    if (!d.base_url || !d.models?.length) {
      return c.json({ data: null, em: "base_url and models required" });
    }

    const ts = now();
    const stmts = d.models.map((m, i) => {
      return c.env.DB.prepare(
        `INSERT INTO ai_models (id, provider_name, base_url, endpoint, api_format, api_key, model_id, display_name, is_default, meta, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '{}', ?, ?)
         ON CONFLICT(base_url, model_id) DO UPDATE SET api_key=excluded.api_key, updated_at=excluded.updated_at`
      ).bind(
        uuid(),
        d.provider_name,
        d.base_url,
        d.endpoint || "/v1/chat/completions",
        d.api_format || "openai",
        d.api_key || null,
        m.model_id,
        m.display_name || null,
        i === 0 ? 1 : 0,
        ts,
        ts
      );
    });

    await c.env.DB.batch(stmts);
    return c.json({ data: null, em: "" });
  });

  api.post("/delete", async (c) => {
    const { data } = await c.req.json<{ data: { base_url: string } }>();
    if (!data?.base_url) return c.json({ data: null, em: "base_url required" });
    await c.env.DB.prepare("DELETE FROM ai_models WHERE base_url = ?").bind(data.base_url).run();
    return c.json({ data: null, em: "" });
  });

  api.post("/update", async (c) => {
    const { data } = await c.req.json<{
      data: { base_url: string; provider_name?: string; api_key?: string };
    }>();
    if (!data?.base_url) return c.json({ data: null, em: "base_url required" });

    const sets: string[] = [];
    const vals: any[] = [];

    if (data.provider_name) {
      sets.push("provider_name = ?");
      vals.push(data.provider_name);
    }
    if (data.api_key !== undefined) {
      sets.push("api_key = ?");
      vals.push(data.api_key);
    }
    if (!sets.length) return c.json({ data: null, em: "" });

    sets.push("updated_at = ?");
    vals.push(now());
    vals.push(data.base_url);

    await c.env.DB.prepare(
      `UPDATE ai_models SET ${sets.join(", ")} WHERE base_url = ?`
    ).bind(...vals).run();

    return c.json({ data: null, em: "" });
  });

  api.get("/models", async (c) => {
    const baseUrl = c.req.query("base_url");
    if (!baseUrl) return c.json({ data: null, em: "base_url required" });
    const rows = await c.env.DB.prepare(
      "SELECT * FROM ai_models WHERE base_url = ? ORDER BY model_id"
    ).bind(baseUrl).all();
    return c.json({ data: rows.results, em: "" });
  });

  api.post("/model/add", async (c) => {
    const { data } = await c.req.json<{
      data: { base_url: string; model_id: string; display_name?: string };
    }>();
    if (!data?.base_url || !data.model_id) return c.json({ data: null, em: "base_url and model_id required" });

    const existing = await c.env.DB.prepare(
      "SELECT * FROM ai_models WHERE base_url = ? LIMIT 1"
    ).bind(data.base_url).first<import("../lib/types").AiModel>();

    if (!existing) return c.json({ data: null, em: "provider not found" });

    const ts = now();
    await c.env.DB.prepare(
      `INSERT INTO ai_models (id, provider_name, base_url, endpoint, api_format, api_key, model_id, display_name, is_default, meta, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, '{}', ?, ?)
       ON CONFLICT(base_url, model_id) DO NOTHING`
    ).bind(
      uuid(),
      existing.provider_name,
      existing.base_url,
      existing.endpoint,
      existing.api_format,
      existing.api_key,
      data.model_id,
      data.display_name || null,
      ts,
      ts
    ).run();

    return c.json({ data: null, em: "" });
  });

  api.post("/model/delete", async (c) => {
    const { data } = await c.req.json<{
      data: { base_url: string; model_id: string };
    }>();
    if (!data?.base_url || !data.model_id) return c.json({ data: null, em: "base_url and model_id required" });
    await c.env.DB.prepare(
      "DELETE FROM ai_models WHERE base_url = ? AND model_id = ?"
    ).bind(data.base_url, data.model_id).run();
    return c.json({ data: null, em: "" });
  });

  return api;
}
