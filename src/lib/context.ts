import { Env, ChatNode, blobToHex, hexToBytes, bytesToInt, intTo2Bytes } from "./types";

interface LLMMessage {
  role: "user" | "assistant";
  content: string;
}

export async function getNextIdx(env: Env, convId: string): Promise<{ bytes: Uint8Array; hex: string }> {
  const row = await env.DB.prepare(
    "SELECT idx FROM chat_nodes WHERE conv_id = ? ORDER BY idx DESC LIMIT 1"
  ).bind(convId).first<{ idx: ArrayBuffer }>();

  let next = 1;
  if (row?.idx) {
    const arr = new Uint8Array(row.idx);
    next = bytesToInt(arr) + 1;
  }

  const bytes = intTo2Bytes(next);
  return { bytes, hex: blobToHex(bytes) };
}

export async function buildContext(env: Env, convId: string, prefixHex: string, selfHex: string): Promise<LLMMessage[]> {
  const hexes: string[] = prefixHex ? prefixHex.match(/.{4}/g) || [] : [];
  hexes.push(selfHex);

  const messages: LLMMessage[] = [];

  for (const hex of hexes) {
    const idxBytes = hexToBytes(hex);
    const node = await env.DB.prepare(
      "SELECT * FROM chat_nodes WHERE conv_id = ? AND idx = ?"
    ).bind(convId, idxBytes).first<ChatNode>();

    if (node) {
      messages.push({ role: "user", content: node.user_content });
      if (node.assistant_content) {
        messages.push({ role: "assistant", content: node.assistant_content });
      }
    }
  }

  return messages;
}

export function parseHeadings(markdown: string): string[] {
  const headings: string[] = [];
  const lines = markdown.split("\n");
  for (const line of lines) {
    const match = line.match(/^##\s+(.+)/);
    if (match) {
      headings.push(match[1].trim());
    }
  }
  return headings;
}
