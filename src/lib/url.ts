export interface ParsedUrl {
  origin: string;
  basePath: string;
  sld: string;
}

export function parseProviderUrl(raw: string): ParsedUrl {
  const url = new URL(raw);
  const origin = url.origin;
  let pathname = url.pathname;

  pathname = pathname
    .replace(/\/chat\/completions\/?$/, "")
    .replace(/\/completions\/?$/, "");

  const hostname = url.hostname;
  const parts = hostname.split(".");
  const sld = parts.length >= 2 ? parts[parts.length - 2] : hostname;

  return { origin, basePath: pathname, sld };
}

export function extractModelIds(data: any): string[] {
  if (!data) return [];
  const list = data.data || data.models;
  if (!Array.isArray(list)) return [];
  return list
    .map((m: any) => (typeof m === "string" ? m : m.id))
    .filter(Boolean);
}
