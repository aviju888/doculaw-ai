import { apiURL } from "../../lib/http";
/* Client helpers for /api/doculaw/*. */

import type { DocMeta, Roles } from "@/lib/doculaw/types";

export type Loaded = { doc: DocMeta; text: string; roles: Roles; title: string | null; clauseCount: number };

async function asJSON<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}

export function parseFile(file: File, signal?: AbortSignal): Promise<Loaded> {
  const form = new FormData();
  form.append("file", file);
  return fetch(apiURL("/api/doculaw/parse"), { method: "POST", body: form, signal }).then((r) => asJSON<Loaded>(r));
}

export function parseSample(sample: "lease-v1" | "lease-v2", signal?: AbortSignal): Promise<Loaded> {
  return fetch(apiURL("/api/doculaw/parse"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sample }),
    signal,
  }).then((r) => asJSON<Loaded>(r));
}

export function parseText(text: string, name?: string, signal?: AbortSignal): Promise<Loaded> {
  return fetch(apiURL("/api/doculaw/parse"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, name }),
    signal,
  }).then((r) => asJSON<Loaded>(r));
}

export const ACCEPT = ".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown";

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function parseSaved(documentId: string, signal?: AbortSignal): Promise<Loaded> {
 return fetch(apiURL('/api/doculaw/parse'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({documentId}),signal}).then(r=>asJSON<Loaded>(r));
}
