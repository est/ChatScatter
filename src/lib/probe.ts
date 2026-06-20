import { parseProviderUrl, extractModelIds } from "./url";

export interface ProbeResult {
  name: string;
  base_url: string;
  endpoint: string;
  api_format: string;
  models: string[] | null;
  probe_ok: boolean;
}

export async function probeUrl(url: string, apiKey?: string): Promise<ProbeResult> {
  const parsed = parseProviderUrl(url);
  const { origin, basePath, sld } = parsed;

  const headers: Record<string, string> = { Accept: "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

  const candidates = [
    `${origin}${basePath}/models`,
    `${origin}/v1/models`,
    `${origin}/models`,
  ];

  for (const endpoint of candidates) {
    try {
      const res = await fetch(endpoint, { headers, redirect: "follow" });
      if (!res.ok) continue;
      const data = await res.json() as any;
      const models = extractModelIds(data);
      if (models.length > 0) {
        return {
          name: sld,
          base_url: origin,
          endpoint: basePath || "/v1",
          api_format: "openai",
          models,
          probe_ok: true,
        };
      }
    } catch {
      continue;
    }
  }

  return {
    name: sld,
    base_url: origin,
    endpoint: basePath || "/v1/chat/completions",
    api_format: "openai",
    models: null,
    probe_ok: false,
  };
}
